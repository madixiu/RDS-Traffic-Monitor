import { formatBytes } from "../utils/format.js";
import { Users, Server, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function StatCards({ users }) {
  const totalSent = users.reduce((acc, u) => acc + u.bytes_sent, 0);
  const totalRecv = users.reduce((acc, u) => acc + u.bytes_recv, 0);
  const uniqueUsers = new Set(users.map((u) => u.username)).size;
  
  const cards = [
    { label: "Active Users", value: uniqueUsers.toString(), icon: <Users className="text-sky-400" /> },
    { label: "Status", value: users.length > 0 ? "Tracking" : "Idle", icon: <Server className="text-emerald-400" /> },
    { label: "Total Upload", value: formatBytes(totalSent), icon: <ArrowUpRight className="text-amber-400" /> },
    { label: "Total Download", value: formatBytes(totalRecv), icon: <ArrowDownRight className="text-violet-400" /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-lg flex items-center justify-between whitespace-nowrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-white">{c.value}</div>
          </div>
          <div className="p-3 bg-slate-800 rounded-lg shrink-0">{c.icon}</div>
        </div>
      ))}
    </div>
  );
}