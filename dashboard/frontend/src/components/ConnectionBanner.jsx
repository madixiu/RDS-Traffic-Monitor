export function ConnectionBanner({ isLive, isHistorical }) {
  if (isHistorical) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
        <span className="text-amber-400 font-medium">Historical View</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-block w-2 h-2 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
      <span className={isLive ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
        {isLive ? "Live" : "Disconnected"}
      </span>
    </div>
  );
}