export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  
  const b = Number(bytes);
  if (isNaN(b)) return "0 B";

  // Added PB and EB so it never goes out of bounds
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  
  let i = Math.floor(Math.log(b) / Math.log(1024));
  i = Math.max(0, Math.min(i, units.length - 1));

  const value = b / Math.pow(1024, i);
  const unit = units[i];

  // If it's a huge number, just round it to 0 decimals
  const formattedValue = value.toFixed(0);

  return `${formattedValue} ${unit}`;
}

export function formatRelativeTime(epochSeconds) {
  const diffSec = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}