use anyhow::Result;
use crossbeam_channel::{Receiver, RecvTimeoutError};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

use shared::TrafficEvent;

const BATCH_SIZE: usize = 500;
const FLUSH_INTERVAL: Duration = Duration::from_millis(500);

pub fn run(rx: Receiver<TrafficEvent>, database_url: String) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("failed to build tokio runtime");

    rt.block_on(async move {
        let pool = connect_with_retry(&database_url).await;

        loop {
            let mut batch: Vec<TrafficEvent> = Vec::with_capacity(BATCH_SIZE);

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
                log::warn!("pg batch write failed: {e:?}");
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        }
    });
}

async fn connect_with_retry(database_url: &str) -> PgPool {
    loop {
        match PgPoolOptions::new()
            .max_connections(5)
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
            INSERT INTO traffic_logs
                (ts_minute, hostname, session_id, username, pid,
                 process_start_ts, process_name, bytes_sent, bytes_recv, website)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (ts_minute, hostname, session_id, pid, process_start_ts)
            DO UPDATE SET
                bytes_sent   = traffic_logs.bytes_sent   + EXCLUDED.bytes_sent,
                bytes_recv   = traffic_logs.bytes_recv   + EXCLUDED.bytes_recv,
                username     = EXCLUDED.username,
                process_name = EXCLUDED.process_name,
                website      = EXCLUDED.website
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
        .bind(&e.website)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}