export function subscribeUsers(onData, onError) {
  const es = new EventSource("/api/stream");
  es.addEventListener("users", (e) => {
    try { onData(JSON.parse(e.data)); } catch (err) { console.error(err); }
  });
  if (onError) es.onerror = onError;
  return () => es.close();
}

export async function fetchUsers(start, end) {
  const res = await fetch(`/api/users?start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchWebsites(username, start, end) {
  const res = await fetch(`/api/users/${username}/websites?start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function fetchAllTimeReports() {
  const res = await fetch("/api/reports/all-time");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function fetchTopDomains() {
  const res = await fetch("/api/reports/top-domains");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchDomainUsers(query) {
  const res = await fetch(`/api/reports/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}