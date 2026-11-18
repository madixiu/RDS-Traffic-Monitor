use anyhow::Result;
use sqlx::PgPool;
use shared::{DomainReport, DomainUserReport, HostStatus, UserDetailReport, UserSummary, WebsiteSummary};

#[derive(serde::Serialize, sqlx::FromRow)]
pub struct TrafficBucket {
    pub ts_minute: i64,
    pub bytes_sent: i64,
    pub bytes_recv: i64,
}

pub async fn live_traffic_buckets(pool: &PgPool, start: i64, end: i64) -> Result<Vec<TrafficBucket>> {
    Ok(sqlx::query_as::<_, TrafficBucket>(
        r#"
        SELECT ts_minute, SUM(bytes_sent)::BIGINT AS bytes_sent, SUM(bytes_recv)::BIGINT AS bytes_recv
        FROM traffic_logs
        WHERE ts_minute >= $1 AND ts_minute <= $2
          AND username NOT IN ('Administrator', 'SYSTEM', 'UNKNOWN', 'DefaultAccount', 'LOCAL SERVICE', 'NETWORK SERVICE', 'ANONYMOUS LOGON')
          AND username NOT ILIKE '%Administrator%'
        GROUP BY ts_minute
        ORDER BY ts_minute
        "#,
    )
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await?)
}

pub async fn users_summary(pool: &PgPool, start: i64, end: i64) -> Result<Vec<UserSummary>> {
    let rows = sqlx::query_as::<_, UserSummary>(
        r#"
        SELECT
            username,
            STRING_AGG(DISTINCT hostname, ', ') AS hostname,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv,
            COUNT(DISTINCT pid)::BIGINT     AS process_count,
            MAX(ts_minute)::BIGINT          AS last_seen
        FROM traffic_logs
        WHERE ts_minute >= $1 AND ts_minute <= $2
          AND username NOT IN ('Administrator', 'SYSTEM', 'UNKNOWN', 'DefaultAccount', 'LOCAL SERVICE', 'NETWORK SERVICE', 'ANONYMOUS LOGON')
          AND username NOT ILIKE '%Administrator%'
        GROUP BY username
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn user_websites(pool: &PgPool, username: &str, start: i64, end: i64) -> Result<Vec<WebsiteSummary>> {
    let rows = sqlx::query_as::<_, WebsiteSummary>(
        r#"
        SELECT
            website,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv
        FROM traffic_logs
        WHERE ts_minute >= $1 AND ts_minute <= $2 AND username = $3
        GROUP BY website
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .bind(start)
    .bind(end)
    .bind(username)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn user_detailed_history(pool: &PgPool, username: &str, start: i64, end: i64) -> Result<Vec<UserDetailReport>> {
    let rows = sqlx::query_as::<_, UserDetailReport>(
        r#"
        SELECT
            COALESCE(website, 'Unknown') AS website,
            hostname,
            process_name,
            SUM(bytes_sent)::BIGINT AS bytes_sent,
            SUM(bytes_recv)::BIGINT AS bytes_recv
        FROM traffic_logs
        WHERE ts_minute >= $1 AND ts_minute <= $2 AND username = $3
        GROUP BY COALESCE(website, 'Unknown'), hostname, process_name
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .bind(start)
    .bind(end)
    .bind(username)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn hosts_status(pool: &PgPool, start: i64, end: i64) -> Result<Vec<HostStatus>> {
    let rows = sqlx::query_as::<_, HostStatus>(
        r#"
        SELECT
            hostname,
            MAX(ts_minute)::BIGINT              AS last_seen,
            COUNT(DISTINCT username)::BIGINT    AS active_users
        FROM traffic_logs
        WHERE ts_minute >= $1 AND ts_minute <= $2
        GROUP BY hostname
        ORDER BY hostname
        "#,
    )
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn all_time_reports(pool: &PgPool) -> Result<Vec<UserSummary>> {
    let rows = sqlx::query_as::<_, UserSummary>(
        r#"
        SELECT
            username,
            'All Hosts'::TEXT               AS hostname,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv,
            0::BIGINT                       AS process_count,
            0::BIGINT                       AS last_seen
        FROM traffic_daily
        WHERE username NOT IN ('Administrator', 'SYSTEM', 'UNKNOWN', 'DefaultAccount', 'LOCAL SERVICE', 'NETWORK SERVICE')
          AND username NOT ILIKE '%Administrator%'
        GROUP BY username
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn top_domains(pool: &PgPool) -> Result<Vec<DomainReport>> {
    let rows = sqlx::query_as::<_, DomainReport>(
        r#"
        SELECT website, SUM(bytes_sent)::BIGINT AS bytes_sent, SUM(bytes_recv)::BIGINT AS bytes_recv
        FROM traffic_daily
        GROUP BY website
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        LIMIT 10
        "#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn search_domain(pool: &PgPool, search_term: &str) -> Result<Vec<DomainUserReport>> {
    let rows = sqlx::query_as::<_, DomainUserReport>(
        r#"
        SELECT username, SUM(bytes_sent)::BIGINT AS bytes_sent, SUM(bytes_recv)::BIGINT AS bytes_recv
        FROM traffic_daily
        WHERE website ILIKE $1
        GROUP BY username
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .bind(format!("%{}%", search_term))
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn top_domains_for_range(pool: &PgPool, start: i64, end: i64) -> Result<Vec<DomainReport>> {
    let rows = sqlx::query_as::<_, DomainReport>(
        r#"
        SELECT
            COALESCE(website, 'Unknown') AS website,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv
        FROM traffic_logs
        WHERE ts_minute >= $1 AND ts_minute <= $2
          AND username NOT IN ('Administrator', 'SYSTEM', 'UNKNOWN', 'DefaultAccount', 'LOCAL SERVICE', 'NETWORK SERVICE', 'ANONYMOUS LOGON')
          AND username NOT ILIKE '%Administrator%'
        GROUP BY COALESCE(website, 'Unknown')
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        LIMIT 10
        "#,
    )
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

fn domain_search_pattern(search_term: &str) -> String {
    let escaped = search_term.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
    format!("%{}%", escaped)
}

pub async fn search_domain_for_range(pool: &PgPool, search_term: &str, start: i64, end: i64) -> Result<Vec<DomainUserReport>> {
    let rows = sqlx::query_as::<_, DomainUserReport>(
        r#"
        SELECT
            username,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv
        FROM traffic_logs
        WHERE website ILIKE $1 AND ts_minute >= $2 AND ts_minute <= $3
          AND username NOT IN ('Administrator', 'SYSTEM', 'UNKNOWN', 'DefaultAccount', 'LOCAL SERVICE', 'NETWORK SERVICE', 'ANONYMOUS LOGON')
          AND username NOT ILIKE '%Administrator%'
        GROUP BY username
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .bind(domain_search_pattern(search_term))
    .bind(start)
    .bind(end)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::domain_search_pattern;

    #[test]
    fn domain_search_treats_wildcards_as_literals() {
        assert_eq!(domain_search_pattern(r"a_b%\.com"), r"%a\_b\%\\.com%");
    }
}