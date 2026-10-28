use axum::{routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use tower_http::{cors::CorsLayer, services::ServeDir};

mod api;
mod db;
mod sse;

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
        .route("/api/users", get(api::get_users))
        .route("/api/hosts", get(api::get_hosts))
        .route("/api/stream", get(sse::stream))
        .fallback_service(ServeDir::new("frontend/dist"))
        .layer(CorsLayer::permissive())
        .with_state(pool);

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("dashboard listening on {addr}");
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}