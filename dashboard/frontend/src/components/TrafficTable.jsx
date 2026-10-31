import { Fragment, useMemo, useState } from "react";
import { formatBytes, formatRelativeTime } from "../utils/format.js";
import { fetchWebsites } from "../api/client.js";
import { ChevronDown, ChevronRight, Globe, Activity } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = [
  "#38bdf8",
  "#818cf8",
  "#c084fc",
  "#e879f9",
  "#f472b6",
  "#fbbf24",
  "#34d399",
];

export function TrafficTable({ users, start, end }) {
  const [expandedUser, setExpandedUser] = useState(null);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggleUser = async (username) => {
    if (expandedUser === username) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(username);
    setLoading(true);
    try {
      const data = await fetchWebsites(username, start, end);

      const sorted = data.sort(
        (a, b) => b.bytes_recv + b.bytes_sent - (a.bytes_recv + a.bytes_sent),
      );
      const top = sorted.slice(0, 7);
      const other = sorted.slice(7).reduce(
        (acc, curr) => ({
          website: "Other",
          bytes_sent: acc.bytes_sent + curr.bytes_sent,
          bytes_recv: acc.bytes_recv + curr.bytes_recv,
        }),
        { website: "Other", bytes_sent: 0, bytes_recv: 0 },
      );

      setWebsites(other.bytes_recv > 0 ? [...top, other] : top);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => b.bytes_recv - a.bytes_recv);
  }, [users]);

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 shadow-lg">
        <Activity size={48} className="mb-4 text-slate-600 opacity-50" />
        <p className="text-lg font-medium text-slate-300">No traffic data</p>
        <p className="text-sm mt-1">
          Try changing the time filter or wait for new traffic.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-800/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-4 w-12"></th>
              <th className="px-4 py-4 font-semibold">User</th>
              <th className="px-4 py-4 font-semibold">Host</th>
              <th className="px-4 py-4 font-semibold text-right">Upload</th>
              <th className="px-4 py-4 font-semibold text-right">Download</th>
              <th className="px-4 py-4 font-semibold text-right">Processes</th>
              <th className="px-4 py-4 font-semibold text-right">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sorted.map((u) => (
              // Use Fragment to prevent invalid HTML nesting issues
              <Fragment key={u.username}>
                <tr
                  onClick={() => toggleUser(u.username)}
                  className={`cursor-pointer transition-colors ${expandedUser === u.username ? "bg-slate-800/60" : "hover:bg-slate-800/40"}`}
                >
                  <td className="px-4 py-4 text-slate-500 text-center">
                    {expandedUser === u.username ? (
                      <ChevronDown size={18} className="text-sky-400" />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-100 whitespace-nowrap flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shadow-inner shrink-0">
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                    {u.username}
                  </td>
                  <td className="px-4 py-4 text-slate-300">
                    <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs font-mono">
                      {u.hostname}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-amber-400 whitespace-nowrap">
                    {formatBytes(u.bytes_sent)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-emerald-400 whitespace-nowrap">
                    {formatBytes(u.bytes_recv)}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-400 whitespace-nowrap">
                    {u.process_count}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-500 text-xs whitespace-nowrap">
                    {formatRelativeTime(u.last_seen)}
                  </td>
                </tr>

                {/* Expanded Details Area */}
                {expandedUser === u.username && (
                  <tr className="bg-slate-900/50 border-b border-slate-800">
                    <td colSpan="6" className="p-0">
                      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-slate-900/40">
                        {/* Pie Chart */}
                        <div className="col-span-1 flex flex-col">
                          <h4 className="text-xs font-semibold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-wider">
                            <Globe size={14} className="text-sky-400" /> Top
                            Domains
                          </h4>
                          {loading ? (
                            <div className="h-56 bg-slate-800/30 rounded-lg animate-pulse flex items-center justify-center text-slate-500 text-sm">
                              Loading chart...
                            </div>
                          ) : websites.length === 0 ? (
                            <div className="h-56 bg-slate-800/30 rounded-lg flex items-center justify-center text-slate-500 text-sm">
                              No domain data
                            </div>
                          ) : (
                            <div className="h-56 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={websites}
                                    dataKey="bytes_recv"
                                    nameKey="website"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={2}
                                  >
                                    {websites.map((entry, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        stroke="#0f172a"
                                        strokeWidth={2}
                                      />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    formatter={(value) => formatBytes(value)}
                                    contentStyle={{
                                      backgroundColor: "#1e293b",
                                      borderColor: "#334155",
                                      borderRadius: "8px",
                                      color: "#f8fafc",
                                    }}
                                    itemStyle={{ color: "#f8fafc" }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>

                        {/* Detailed List */}
                        <div className="col-span-1 lg:col-span-2 flex flex-col">
                          <h4 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
                            Domain Breakdown
                          </h4>
                          {loading ? (
                            <div className="text-slate-500 text-sm">
                              Loading details...
                            </div>
                          ) : (
                            <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                              <div className="max-h-56 overflow-y-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-800/80 text-xs text-slate-400 sticky top-0 backdrop-blur-sm">
                                    <tr>
                                      <th className="px-4 py-2 text-left">
                                        Domain
                                      </th>
                                      <th className="px-4 py-2 text-right">
                                        Upload
                                      </th>
                                      <th className="px-4 py-2 text-right">
                                        Download
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-700/50">
                                    {websites.map((w, i) => (
                                      <tr
                                        key={w.website}
                                        className="hover:bg-slate-800/50 transition-colors"
                                      >
                                        <td className="px-4 py-2.5 font-mono text-sky-300 flex items-center gap-2 whitespace-nowrap">
                                          <div
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{
                                              backgroundColor:
                                                COLORS[i % COLORS.length],
                                            }}
                                          ></div>
                                          {w.website}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-amber-400/80 whitespace-nowrap">
                                          {formatBytes(w.bytes_sent)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400/80 whitespace-nowrap">
                                          {formatBytes(w.bytes_recv)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
