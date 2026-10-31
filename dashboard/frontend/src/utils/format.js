export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const b = Number(bytes);
  if (isNaN(b)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = Math.floor(Math.log(b) / Math.log(1024));
  i = Math.max(0, Math.min(i, units.length - 1));
  const value = b / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatRelativeTime(epochSeconds) {
  if (!epochSeconds) return "Never";
  const diffSec = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}