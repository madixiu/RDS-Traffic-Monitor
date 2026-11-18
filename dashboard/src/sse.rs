use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
};
use async_stream::stream;
use futures_util::Stream;
use sqlx::PgPool;
use std::convert::Infallible;
use std::time::Duration;
use crate::db;

const PUSH_INTERVAL: Duration = Duration::from_secs(2);
const DEFAULT_WINDOW_SECONDS: i64 = 3600;

#[derive(serde::Deserialize)]
pub struct StreamParams {
    window: Option<i64>,
}

pub async fn stream(
    State(pool): State<PgPool>,
    Query(params): Query<StreamParams>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, &'static str)> {
    let window = params.window.unwrap_or(DEFAULT_WINDOW_SECONDS);
    if window != 900 && window != 3600 {
        return Err((StatusCode::BAD_REQUEST, "window must be 900 or 3600 seconds"));
    }
    let s = stream! {
        let mut interval = tokio::time::interval(PUSH_INTERVAL);
        loop {
            interval.tick().await;
            
            let now = chrono::Utc::now().timestamp();
            let start = now - window;
            
            match db::users_summary(&pool, start, now).await {
                Ok(users) => {
                    match serde_json::to_string(&users) {
                        Ok(json) => yield Ok::<_, Infallible>(Event::default().event("users").data(json)),
                        Err(e) => tracing::warn!("sse users serialization failed: {e:?}"),
                    }
                    // Track individual minute buckets so a rolling window expiring does not look like negative traffic.
                    let bucket_start = now - now.rem_euclid(60) - 120;
                    match db::live_traffic_buckets(&pool, bucket_start, now).await {
                        Ok(buckets) => match serde_json::to_string(&buckets) {
                            Ok(json) => yield Ok::<_, Infallible>(Event::default().event("traffic_buckets").data(json)),
                            Err(e) => tracing::warn!("sse traffic buckets serialization failed: {e:?}"),
                        },
                        Err(e) => tracing::warn!("sse traffic buckets query failed: {e:?}"),
                    }
                }
                Err(e) => {
                    tracing::warn!("sse query failed: {e:?}");
                }
            }
        }
    };

    Ok(Sse::new(s).keep_alive(KeepAlive::default()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::postgres::PgPoolOptions;

    #[tokio::test]
    async fn stream_accepts_supported_windows_and_rejects_others() {
        let pool = PgPoolOptions::new().connect_lazy("postgres://localhost/test").unwrap();
        for window in [None, Some(900), Some(3600)] {
            assert!(stream(State(pool.clone()), Query(StreamParams { window })).await.is_ok());
        }
        let error = match stream(State(pool), Query(StreamParams { window: Some(60) })).await {
            Ok(_) => panic!("unsupported window was accepted"),
            Err(error) => error,
        };
        assert_eq!(error.0, StatusCode::BAD_REQUEST);
    }
}