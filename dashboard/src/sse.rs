use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
};
use async_stream::stream;
use futures_util::Stream;
use sqlx::PgPool;
use std::convert::Infallible;
use std::time::Duration;
use crate::db;

const PUSH_INTERVAL: Duration = Duration::from_secs(2);
const WINDOW_SECONDS: i64 = 3600; 

pub async fn stream(
    State(pool): State<PgPool>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let s = stream! {
        let mut interval = tokio::time::interval(PUSH_INTERVAL);
        loop {
            interval.tick().await;
            
            let now = chrono::Utc::now().timestamp();
            let start = now - WINDOW_SECONDS;
            
            match db::users_summary(&pool, start, now).await {
                Ok(users) => {
                    if let Ok(json) = serde_json::to_string(&users) {
                        yield Ok::<_, Infallible>(
                            Event::default().event("users").data(json),
                        );
                    }
                }
                Err(e) => {
                    tracing::warn!("sse query failed: {e:?}");
                }
            }
        }
    };

    Sse::new(s).keep_alive(KeepAlive::default())
}