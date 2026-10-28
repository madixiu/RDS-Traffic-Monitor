use anyhow::Result;
use crossbeam_channel::{Receiver, RecvTimeoutError};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

use shared::TrafficEvent;

const BATCH_SIZE: usize = 500;
const FLUSH_INTERVAL: Duration = Duration::from_millis(500);
const RETRY_DELAY: Duration = Duration::from_secs(2);

/// Entry point called from a dedicated OS thread in main.rs.
/// Owns its own tokio current-thread runtime so the ETW callback
/// thread never blocks on async code.
pub fn run(rx: Receiver<TrafficEvent>, database_url: String) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio runtime for pg writer");

    rt.block_on(async move {
        let pool = connect_with_retry(&database_url).await;

        loop {
            let mut batch: Vec<TrafficEvent> = Vec::with_capacity(BATCH_SIZE);

            // Fill batch until it's full, flush interval elapses, or channel closes.
            loop {
                match rx.recv_timeout(FLUSH_INTERVAL) {
                    Ok(e) => {
                        batch.push(e);
                        if batch.len() >= BATCH_SIZE {
                            break;
                        }
                    }
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => {
                        if !batch.is_empty() {
                            let _ = write_batch(&pool, &batch).await;
                        }
                        return;
                    }
                }
            }

            if batch.is_empty() {
                continue;
            }

            if let Err(e) = write_batch(&pool, &batch).await {
                log::warn!("pg batch write failed ({} events): {e:?}", batch.len());
                tokio::time::sleep(RETRY_DELAY).await;
                // Events are dropped on failure. If you want at-least-once
                // delivery, requeue `batch` into a local VecDeque here and
                // retry on the next iteration.
            }
        }
    });
}

async fn connect_with_retry(database_url: &str) -> PgPool {
    loop {
        match PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(10))
            .connect(database_url)
            .await
        {
            Ok(pool) => {
                log::info!("connected to postgres");
                return pool;
            }
            Err(e) => {
                log::warn!("postgres connect failed: {e:?}; retrying in 5s");
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

async fn write_batch(pool: &PgPool, batch: &[TrafficEvent]) -> Result<()> {
    let mut tx = pool.begin().await?;

    for e in batch {
        let ts_minute = e.ts - (e.ts % 60);
        sqlx::query(
            r#"
            INSERT INTO traffic
                (ts_minute, hostname, session_id, username, pid,
                 process_start_ts, process_name, bytes_sent, bytes_recv)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (ts_minute, hostname, session_id, pid, process_start_ts)
            DO UPDATE SET
                bytes_sent   = traffic.bytes_sent   + EXCLUDED.bytes_sent,
                bytes_recv   = traffic.bytes_recv   + EXCLUDED.bytes_recv,
                username     = EXCLUDED.username,
                process_name = EXCLUDED.process_name
            "#,
        )
        .bind(ts_minute)
        .bind(&e.hostname)
        .bind(e.session_id as i32)
        .bind(&e.username)
        .bind(e.pid as i32)
        .bind(e.process_start_ts)
        .bind(&e.process_name)
        .bind(e.bytes_sent as i64)
        .bind(e.bytes_recv as i64)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}