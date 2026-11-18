import { useMemo, useRef, useState } from "react";
import { formatBytes, formatRelativeTime } from "../utils/format.js";
import { fetchUserHistory } from "../api/client.js";
import { X, Activity, Search } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["var(--accent)", "var(--secondary)", "#ff00ff", "#ffb000", "#ff0000", "#0088ff"];

export function TrafficTable({ users, start, end }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [historyError, setHistoryError] = useState("");
  const requestId = useRef(0);

  // 1. Sort users globally to calculate rankings
  const sortedUsers = useMemo(() => [...users].sort((a, b) => b.bytes_recv - a.bytes_recv), [users]);

  const openUser = async (username) => {
    const id = ++requestId.current;
    setSelectedUser(username);
    setModalSearch("");
    setHistory([]);
    setHistoryError("");
    setLoading(true);
    try {
      const data = await fetchUserHistory(username, start, end);
      if (requestId.current === id) setHistory(data);
    } catch (e) {
      if (requestId.current === id) setHistoryError(`Could not load user details: ${e.message}`);
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  };

  const closeUser = () => {
    requestId.current++;
    setSelectedUser(null);
  };

  // 2. Find the user's rank and stats
  const userRank = selectedUser ? sortedUsers.findIndex(u => u.username === selectedUser) + 1 : 0;
  const userStats = selectedUser ? sortedUsers.find(u => u.username === selectedUser) : null;

  // 3. Filter the history based on the modal's search bar
  const filteredHistory = history.filter(h => 
    (h.website ?? "").toLowerCase().includes(modalSearch.toLowerCase()) ||
    h.process_name.toLowerCase().includes(modalSearch.toLowerCase())
  );
  const domainChart = useMemo(() => {
    const totals = new Map();
    for (const row of history) {
      const domain = row.website || "Unknown";
      totals.set(domain, (totals.get(domain) || 0) + row.bytes_sent + row.bytes_recv);
    }
    return [...totals].map(([website, total]) => ({ website, total }))
      .sort((a, b) => b.total - a.total).slice(0, 7);
  }, [history]);

  if (users.length === 0) return <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] font-mono">NO_TRAFFIC_DETECTED</div>;

  return (
    <>
      <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden font-mono text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[var(--surface-alt)] text-xs text-[var(--muted)] border-b border-[var(--border)]">
              <tr>
                <th className="px-3 py-2 font-normal">RANK</th>
                <th className="px-3 py-2 font-normal">USER</th>
                <th className="px-3 py-2 font-normal">HOSTS</th>
                <th className="px-3 py-2 font-normal text-right">UPLOAD</th>
                <th className="px-3 py-2 font-normal text-right">DOWNLOAD</th>
                <th className="px-3 py-2 font-normal text-right">PROCS</th>
                <th className="px-3 py-2 font-normal text-right">LAST_SEEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sortedUsers.map((u, index) => (
                <tr key={u.username} onClick={() => openUser(u.username)} className="hover:bg-[var(--surface-alt)] cursor-pointer transition-colors">
                  <td className="px-2 py-1 text-[var(--muted)]">#{index + 1}</td>
                  <td className="px-2 py-1 text-[var(--secondary)]"><button className="hover:underline text-left">{u.username}</button></td>
                  <td className="px-2 py-1 text-[var(--muted)]">{u.hostname}</td>
                  <td className="px-2 py-1 text-right text-[var(--warning)]">{formatBytes(u.bytes_sent)}</td>
                  <td className="px-2 py-1 text-right text-[var(--accent)] font-bold">{formatBytes(u.bytes_recv)}</td>
                  <td className="px-2 py-1 text-right text-[var(--muted)]">{u.process_count}</td>
                  <td className="px-2 py-1 text-right text-[var(--muted)]">{formatRelativeTime(u.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL SCREEN TERMINAL MODAL */}
      {selectedUser && (
        <div onClick={(event) => { if (event.target === event.currentTarget) closeUser(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono">
          <div className="bg-[var(--surface)] border border-[var(--accent)] shadow-[0_0_20px_rgba(0,255,65,0.15)] w-full max-w-6xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-3 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-alt)]">
              <div className="flex items-center gap-3">
                <Activity size={18} className="text-[var(--accent)]" />
                <span className="text-[var(--text)] font-bold text-lg">{selectedUser}</span>
                <span className="text-[var(--accent)] text-xs bg-[var(--accent)]/10 px-2 py-1 border border-[var(--accent)]/30">
                  RANK: #{userRank} of {sortedUsers.length}
                </span>
              </div>
              <button aria-label="Close user details" onClick={closeUser} className="text-[var(--muted)] hover:text-[#ff0000] transition-colors p-1"><X size={20} /></button>
            </div>
            
            {/* Stats Bar */}
            {userStats && (
              <div className="grid grid-cols-4 border-b border-[var(--border)] bg-[var(--background)] text-xs">
                <div className="p-3 border-r border-[var(--border)]">
                  <div className="text-[var(--muted)] mb-1">HOSTS</div>
                  <div className="text-[var(--secondary)] truncate">{userStats.hostname}</div>
                </div>
                <div className="p-3 border-r border-[var(--border)]">
                  <div className="text-[var(--muted)] mb-1">TOTAL UPLOAD</div>
                  <div className="text-[var(--warning)]">{formatBytes(userStats.bytes_sent)}</div>
                </div>
                <div className="p-3 border-r border-[var(--border)]">
                  <div className="text-[var(--muted)] mb-1">TOTAL DOWNLOAD</div>
                  <div className="text-[var(--accent)]">{formatBytes(userStats.bytes_recv)}</div>
                </div>
                <div className="p-3">
                  <div className="text-[var(--muted)] mb-1">UNIQUE DOMAINS</div>
                  <div className="text-[var(--text)]">{new Set(history.map((h) => h.website).filter(Boolean)).size}</div>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 overflow-hidden flex-1 flex flex-col md:flex-row gap-4">
              
              {/* Left: Pie Chart */}
              <div className="w-full md:w-1/3 flex flex-col border-r border-[var(--border)] pr-4">
                <h4 className="text-xs text-[var(--muted)] mb-2">// TOP_DOMAINS_BY_TRAFFIC</h4>
                <div className="h-64 flex-1">
                  {!loading && domainChart.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={domainChart} dataKey="total" nameKey="website" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                          {domainChart.map((domain, index) => <Cell key={domain.website} fill={COLORS[index % COLORS.length]} stroke="var(--surface)" />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatBytes(value)} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--accent)', color: 'var(--text)', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Right: Full Domain Table with Filter */}
              <div className="w-full md:w-2/3 flex flex-col overflow-hidden">
                <div className="flex justify-between items-end mb-2">
                  <h4 className="text-xs text-[var(--muted)]">// FULL_BROWSING_HISTORY</h4>
                  
                  {/* Internal Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={12} />
                    <input
                      type="text"
                      placeholder="filter domains..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="bg-[var(--background)] border border-[var(--border)] pl-7 pr-2 py-1 text-xs text-[var(--accent)] focus:outline-none focus:border-[var(--accent)] w-48"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border border-[var(--border)]">
                  {loading ? (
                    <div className="p-4 text-[var(--accent)] animate-pulse">FETCHING_DATA...</div>
                  ) : historyError ? (
                    <div className="error-message" role="alert">{historyError}</div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="p-4 text-[var(--muted)]">NO_MATCHES_FOUND</div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="text-[var(--muted)] border-b border-[var(--border)] bg-[var(--surface-alt)] sticky top-0 backdrop-blur-sm">
                        <tr>
                          <th className="px-2 py-2 font-normal">DOMAIN</th>
                          <th className="px-2 py-2 font-normal">PROCESS</th>
                          <th className="px-2 py-2 font-normal">HOST</th>
                          <th className="px-2 py-2 font-normal text-right">UPLOAD</th>
                          <th className="px-2 py-2 font-normal text-right">DOWNLOAD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-alt)]">
                        {filteredHistory.map((h, i) => (
                          <tr key={i} className="hover:bg-[var(--surface-alt)]">
                            <td className="px-2 py-1.5 text-[var(--secondary)] truncate max-w-[150px]">{h.website}</td>
                            <td className="px-2 py-1.5 text-[var(--muted)]">{h.process_name}</td>
                            <td className="px-2 py-1.5 text-[var(--muted)]">{h.hostname}</td>
                            <td className="px-2 py-1.5 text-right text-[var(--warning)]">{formatBytes(h.bytes_sent)}</td>
                            <td className="px-2 py-1.5 text-right text-[var(--accent)] font-bold">{formatBytes(h.bytes_recv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}