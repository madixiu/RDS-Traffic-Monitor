# Confirm you can run it from there
cd 'C:\Users\Administrator.VDI\Documents'

# Set the env var for this shell only (smoke test)
$env:DATABASE_URL = "postgres://rds_user:1234qwer%21%40%23%24@192.168.12.212:5432/rds_traffic"
$env:RUST_LOG = "info"

# Run in foreground
.\agent.exe
