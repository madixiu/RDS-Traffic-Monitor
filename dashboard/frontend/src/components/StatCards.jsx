import { formatBytes } from "../utils/format.js";

export function StatCards({ users, live, speed }) {
  const totalSent = users.reduce((acc, u) => acc + u.bytes_sent, 0);
  const totalRecv = users.reduce((acc, u) => acc + u.bytes_recv, 0);
  const uniqueUsers = users.length;
  
  const cards = [
    { label: "ACTIVE_USERS", value: uniqueUsers, color: "text-[var(--secondary)]" },
    { label: "UPLINK_TOTAL", value: formatBytes(totalSent), color: "text-[var(--warning)]" },
    { label: "DOWNLINK_TOTAL", value: formatBytes(totalRecv), color: "text-[var(--accent)]" },
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${live ? "xl:grid-cols-5" : "lg:grid-cols-3"} gap-4`}>
      {cards.map((c) => (
        <div key={c.label} className="border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col justify-center">
          <div className="text-xs text-[var(--muted)] mb-1">{c.label}</div>
          <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
        </div>
      ))}
      {live && [
        { label: "UPLOAD SPEED (EST.)", value: speed ? `${formatBytes(speed.sent)}/s` : "—", color: "text-[var(--warning)]" },
        { label: "DOWNLOAD SPEED (EST.)", value: speed ? `${formatBytes(speed.received)}/s` : "—", color: "text-[var(--accent)]" },
      ].map((c) => (
        <div key={c.label} className="border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col justify-center">
          <div className="text-xs text-[var(--muted)] mb-1">{c.label}</div>
          <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          <div className="text-xs text-[var(--muted)] mt-1">Approx. since last update</div>
        </div>
      ))}
    </div>
  );
}