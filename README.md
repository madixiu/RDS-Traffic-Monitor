# RDS Traffic Monitor

Real-time, per-user network traffic monitoring for Windows Remote Desktop Services (RDS) farms, with a live web dashboard.

Desktop tools such as GlassWire are primarily designed for single-user environments and do not provide reliable per-user traffic attribution on shared RDS hosts. **RDS Traffic Monitor** addresses this by using a Windows agent to capture TCP/UDP network events through Event Tracing for Windows (ETW), associate connections with processes and RDS sessions, and attribute traffic to individual users.

Traffic statistics are sent to a central PostgreSQL database. A lightweight Rust web server exposes REST APIs and a Server-Sent Events (SSE) stream, while a React dashboard displays real-time bandwidth usage by user, host, and connection activity.

## Architecture

```text
┌─────────────────────────────┐    ┌─────────────────────────────┐
│       RDS-01 (Windows)      │    │    RDS-02..04 (Windows)     │
│                             │    │                             │
│  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │
│  │       agent.exe       │  │    │  │       agent.exe       │  │
│  │                       │  │    │  │                       │  │
│  │  ETW network events   │  │    │  │  ETW network events   │  │
│  │  PID → session → user │  │    │  │  PID → session → user │  │
│  │  Batch traffic writer │  │    │  │  Batch traffic writer │  │
│  └───────────┬───────────┘  │    │  └───────────┬───────────┘  │
└──────────────┼──────────────┘    └──────────────┼──────────────┘
               │                                  │
               └──────────────┬───────────────────┘
                              │ PostgreSQL :5432
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Dashboard Server (Linux)                       │
│              192.168.12.212                                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ PostgreSQL                                            │  │
│  │ Traffic records, user aggregates, host status         │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ Rust / Axum                                            │  │
│  │ REST API + Server-Sent Events (port 8080)              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ React + Vite                                           │  │
│  │ Static frontend served from frontend/dist              │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP :8080
                               ▼
                       ┌─────────────────┐
                       │ Browser (LAN)   │
                       │ Live Dashboard  │
                       └─────────────────┘
```

### Data flow

1. **Capture:** The Windows agent collects network events using ETW.
2. **Attribution:** Process IDs are mapped to Windows sessions and usernames.
3. **Aggregation:** Traffic events are batched and written to PostgreSQL.
4. **API:** The Rust/Axum server provides REST endpoints and an SSE stream.
5. **Visualization:** The React dashboard displays traffic statistics and host status in near real time.

## Features

- Per-user traffic monitoring on shared Windows RDS hosts.
- TCP and UDP network event collection through ETW.
- Process ID to RDS session and username attribution.
- Centralized PostgreSQL storage.
- Batched database writes with retry handling.
- REST API for user traffic summaries and host status.
- Server-Sent Events for live dashboard updates.
- React, Vite, and Tailwind CSS v4 frontend.
- Linux-hosted dashboard with Windows agents deployed separately.
- LAN-oriented dashboard access.

## Repository Structure

```text
.
├── Cargo.toml                  # Rust workspace root
├── Cargo.lock                  # Locked Rust dependency versions
├── schema.sql                  # PostgreSQL database schema
├── .env.example                # Environment variable template
│
├── shared/                     # Shared Rust types and DTOs
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── types.rs             # TrafficEvent, ProcessInfo
│       └── dto.rs               # UserSummary, HostStatus
│
├── agent/                      # Windows traffic collection agent
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── etw.rs              # ETW event collection
│       ├── session.rs          # PID → session → username mapping
│       └── storage.rs          # Batched PostgreSQL writer
│
└── dashboard/                  # Linux dashboard server and frontend
    ├── Cargo.toml
    ├── src/
    │   ├── main.rs             # Axum application bootstrap
    │   ├── db.rs               # Database queries
    │   ├── api.rs              # REST endpoints
    │   └── sse.rs              # Server-Sent Events
    │
    └── frontend/
        ├── package.json
        ├── vite.config.js
        ├── index.html
        └── src/
```

## Requirements

| Component | Version | Platform |
|---|---|---|
| Rust | 1.75 or newer | Development and dashboard server |
| Node.js | 20 or newer | Frontend development and build |
| PostgreSQL | 14 or newer | Central database server |
| Windows Server | 2019 or 2022 | RDS agent hosts |
| MinGW-w64 | 11 or newer | Windows GNU cross-compilation |
| Linux | Compatible with the selected Rust toolchain | Dashboard server |

## Getting Started

### 1. Configure PostgreSQL

Create a PostgreSQL database and a dedicated application user on the dashboard server.

Apply the schema:

```bash
psql "$DATABASE_URL" -f schema.sql
```

Configure the database connection string in the dashboard and agent environments as appropriate.

**Network requirements:**

- Allow PostgreSQL traffic on TCP port `5432` from authorized RDS hosts.
- Allow dashboard traffic on TCP port `8080` from authorized LAN clients.
- Restrict database access and dashboard access with firewall rules.
- Use dedicated database credentials with only the permissions required by the application.

### 2. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Set the required values, including `DATABASE_URL` and `RUST_LOG`.

Keep `.env` out of version control. Do not commit production credentials or passwords.

### 3. Build the frontend

Run these commands from the repository root:

```bash
cd dashboard/frontend
npm install
npm run build
cd ../..
```

The production frontend should be generated in:

```text
dashboard/frontend/dist/
```

### 4. Build the Linux dashboard

From the repository root:

```bash
cargo build --release -p dashboard
```

The resulting executable is normally located at:

```text
target/release/dashboard
```

Configure the dashboard to use the correct database connection and serve the compiled frontend assets. Ensure the configured frontend path matches the deployment layout.

### 5. Build the Windows agent

#### Option A: Cross-compile from Linux

Install the Windows GNU target:

```bash
rustup target add x86_64-pc-windows-gnu
```

Install a compatible MinGW-w64 toolchain and configure the appropriate linker for your environment.

Build the agent:

```bash
cargo build --release \
  -p agent \
  --target x86_64-pc-windows-gnu
```

The resulting executable is normally located at:

```text
target/x86_64-pc-windows-gnu/release/agent.exe
```

Cross-compilation requires the agent's dependencies and any native libraries to support the selected Windows GNU target.

#### Option B: Build on Windows

Install Rust with the MSVC toolchain and the required Visual Studio C++ build tools. Then run the release build from the repository root:

```powershell
cargo build --release -p agent
```

Building on Windows can be simpler when dependencies require Windows-specific SDKs or native libraries.

## Deployment

### Dashboard server

1. Install PostgreSQL and create the application database.
2. Apply `schema.sql`.
3. Configure environment variables and firewall rules.
4. Build the frontend and dashboard binary.
5. Start the dashboard service.
6. Verify that the REST API, SSE endpoint, and frontend are accessible from an authorized LAN client.

### RDS hosts

1. Copy `agent.exe` to each RDS host.
2. Configure the agent's database connection and host identity, if required by the implementation.
3. Grant the agent the permissions required to collect ETW events and query RDS session information.
4. Configure the agent to start automatically, preferably as a Windows service.
5. Verify event collection, username attribution, and successful database writes.

Deploy the same agent build to every supported RDS host unless host-specific configuration is required.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/users` | Retrieve aggregated user traffic summaries |
| `GET /api/hosts` | Retrieve host status information |
| `GET /api/stream` | Receive live updates through Server-Sent Events |

The exact response fields and update behavior are defined by the API implementation.

## Important Implementation Notes

- **Traffic accounting:** ETW event fields must be interpreted correctly. Connection events alone do not necessarily provide complete byte-level accounting; the selected event sources must expose the necessary byte or transfer information.
- **Session attribution:** PID-to-session mappings can change as processes exit, sessions disconnect, or PIDs are reused. Refresh or invalidate cached mappings accordingly.
- **System traffic:** Services and processes running in session 0 or under shared service accounts may not map directly to an interactive RDS user.
- **Database reliability:** Use batching, retry handling, and appropriate connection limits to prevent database interruptions from affecting event collection.
- **Time synchronization:** Keep RDS hosts and the dashboard server synchronized to make timestamps and host comparisons meaningful.
- **Security:** Protect database credentials, restrict network access, and authenticate dashboard access if the dashboard exposes user-level activity to administrators.
- **Privacy:** Per-user network monitoring can expose sensitive activity. Apply appropriate access controls, retention policies, and organizational monitoring policies.

## Development

Build the Rust workspace:

```bash
cargo build --workspace
```

Run frontend development mode:

```bash
cd dashboard/frontend
npm run dev
```

Run the dashboard in development mode:

```bash
cargo run --release -p dashboard
```

The frontend development server may require a Vite proxy configuration to forward API requests to the Rust server.

## License

Add your chosen license here before distributing the project.
