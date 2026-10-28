use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserSummary {
    pub username: String,
    pub hostname: String,
    pub bytes_sent: i64,
    pub bytes_recv: i64,
    pub process_count: i64,
    pub last_seen: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct HostStatus {
    pub hostname: String,
    pub last_seen: i64,
    pub active_users: i64,
}