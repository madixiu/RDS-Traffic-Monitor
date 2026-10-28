use anyhow::Result;
use crossbeam_channel::Sender;
use dashmap::DashMap;
use ferrisetw::parser::Parser;
use ferrisetw::provider::Provider;
use ferrisetw::schema_locator::SchemaLocator;
use ferrisetw::trace::UserTrace;
use ferrisetw::EventRecord;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::session;
use shared::{ProcessInfo, TrafficEvent};

const KERNEL_NETWORK_GUID: &str = "7dd42a49-5329-4832-8dfd-43d979153a88";
const KERNEL_PROCESS_GUID: &str = "22fb2cd6-0e7b-422b-a0c7-2fad1fd0e716";

type Cache = Arc<DashMap<u32, ProcessInfo>>;

pub fn spawn_collector(
    tx: Sender<TrafficEvent>,
    shutdown: Arc<AtomicBool>,
    hostname: String,
) -> Result<()> {
    let cache: Cache = Arc::new(DashMap::new());

    let cache_net = cache.clone();
    let tx_net = tx.clone();
    let shutdown_net = shutdown.clone();
    let hostname_net = hostname.clone();
    let net_provider = Provider::by_guid(KERNEL_NETWORK_GUID)
        .add_callback(move |record: &EventRecord, sl: &SchemaLocator| {
            if shutdown_net.load(Ordering::Relaxed) {
                return;
            }
            handle_network_event(record, sl, &cache_net, &tx_net, &hostname_net);
        })
        .build();

    let cache_proc = cache.clone();
    let shutdown_proc = shutdown.clone();
    let proc_provider = Provider::by_guid(KERNEL_PROCESS_GUID)
        .add_callback(move |record: &EventRecord, sl: &SchemaLocator| {
            if shutdown_proc.load(Ordering::Relaxed) {
                return;
            }
            handle_process_event(record, sl, &cache_proc);
        })
        .build();

    std::thread::Builder::new()
        .name("etw-collector".into())
        .spawn(move || {
            if let Err(e) = UserTrace::new()
                .enable(net_provider)
                .enable(proc_provider)
                .start_and_process()
            {
                log::error!("ETW trace failed: {e:?}");
            }
        })?;

    Ok(())
}

fn handle_network_event(
    record: &EventRecord,
    schema_locator: &SchemaLocator,
    cache: &Cache,
    tx: &Sender<TrafficEvent>,
    hostname: &str,
) {
    let schema = match schema_locator.event_schema(record) {
        Ok(s) => s,
        Err(_) => return,
    };

    let (is_send, is_udp) = match record.event_id() {
        10 => (true, false),
        11 => (false, false),
        15 => (true, true),
        16 => (false, true),
        _ => return,
    };

    let parser = Parser::create(record, &schema);

    let pid: u32 = match parser.try_parse("PID") {
        Ok(v) => v,
        Err(_) => return,
    };
    let size: u32 = match parser.try_parse("size") {
        Ok(v) => v,
        Err(_) => return,
    };
    let daddr: Option<u32> = parser.try_parse("daddr").ok();
    let dport: Option<u16> = parser.try_parse("dport").ok();

    let info = match cache.get(&pid) {
        Some(i) => i.clone(),
        None => return,
    };

    let event = TrafficEvent {
        ts: chrono::Utc::now().timestamp(),
        pid,
        session_id: info.session_id,
        username: info.username.clone(),
        process_name: info.process_name.clone(),
        process_start_ts: info.process_start_ts,
        bytes_sent: if is_send { size as u64 } else { 0 },
        bytes_recv: if is_send { 0 } else { size as u64 },
        remote_ip: daddr,
        remote_port: dport,
        is_udp,
        hostname: hostname.to_string(),
    };

    let _ = tx.try_send(event);
}

fn handle_process_event(
    record: &EventRecord,
    schema_locator: &SchemaLocator,
    cache: &Cache,
) {
    let schema = match schema_locator.event_schema(record) {
        Ok(s) => s,
        Err(_) => return,
    };

    let parser = Parser::create(record, &schema);

    match record.event_id() {
        1 => {
            let pid: u32 = match parser.try_parse("ProcessID") {
                Ok(v) => v,
                Err(_) => return,
            };
            if pid == 0 {
                return;
            }

            let image: String = parser.try_parse("ImageName").unwrap_or_default();

            let Some(session_id) = session::pid_to_session_id(pid) else {
                return;
            };

            let username = session::session_username(session_id)
                .unwrap_or_else(|| "UNKNOWN".into());
            let process_name = image.rsplit('\\').next().unwrap_or(&image).to_string();

            cache.insert(
                pid,
                ProcessInfo {
                    pid,
                    session_id,
                    username,
                    process_name,
                    process_start_ts: chrono::Utc::now().timestamp(),
                },
            );
        }
        2 => {
            let pid: u32 = match parser.try_parse("ProcessID") {
                Ok(v) => v,
                Err(_) => return,
            };
            cache.remove(&pid);
        }
        _ => {}
    }
}