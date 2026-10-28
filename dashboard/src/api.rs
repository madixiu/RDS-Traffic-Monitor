use axum::{extract::State, Json};
use sqlx::PgPool;

use shared::{HostStatus, UserSummary};

use crate::db;

pub async fn get_users(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<UserSummary>>, (axum::http::StatusCode, String)> {
    db::users_summary(&pool)
        .await
        .map(Json)
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("db error: {e:?}"),
            )
        })
}

pub async fn get_hosts(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<HostStatus>>, (axum::http::StatusCode, String)> {
    db::hosts_status(&pool)
        .await
        .map(Json)
        .map_err(|e| {
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("db error: {e:?}"),
            )
        })
}