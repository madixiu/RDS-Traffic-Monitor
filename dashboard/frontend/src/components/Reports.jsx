import { useEffect, useState } from "react";
import { fetchAllTimeReports, fetchTopDomains, searchDomainUsers } from "../api/client.js";
import { formatBytes } from "../utils/format.js";
import { Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function Reports() {
  const [users, setUsers] = useState([]);
  const [topDomains, setTopDomains] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    fetchAllTimeReports().then(setUsers).catch(console.error);
    fetchTopDomains().then(setTopDomains).catch(console.error);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const results = await searchDomainUsers(searchQuery);
      setSearchResults(results);
    } catch (err) { console.error(err); }
  };

  const maxUsage = Math.max(...users.map(u => u.bytes_recv + u.bytes_sent), 1);
  const chartData = users.slice(0, 10).map(u => ({
    name: u.username,
    percentage: Math.round(((u.bytes_recv + u.bytes_sent) / maxUsage) * 100)
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <header className="border-b border-[#222] pb-4 mb-4">
        <h1 className="text-xl font-bold text-white tracking-wider flex items-center gap-2">
          <span className="text-[#00ff41]">&gt;</span> ALL_TIME_REPORTS
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="border border-[#222] bg-black p-4">
          <h2 className="text-xs text-gray-400 mb-4">// RELATIVE_USER_USAGE</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 11, fontFamily: 'monospace' }} width={90} />
                <Tooltip cursor={{ fill: '#111' }} contentStyle={{ backgroundColor: '#000', borderColor: '#00ff41', color: '#00ff41', fontSize: '12px' }} formatter={(val) => [`${val}%`, "Usage"]} />
                <Bar dataKey="percentage" radius={[0, 0, 0, 0]} barSize={12}>
                  {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={index === 0 ? "#00ff41" : "#00ffff"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Domains */}
        <div className="border border-[#222] bg-black p-4 flex flex-col">
          <h2 className="text-xs text-gray-400 mb-4">// TOP_DOMAINS</h2>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <tbody className="divide-y divide-[#111]">
                {topDomains.map((d, i) => (
                  <tr key={d.website} className="hover:bg-[#111]">
                    <td className="py-1.5 text-gray-500 w-6">{i + 1}.</td>
                    <td className="py-1.5 text-[#00ffff] truncate max-w-[200px]">{d.website}</td>
                    <td className="py-1.5 text-right text-[#00ff41]">{formatBytes(d.bytes_recv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="border border-[#222] bg-black p-4">
        <h2 className="text-xs text-gray-400 mb-3">// DOMAIN_INVESTIGATION</h2>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
            <input
              type="text"
              placeholder="grep domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#050505] border border-[#333] pl-8 pr-3 py-1.5 text-sm text-[#00ff41] focus:outline-none focus:border-[#00ff41] transition-all font-mono placeholder:text-gray-700"
            />
          </div>
          <button type="submit" className="px-4 py-1.5 border border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41] hover:text-black font-bold text-xs transition-colors">
            EXECUTE
          </button>
        </form>

        {searchQuery && (
          <table className="w-full text-xs text-left">
            <thead className="text-gray-500 border-b border-[#222]">
              <tr>
                <th className="pb-2 font-normal">USER</th>
                <th className="pb-2 font-normal text-right">DOWNLOAD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111]">
              {searchResults.map((u) => (
                <tr key={u.username} className="hover:bg-[#111]">
                  <td className="py-1.5 text-[#00ffff]">{u.username}</td>
                  <td className="py-1.5 text-right text-[#00ff41]">{formatBytes(u.bytes_recv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}