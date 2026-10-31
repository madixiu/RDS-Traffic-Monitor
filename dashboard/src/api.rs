use axum::{extract::{Query, State, Path}, Json};
use serde::Deserialize;
use sqlx::PgPool;
use shared::{HostStatus, UserSummary, WebsiteSummary};
use crate::db;

#[derive(Deserialize)]
pub struct TimeParams {
    pub start: Option<i64>,
    pub end: Option<i64>,
}

pub async fn get_users(State(pool): State<PgPool>, Query(params): Query<TimeParams>) -> Result<Json<Vec<UserSummary>>, (axum::http::StatusCode, String)> {
    let now = chrono::Utc::now().timestamp();
    let start = params.start.unwrap_or(now - 3600);
    let end = params.end.unwrap_or(now);
    db::users_summary(&pool, start, end).await.map(Json).map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("{e:?}")))
}

pub async fn get_user_websites(State(pool): State<PgPool>, Path(username): Path<String>, Query(params): Query<TimeParams>) -> Result<Json<Vec<WebsiteSummary>>, (axum::http::StatusCode, String)> {
    let now = chrono::Utc::now().timestamp();
    let start = params.start.unwrap_or(now - 3600);
    let end = params.end.unwrap_or(now);
    db::user_websites(&pool, &username, start, end).await.map(Json).map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("{e:?}")))
}

pub async fn get_hosts(State(pool): State<PgPool>, Query(params): Query<TimeParams>) -> Result<Json<Vec<HostStatus>>, (axum::http::StatusCode, String)> {
    let now = chrono::Utc::now().timestamp();
    let start = params.start.unwrap_or(now - 3600);
    let end = params.end.unwrap_or(now);
    db::hosts_status(&pool, start, end).await.map(Json).map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("{e:?}")))
}

pub async fn get_all_time_reports(State(pool): State<PgPool>) -> Result<Json<Vec<UserSummary>>, (axum::http::StatusCode, String)> {
    db::all_time_reports(&pool).await.map(Json).map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("{e:?}")))
}

// Add these to your existing api.rs
use shared::{DomainReport, DomainUserReport}; // Add to imports

pub async fn get_top_domains(State(pool): State<PgPool>) -> Result<Json<Vec<DomainReport>>, (axum::http::StatusCode, String)> {
    db::top_domains(&pool).await.map(Json).map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("{e:?}")))
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub q: Option<String>,
}

pub async fn get_domain_users(State(pool): State<PgPool>, Query(params): Query<SearchParams>) -> Result<Json<Vec<DomainUserReport>>, (axum::http::StatusCode, String)> {
    let query = params.q.unwrap_or_default();
    if query.is_empty() { return Ok(Json(Vec::new())); }
    db::search_domain(&pool, &query).await.map(Json).map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("{e:?}")))
}