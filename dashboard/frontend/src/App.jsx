import { useEffect, useMemo, useState, useCallback } from "react";
import { subscribeUsers, fetchUsers } from "./api/client.js";
import { StatCards } from "./components/StatCards.jsx";
import { TrafficTable } from "./components/TrafficTable.jsx";
import { ConnectionBanner } from "./components/ConnectionBanner.jsx";
import { Reports } from "./components/Reports.jsx";
import { Clock, LayoutDashboard, FileText, RefreshCw, TerminalSquare } from "lucide-react";

const TIME_FILTERS = [
  { label: "1H", value: 3600 },
  { label: "24H", value: 86400 },
  { label: "7D", value: 604800 },
  { label: "30D", value: 2592000 },
  { label: "ALL", value: 0 },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
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
    <div className="flex min-h-screen bg-[#050505] text-[#00ff41] font-mono text-sm selection:bg-[#00ff41] selection:text-black">
      {/* Sidebar */}
      <aside className="w-56 bg-black border-r border-[#222] p-4 flex flex-col gap-4 hidden md:flex shrink-0">
        <div className="flex items-center gap-2 text-md font-bold text-[#00ffff] tracking-widest uppercase mb-4">
          <TerminalSquare size={18} /> RDS_MON
        </div>
        <nav className="flex flex-col gap-1">
          <button onClick={() => setCurrentPage("dashboard")} className={`text-left px-3 py-2 transition-colors ${currentPage === "dashboard" ? 'bg-[#111] text-[#00ff41] border-l-2 border-[#00ff41]' : 'text-gray-500 hover:text-white'}`}>
            [0] LIVE_FEED
          </button>
          <button onClick={() => setCurrentPage("reports")} className={`text-left px-3 py-2 transition-colors ${currentPage === "reports" ? 'bg-[#111] text-[#00ff41] border-l-2 border-[#00ff41]' : 'text-gray-500 hover:text-white'}`}>
            [1] REPORTS
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6 min-w-0">
        {currentPage === "dashboard" ? (
          <>
            <header className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#222] pb-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
                  <span className="text-[#00ff41]">&gt;</span> TRAFFIC_ANALYTICS
                </h1>
                <p className="text-xs text-gray-500 mt-1">// monitor active sessions and bandwidth</p>
              </div>
              
              <div className="flex items-center gap-4">
                <ConnectionBanner isLive={connected} isHistorical={timeRange !== 3600} />
                
                <div className="flex items-center border border-[#333] bg-black p-1">
                  {TIME_FILTERS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTimeRange(t.value)}
                      className={`px-3 py-1 text-xs transition-colors ${timeRange === t.value ? 'bg-[#00ff41] text-black font-bold' : 'text-gray-400 hover:text-[#00ff41]'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {timeRange !== 3600 && (
                  <button onClick={loadData} disabled={isRefreshing} className="p-1.5 border border-[#333] hover:border-[#00ff41] transition-colors">
                    <RefreshCw size={14} className={`text-[#00ff41] ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </header>
            <section className="mb-4"><StatCards users={users} /></section>
            <section><TrafficTable users={users} start={start} end={end} /></section>
          </>
        ) : (
          <Reports />
        )}
      </main>
    </div>
  );
}