use anyhow::Result;
use sqlx::PgPool;
use shared::{DomainReport, DomainUserReport, HostStatus, UserDetailReport, UserSummary, WebsiteSummary};

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
            website,
            hostname,
            process_name,
            SUM(bytes_sent)::BIGINT AS bytes_sent,
            SUM(bytes_recv)::BIGINT AS bytes_recv
        FROM traffic_logs
        WHERE ts_minute >= $1 AND ts_minute <= $2 AND username = $3
        GROUP BY website, hostname, process_name
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
        SELECT
            website,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv
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
    let like_term = format!("%{}%", search_term);
    let rows = sqlx::query_as::<_, DomainUserReport>(
        r#"
        SELECT
            username,
            SUM(bytes_sent)::BIGINT         AS bytes_sent,
            SUM(bytes_recv)::BIGINT         AS bytes_recv
        FROM traffic_daily
        WHERE website ILIKE $1
        GROUP BY username
        ORDER BY (SUM(bytes_sent) + SUM(bytes_recv)) DESC
        "#,
    )
    .bind(like_term)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}