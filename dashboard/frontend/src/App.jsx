import { useEffect, useMemo, useState, useCallback } from "react";
import { subscribeUsers, fetchUsers } from "./api/client.js";
import { StatCards } from "./components/StatCards.jsx";
import { TrafficTable } from "./components/TrafficTable.jsx";
import { ConnectionBanner } from "./components/ConnectionBanner.jsx";
import { Reports } from "./components/Reports.jsx"; // NEW
import { Clock, LayoutDashboard, FileText, RefreshCw } from "lucide-react";

const TIME_FILTERS = [
  { label: "Last 1 Hour", value: 3600 },
  { label: "Last 24 Hours", value: 86400 },
  { label: "Last 7 Days", value: 604800 },
  { label: "Last 30 Days", value: 2592000 },
  { label: "All Time", value: 0 },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard"); // "dashboard" | "reports"
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [timeRange, setTimeRange] = useState(TIME_FILTERS[0].value);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { start, end } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return { start: timeRange === 0 ? 0 : now - timeRange, end: now };
  }, [timeRange]);

  const loadData = useCallback(() => {
    setIsRefreshing(true);
    fetchUsers(start, end)
      .then(setUsers)
      .catch(console.error)
      .finally(() => setIsRefreshing(false));
  }, [start, end]);

  useEffect(() => {
    if (currentPage !== "dashboard") return;

    if (timeRange === 3600) {
      const unsubscribe = subscribeUsers(
        (data) => { setUsers(data); setConnected(true); },
        () => setConnected(false)
      );
      return unsubscribe;
    } else {
      loadData();
    }
  }, [timeRange, loadData, currentPage]);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 hidden md:flex shrink-0">
        <div className="flex items-center gap-3 text-xl font-bold text-sky-400">
          <LayoutDashboard /> RDS Monitor
        </div>
        <nav className="flex flex-col gap-2">
          <button onClick={() => setCurrentPage("dashboard")} className={`px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${currentPage === "dashboard" ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
            <LayoutDashboard size={18} /> Live Dashboard
          </button>
          <button onClick={() => setCurrentPage("reports")} className={`px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${currentPage === "reports" ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
            <FileText size={18} /> All-Time Reports
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8 min-w-0">
        {currentPage === "dashboard" ? (
          <>
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">Traffic Analytics</h1>
                <p className="text-sm text-slate-400 mt-1">Click on any user to see their website breakdown.</p>
              </div>
              
              <div className="flex items-center gap-4">
                <ConnectionBanner isLive={connected} isHistorical={timeRange !== 3600} />
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-sm">
                  <Clock size={16} className="text-slate-400" />
                  <select className="bg-transparent text-sm focus:outline-none cursor-pointer text-white font-medium" value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))}>
                    {TIME_FILTERS.map(t => <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>)}
                  </select>
                </div>
                {timeRange !== 3600 && (
                  <button onClick={loadData} disabled={isRefreshing} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
                    <RefreshCw size={18} className={`text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </header>
            <section className="mb-6"><StatCards users={users} /></section>
            <section><TrafficTable users={users} start={start} end={end} /></section>
          </>
        ) : (
          <Reports />
        )}
      </main>
    </div>
  );
}