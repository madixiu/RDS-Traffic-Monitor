CREATE TABLE IF NOT EXISTS traffic (
    ts_minute BIGINT NOT NULL,
    session_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    pid INTEGER NOT NULL,
    process_start_ts BIGINT NOT NULL,
    process_name TEXT NOT NULL,
    bytes_sent BIGINT NOT NULL DEFAULT 0,
    bytes_recv BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (ts_minute, session_id, pid, process_start_ts)
);

INSERT INTO traffic (...) VALUES ($1, $2, ...)
ON CONFLICT (ts_minute, session_id, pid, process_start_ts)
DO UPDATE SET
    bytes_sent = traffic.bytes_sent + EXCLUDED.bytes_sent,
    bytes_recv = traffic.bytes_recv + EXCLUDED.bytes_recv,
    username = EXCLUDED.username,
    process_name = EXCLUDED.process_name;