import { formatBytes } from "../utils/format.js";

export function StatCards({ users }) {
  const totalSent = users.reduce((acc, u) => acc + u.bytes_sent, 0);
  const totalRecv = users.reduce((acc, u) => acc + u.bytes_recv, 0);
  const uniqueUsers = users.length;
  
  const cards = [
    { label: "ACTIVE_USERS", value: uniqueUsers, color: "text-[#00ffff]" },
    { label: "UPLINK_TOTAL", value: formatBytes(totalSent), color: "text-yellow-500" },
    { label: "DOWNLINK_TOTAL", value: formatBytes(totalRecv), color: "text-[#00ff41]" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="border border-[#222] bg-black p-3 flex flex-col justify-center">
          <div className="text-xs text-gray-500 mb-1">{c.label}</div>
          <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}