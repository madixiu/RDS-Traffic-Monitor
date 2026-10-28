export function ConnectionBanner({ connected }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
        }`}
      />
      <span className={connected ? "text-emerald-400" : "text-red-400"}>
        {connected ? "Live" : "Disconnected"}
      </span>
    </div>
  );
}