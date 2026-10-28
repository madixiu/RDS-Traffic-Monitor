use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub session_id: u32,
    pub username: String,
    pub process_name: String,
    pub process_start_ts: i64,
}

#[allow(dead_code)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TrafficEvent {
    pub ts: i64,
    pub pid: u32,
    pub session_id: u32,
    pub username: String,
    pub process_name: String,
    pub process_start_ts: i64,
    pub bytes_sent: u64,
    pub bytes_recv: u64,
    pub remote_ip: Option<u32>,
    pub remote_port: Option<u16>,
    pub is_udp: bool,
    pub hostname: String,
}