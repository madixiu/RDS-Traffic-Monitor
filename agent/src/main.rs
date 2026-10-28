mod etw;
mod session;
mod storage;

use anyhow::Result;
use crossbeam_channel::bounded;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

const QUEUE_CAPACITY: usize = 200_000;

fn main() -> Result<()> {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    ).init();

    log::info!("Starting RDS traffic agent");

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL env var required (postgres://...)");
    let hostname = std::env::var("COMPUTERNAME").unwrap_or_else(|_| "unknown".into());

    let shutdown = Arc::new(AtomicBool::new(false));
    let (tx, rx) = bounded::<shared::TrafficEvent>(QUEUE_CAPACITY);

    let writer_handle = std::thread::Builder::new()
        .name("pg-writer".into())
        .spawn({
            let url = database_url.clone();
            move || storage::run(rx, url)
        })?;

    etw::spawn_collector(tx.clone(), shutdown.clone(), hostname)?;
    drop(tx);

    {
        let s = shutdown.clone();
        ctrlc::set_handler(move || {
            log::info!("shutdown requested");
            s.store(true, Ordering::SeqCst);
        })?;
    }

    while !shutdown.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(500));
    }
    let _ = writer_handle;
    std::process::exit(0);
}