#[allow(dead_code)]
#[derive(Clone, Debug)]
pub struct ProcessInfo {
    pub pid: u32,
    pub session_id: u32,
    pub username: String,
    pub process_name: String,
    pub process_start_ts: i64,
}

#[allow(dead_code)]
#[derive(Clone, Debug)]
pub struct TrafficEvent {
    pub ts: i64,
    pub pid: u32,
    pub session_id: u32,
    pub username: String,
    pub process_name: String,
    pub process_start_ts: i64,
    pub bytes_sent: u64,
    pub bytes_recv: u64,
    // Optional destination detail; not in the PRIMARY KEY currently.
    // Add to key when you extend the schema for per-host history.
    pub remote_ip: Option<u32>,
    pub remote_port: Option<u16>,
    pub is_udp: bool,
}