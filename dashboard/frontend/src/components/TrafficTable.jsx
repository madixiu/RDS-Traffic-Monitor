import { useMemo, useState } from "react";
import { formatBytes, formatRelativeTime } from "../utils/format.js";

export function TrafficTable({ users }) {
  const [sortKey, setSortKey] = useState("bytes_recv");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return sortDesc ? bv - av : av - bv;
    });
    return copy;
  }, [users, sortKey, sortDesc]);

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const header = (key, label, align = "text-left") => (
    <th
      className={`px-4 py-3 ${align} text-xs font-semibold uppercase tracking-wide
                  text-slate-400 cursor-pointer select-none hover:text-slate-200`}
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortKey === key && <span className="ml-1">{sortDesc ? "▼" : "▲"}</span>}
    </th>
  );

  if (users.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-edge p-8 text-center text-slate-500">
        Waiting for traffic data…
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-edge overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50">
            <tr>
              {header("username", "User")}
              {header("hostname", "Host")}
              {header("bytes_sent", "Upload", "text-right")}
              {header("bytes_recv", "Download", "text-right")}
              {header("process_count", "Procs", "text-right")}
              {header("last_seen", "Last Seen", "text-right")}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {sorted.map((u) => (
              <tr
                key={`${u.username}::${u.hostname}`}
                className="hover:bg-slate-800/40 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-slate-100">{u.username}</td>
                <td className="px-4 py-3 text-slate-300">
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-700/50 text-xs font-mono">
                    {u.hostname}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-amber-400 tabular-nums">
                  {formatBytes(u.bytes_sent)}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">
                  {formatBytes(u.bytes_recv)}
                </td>
                <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                  {u.process_count}
                </td>
                <td className="px-4 py-3 text-right text-slate-400 text-xs tabular-nums">
                  {formatRelativeTime(u.last_seen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}