-- Table: traffic_logs
CREATE TABLE IF NOT EXISTS traffic_logs (
    ts_minute BIGINT NOT NULL,
    hostname TEXT NOT NULL,
    session_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    pid INTEGER NOT NULL,
    process_start_ts BIGINT NOT NULL,
    process_name TEXT NOT NULL,
    website TEXT DEFAULT 'Unknown'::text,
    bytes_sent BIGINT NOT NULL DEFAULT 0,
    bytes_recv BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (ts_minute, hostname, session_id, pid, process_start_ts)
);

CREATE INDEX IF NOT EXISTS idx_logs_time ON traffic_logs (ts_minute);
CREATE INDEX IF NOT EXISTS idx_logs_user_time ON traffic_logs (username, ts_minute);

-- Table: traffic_daily
CREATE TABLE IF NOT EXISTS traffic_daily (
    date DATE NOT NULL,
    username TEXT NOT NULL,
    website TEXT NOT NULL,
    bytes_sent BIGINT NOT NULL DEFAULT 0,
    bytes_recv BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (date, username, website)
);