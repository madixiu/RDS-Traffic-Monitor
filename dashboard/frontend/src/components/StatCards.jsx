import { formatBytes } from "../utils/format.js";

export function StatCards({ users }) {
  const totalSent = users.reduce((acc, u) => acc + u.bytes_sent, 0);
  const totalRecv = users.reduce((acc, u) => acc + u.bytes_recv, 0);
  const uniqueUsers = new Set(users.map((u) => u.username)).size;
  const uniqueHosts = new Set(users.map((u) => u.hostname)).size;

  const cards = [
    { label: "Active Users", value: uniqueUsers.toString(), accent: "text-sky-400" },
    { label: "Active Hosts", value: uniqueHosts.toString(), accent: "text-emerald-400" },
    { label: "Total Upload", value: formatBytes(totalSent), accent: "text-amber-400" },
    { label: "Total Download", value: formatBytes(totalRecv), accent: "text-violet-400" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl bg-card border border-edge p-5 shadow-sm"
        >
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {c.label}
          </div>
          <div className={`mt-2 text-2xl font-semibold ${c.accent}`}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}