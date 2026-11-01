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
pub struct WebsiteSummary {
    pub website: String,
    pub bytes_sent: i64,
    pub bytes_recv: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct HostStatus {
    pub hostname: String,
    pub last_seen: i64,
    pub active_users: i64,
}

// NEW: These two were added for the Reports page
#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DomainReport {
    pub website: String,
    pub bytes_sent: i64,
    pub bytes_recv: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DomainUserReport {
    pub username: String,
    pub bytes_sent: i64,
    pub bytes_recv: i64,
}

// Add this to shared/src/dto.rs if it's not there
#[derive(Clone, Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserDetailReport {
    pub website: String,
    pub hostname: String,
    pub process_name: String,
    pub bytes_sent: i64,
    pub bytes_recv: i64,
}