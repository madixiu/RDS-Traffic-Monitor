mod api;
mod db;
mod sse;

use axum::{routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use tower_http::{cors::CorsLayer, services::ServeDir};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL not set");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    let app = Router::new()
        // Live Dashboard Routes
        .route("/api/users", get(api::get_users))
        .route("/api/users/:username/websites", get(api::get_user_websites))
        .route("/api/hosts", get(api::get_hosts))
        .route("/api/stream", get(sse::stream))
        
        // Reports Page Routes
        .route("/api/reports/all-time", get(api::get_all_time_reports))
        .route("/api/reports/top-domains", get(api::get_top_domains))
        .route("/api/reports/search", get(api::get_domain_users))
        
        // Serve Frontend
        .fallback_service(ServeDir::new("frontend/dist"))
        .layer(CorsLayer::permissive())
        .with_state(pool);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("dashboard listening on {addr}");
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}