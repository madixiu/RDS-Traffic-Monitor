export function HostFilter({ hosts, selected, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-400">Host:</label>
      <select
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="bg-card border border-edge rounded-md px-3 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <option value="">All hosts</option>
        {hosts.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}