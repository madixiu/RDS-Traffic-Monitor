import { useEffect, useState } from "react";
import { subscribeUsers, fetchUsers } from "./api/client.js";
import { StatCards } from "./components/StatCards.jsx";
import { TrafficTable } from "./components/TrafficTable.jsx";
import { ConnectionBanner } from "./components/ConnectionBanner.jsx";
import { Reports } from "./components/Reports.jsx";
import { FileText, LayoutDashboard, RefreshCw, TerminalSquare } from "lucide-react";
import { estimateLiveSpeed } from "./utils/liveSpeed.js";

const TIME_FILTERS = [
  { label: "15m", value: 900 },
  { label: "30m", value: 1800 },
  { label: "1h", value: 3600 },
  { label: "3h", value: 10800 },
  { label: "6h", value: 21600 },
  { label: "12h", value: 43200 },
  { label: "24h", value: 86400 },
  { label: "7d", value: 604800 },
  { label: "30d", value: 2592000 },
  { label: "90d", value: 7776000 },
  { label: "All", value: 0 },
];

const THEMES = ["Terminal", "Dracula", "Nord", "Light"];

function getWindow(seconds) {
  const end = Math.floor(Date.now() / 1000);
  return { start: seconds ? end - seconds : 0, end };
}

export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [timeRange, setTimeRange] = useState(900);
  const [window, setWindow] = useState(() => getWindow(900));
  const [speed, setSpeed] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("rds-theme");
    return THEMES.includes(saved) ? saved : "Terminal";
  });

  useEffect(() => {
    localStorage.setItem("rds-theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    let previousSample = null;
    let speedTimeout;
    const bounds = getWindow(timeRange);
    setWindow(bounds);
    setError("");
    setConnected(false);
    setHasLiveData(false);
    setSpeed(null);
    if (currentPage !== "dashboard") {
      setLoading(false);
      return () => { active = false; };
    }

    setUsers([]);
    if (timeRange === 900 || timeRange === 3600) {
      setLoading(false);
      const unsubscribe = subscribeUsers(
        (data) => {
          if (!active) return;
          setUsers(data);
          setWindow(getWindow(timeRange));
          setConnected(true);
          setHasLiveData(true);
          setError("");
        },
        () => {
          if (!active) return;
          setConnected(false);
          setSpeed(null);
          previousSample = null;
          clearTimeout(speedTimeout);
        },
        timeRange,
        (buckets) => {
          if (!active) return;
          const now = performance.now();
          setSpeed(previousSample ? estimateLiveSpeed(previousSample.buckets, buckets, (now - previousSample.time) / 1000) : null);
          previousSample = { buckets, time: now };
          clearTimeout(speedTimeout);
          speedTimeout = setTimeout(() => { previousSample = null; setSpeed(null); }, 10000);
        }
      );
      return () => { active = false; clearTimeout(speedTimeout); unsubscribe(); };
    }

    setLoading(true);
    fetchUsers(bounds.start, bounds.end)
      .then((data) => { if (active) setUsers(data); })
      .catch((err) => { if (active) setError(`Could not load traffic: ${err.message}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [timeRange, refresh, currentPage]);

  const live = currentPage === "dashboard" && (timeRange === 900 || timeRange === 3600);

  return (
    <div data-theme={theme.toLowerCase()} className="app-shell min-h-screen font-mono text-sm">
      <header className="topbar">
        <div className="brand"><TerminalSquare size={19} /> <span>RDS_MON</span></div>
        <div className="topbar-actions">
          <button className="toolbar-button" onClick={() => setCurrentPage(currentPage === "dashboard" ? "reports" : "dashboard")}>
            {currentPage === "dashboard" ? <><FileText size={15} /> Reports</> : <><LayoutDashboard size={15} /> Dashboard</>}
          </button>
          <label className="theme-picker">Theme
            <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Color theme">
              {THEMES.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
      </header>

      <main className="main-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">{currentPage === "dashboard" ? "MONITOR / OVERVIEW" : "ANALYZE / REPORTS"}</p>
            <h1>{currentPage === "dashboard" ? "Traffic dashboard" : "Traffic reports"}</h1>
            <p className="page-description">
              {currentPage === "dashboard" ? "Monitor user activity and bandwidth." : "Explore traffic by user and domain for the selected period."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {currentPage === "dashboard" && <ConnectionBanner isLive={connected} isHistorical={!live} />}
            {!live && (
              <button onClick={() => setRefresh((n) => n + 1)} className="toolbar-button" aria-label="Refresh data">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            )}
          </div>
        </div>
        <div className="filter-bar">
          <span className="filter-label">TIME RANGE</span>
          <div className="time-filters" aria-label="Time range">
            {TIME_FILTERS.map((t) => (
              <button key={t.value} onClick={() => setTimeRange(t.value)} aria-pressed={timeRange === t.value} className={timeRange === t.value ? "active" : ""}>
                {t.label}{currentPage === "dashboard" && (t.value === 900 || t.value === 3600) ? " · LIVE" : ""}
              </button>
            ))}
          </div>
          <span className="filter-note">{live ? "Live · rolling window" : "Snapshot · refresh to update"}</span>
        </div>

        {currentPage === "dashboard" ? (
          <>
            {error && <div role="alert" className="error-message">{error}</div>}
            {!error && live && !hasLiveData ? (
              <div className="empty-state">Waiting for live traffic data. Check the connection if this persists.</div>
            ) : !error && <>
              <section className="mb-4"><StatCards users={users} live={live} speed={speed} /></section>
              <div className="section-heading"><h2>User traffic</h2><span>{users.length} users · select a row for details</span></div>
              {loading ? <div className="empty-state">Loading traffic...</div> : <TrafficTable users={users} start={window.start} end={window.end} />}
            </>}
          </>
        ) : <Reports start={window.start} end={window.end} refresh={refresh} />}
      </main>
    </div>
  );
}
