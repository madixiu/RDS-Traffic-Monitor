import { useMemo, useState } from "react";
import { formatBytes, formatRelativeTime } from "../utils/format.js";
import { fetchUserHistory } from "../api/client.js";
import { X, Activity, Search } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#00ff41", "#00ffff", "#ff00ff", "#ffb000", "#ff0000", "#0088ff"];

export function TrafficTable({ users, start, end }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  // 1. Sort users globally to calculate rankings
  const sortedUsers = useMemo(() => [...users].sort((a, b) => b.bytes_recv - a.bytes_recv), [users]);

  const openUser = async (username) => {
    setSelectedUser(username);
    setModalSearch("");
    setLoading(true);
    try {
      const data = await fetchUserHistory(username, start, end);
      setHistory(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // 2. Find the user's rank and stats
  const userRank = selectedUser ? sortedUsers.findIndex(u => u.username === selectedUser) + 1 : 0;
  const userStats = selectedUser ? sortedUsers.find(u => u.username === selectedUser) : null;

  // 3. Filter the history based on the modal's search bar
  const filteredHistory = history.filter(h => 
    h.website.toLowerCase().includes(modalSearch.toLowerCase()) || 
    h.process_name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  if (users.length === 0) return <div className="p-8 text-center text-gray-600 border border-[#222] font-mono">NO_TRAFFIC_DETECTED</div>;

  return (
    <>
      <div className="border border-[#222] bg-black overflow-hidden font-mono text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[#111] text-xs text-gray-400 border-b border-[#222]">
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
            <tbody className="divide-y divide-[#1a1a1a]">
              {sortedUsers.map((u, index) => (
                <tr 
                  key={u.username} 
                  onClick={() => openUser(u.username)} 
                  className="hover:bg-[#111] cursor-pointer transition-colors"
                >
                  <td className="px-3 py-1.5 text-gray-500 text-xs">#{index + 1}</td>
                  <td className="px-3 py-1.5 text-[#00ffff]">{u.username}</td>
                  <td className="px-3 py-1.5 text-gray-600 text-xs">{u.hostname}</td>
                  <td className="px-3 py-1.5 text-right text-yellow-500">{formatBytes(u.bytes_sent)}</td>
                  <td className="px-3 py-1.5 text-right text-[#00ff41] font-bold">{formatBytes(u.bytes_recv)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-500">{u.process_count}</td>
                  <td className="px-3 py-1.5 text-right text-gray-600 text-xs">{formatRelativeTime(u.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL SCREEN TERMINAL MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono">
          <div className="bg-black border border-[#00ff41] shadow-[0_0_20px_rgba(0,255,65,0.15)] w-full max-w-6xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-3 border-b border-[#222] flex justify-between items-center bg-[#0a0a0a]">
              <div className="flex items-center gap-3">
                <Activity size={18} className="text-[#00ff41]" />
                <span className="text-white font-bold text-lg">{selectedUser}</span>
                <span className="text-[#00ff41] text-xs bg-[#00ff41]/10 px-2 py-1 border border-[#00ff41]/30">
                  RANK: #{userRank} of {sortedUsers.length}
                </span>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-[#ff0000] transition-colors p-1"><X size={20} /></button>
            </div>
            
            {/* Stats Bar */}
            {userStats && (
              <div className="grid grid-cols-4 border-b border-[#222] bg-[#050505] text-xs">
                <div className="p-3 border-r border-[#222]">
                  <div className="text-gray-500 mb-1">HOSTS</div>
                  <div className="text-[#00ffff] truncate">{userStats.hostname}</div>
                </div>
                <div className="p-3 border-r border-[#222]">
                  <div className="text-gray-500 mb-1">TOTAL UPLOAD</div>
                  <div className="text-yellow-500">{formatBytes(userStats.bytes_sent)}</div>
                </div>
                <div className="p-3 border-r border-[#222]">
                  <div className="text-gray-500 mb-1">TOTAL DOWNLOAD</div>
                  <div className="text-[#00ff41]">{formatBytes(userStats.bytes_recv)}</div>
                </div>
                <div className="p-3">
                  <div className="text-gray-500 mb-1">UNIQUE DOMAINS</div>
                  <div className="text-white">{history.length}</div>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 overflow-hidden flex-1 flex flex-col md:flex-row gap-4">
              
              {/* Left: Pie Chart */}
              <div className="w-full md:w-1/3 flex flex-col border-r border-[#222] pr-4">
                <h4 className="text-xs text-gray-500 mb-2">// TOP_DOMAINS_BY_TRAFFIC</h4>
                <div className="h-64 flex-1">
                  {!loading && history.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={history.slice(0, 7)} dataKey="bytes_recv" nameKey="website" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                          {history.slice(0, 7).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#000" />)}
                        </Pie>
                        <Tooltip formatter={(value) => formatBytes(value)} contentStyle={{ backgroundColor: '#000', borderColor: '#00ff41', color: '#00ff41', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Right: Full Domain Table with Filter */}
              <div className="w-full md:w-2/3 flex flex-col overflow-hidden">
                <div className="flex justify-between items-end mb-2">
                  <h4 className="text-xs text-gray-500">// FULL_BROWSING_HISTORY</h4>
                  
                  {/* Internal Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" size={12} />
                    <input
                      type="text"
                      placeholder="filter domains..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="bg-[#050505] border border-[#333] pl-7 pr-2 py-1 text-xs text-[#00ff41] focus:outline-none focus:border-[#00ff41] w-48"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border border-[#222]">
                  {loading ? (
                    <div className="p-4 text-[#00ff41] animate-pulse">FETCHING_DATA...</div>
                  ) : filteredHistory.length === 0 ? (
                    <div className="p-4 text-gray-600">NO_MATCHES_FOUND</div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="text-gray-500 border-b border-[#222] bg-[#0a0a0a] sticky top-0 backdrop-blur-sm">
                        <tr>
                          <th className="px-2 py-2 font-normal">DOMAIN</th>
                          <th className="px-2 py-2 font-normal">PROCESS</th>
                          <th className="px-2 py-2 font-normal">HOST</th>
                          <th className="px-2 py-2 font-normal text-right">UPLOAD</th>
                          <th className="px-2 py-2 font-normal text-right">DOWNLOAD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#111]">
                        {filteredHistory.map((h, i) => (
                          <tr key={i} className="hover:bg-[#111]">
                            <td className="px-2 py-1.5 text-[#00ffff] truncate max-w-[150px]">{h.website}</td>
                            <td className="px-2 py-1.5 text-gray-500">{h.process_name}</td>
                            <td className="px-2 py-1.5 text-gray-600">{h.hostname}</td>
                            <td className="px-2 py-1.5 text-right text-yellow-500">{formatBytes(h.bytes_sent)}</td>
                            <td className="px-2 py-1.5 text-right text-[#00ff41] font-bold">{formatBytes(h.bytes_recv)}</td>
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