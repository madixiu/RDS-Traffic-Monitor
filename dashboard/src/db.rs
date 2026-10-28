use anyhow::Result;
use sqlx::PgPool;

use shared::{HostStatus, UserSummary};

/// How far back the "live" dashboard looks, in seconds.
/// One hour is a good default for a live view; longer windows belong in a
/// separate "reports" query with explicit date-range parameters.
const WINDOW_SECONDS: i64 = 3_600;

/// Per-user, per-host totals over the live window.
///
/// Grouping by (username, hostname) is deliberate: the same user can be
/// logged into more than one RDS host simultaneously (e.g. during a
/// reconnect or migration), and the dashboard should show that as two
/// rows rather than silently merging them.
pub async fn users_summary(pool: &PgPool) -> Result<Vec<UserSummary>> {
    let cutoff = chrono::Utc::now().timestamp() - WINDOW_SECONDS;

    let rows = sqlx::query_as::<_, UserSummary>(
        r#"
        SELECT
            username,
            hostname,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv,
            COUNT(DISTINCT pid)::BIGINT     AS process_count,
            MAX(ts_minute)::BIGINT          AS last_seen
        FROM traffic
        WHERE ts_minute > $1
        GROUP BY username, hostname
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Per-host liveness over the live window.
///
/// "Active users" here means distinct usernames seen on that host within
/// the window — not RDP sessions, which the agent doesn't track. If you
/// later want true session counts, add a `session_id` to the GROUP BY and
/// count distinct session_ids per host.
pub async fn hosts_status(pool: &PgPool) -> Result<Vec<HostStatus>> {
    let cutoff = chrono::Utc::now().timestamp() - WINDOW_SECONDS;

    let rows = sqlx::query_as::<_, HostStatus>(
        r#"
        SELECT
            hostname,
            MAX(ts_minute)::BIGINT              AS last_seen,
            COUNT(DISTINCT username)::BIGINT    AS active_users
        FROM traffic
        WHERE ts_minute > $1
        GROUP BY hostname
        ORDER BY hostname
        "#,
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}