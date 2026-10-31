import { useEffect, useState } from "react";
import { fetchAllTimeReports, fetchTopDomains, searchDomainUsers } from "../api/client.js";
import { formatBytes } from "../utils/format.js";
import { FileText, Search, Globe, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function Reports() {
  const [users, setUsers] = useState([]);
  const [topDomains, setTopDomains] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load Initial Data
  useEffect(() => {
    fetchAllTimeReports().then(setUsers).catch(console.error);
    fetchTopDomains().then(setTopDomains).catch(console.error);
  }, []);

  // Handle Domain Search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchDomainUsers(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Prepare data for the Bar Chart (Relative to highest user)
  const maxUsage = Math.max(...users.map(u => u.bytes_recv + u.bytes_sent), 1);
  const chartData = users.slice(0, 10).map(u => ({
    name: u.username,
    total: u.bytes_recv + u.bytes_sent,
    percentage: Math.round(((u.bytes_recv + u.bytes_sent) / maxUsage) * 100)
  }));

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 space-y-8 pb-12">
      
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <FileText className="text-sky-400" /> All-Time Traffic Reports
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Lifetime data aggregated from the daily rollup table.
        </p>
      </header>

      {/* Top Section: Chart and Domain Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* User Usage Comparison Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col">
          <h2 className="text-sm font-semibold text-slate-300 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <TrendingUp size={16} className="text-emerald-400" /> Top 10 Users (Relative Usage)
          </h2>
          <div className="flex-1 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  formatter={(value) => [`${value}%`, "Relative Usage"]}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                />
                <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={16}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#38bdf8" : "#4f46e5"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Domains Leaderboard */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col">
          <h2 className="text-sm font-semibold text-slate-300 mb-6 flex items-center gap-2 uppercase tracking-wider">
            <Globe size={16} className="text-sky-400" /> Top 10 Most Visited Domains
          </h2>
          <div className="flex-1 overflow-y-auto pr-2">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-semibold">Domain</th>
                  <th className="pb-3 font-semibold text-right">Total Traffic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {topDomains.map((d, i) => (
                  <tr key={d.website} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-mono text-sky-300 flex items-center gap-3">
                      <span className="text-slate-500 text-xs w-4">{i + 1}.</span> {d.website}
                    </td>
                    <td className="py-3 text-right font-mono text-emerald-400">
                      {formatBytes(d.bytes_sent + d.bytes_recv)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section: Domain Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">
            Domain Search & Investigation
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Enter a domain (e.g., youtube.com, google.com)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {/* Search Results Table */}
        {searchQuery && (
          <div className="p-6">
            {searchResults.length === 0 && !isSearching ? (
              <div className="text-center text-slate-500 py-8">No users found for this domain.</div>
            ) : searchResults.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold text-right">Upload</th>
                    <th className="pb-3 font-semibold text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {searchResults.map((u) => (
                    <tr key={u.username} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 font-medium text-slate-200">{u.username}</td>
                      <td className="py-3 text-right font-mono text-amber-400/90">{formatBytes(u.bytes_sent)}</td>
                      <td className="py-3 text-right font-mono text-emerald-400/90">{formatBytes(u.bytes_recv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}