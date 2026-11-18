export function subscribeUsers(onData, onError, windowSeconds = 3600, onBuckets) {
  const es = new EventSource(`/api/stream?window=${windowSeconds}`);
  es.addEventListener("users", (e) => {
    try { onData(JSON.parse(e.data)); } catch (err) {
      console.error("Invalid live traffic data", err);
      if (onError) onError(err);
    }
  });
  if (onBuckets) {
    es.addEventListener("traffic_buckets", (e) => {
      try { onBuckets(JSON.parse(e.data)); } catch (err) {
        console.error("Invalid live traffic buckets", err);
        if (onError) onError(err);
      }
    });
  }
  if (onError) es.onerror = onError;
  return () => es.close();
}

export async function fetchUsers(start, end) {
  const res = await fetch(`/api/users?start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchWebsites(username, start, end) {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/websites?start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function fetchUserHistory(username, start, end) {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/history?start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchAllTimeReports() {
  const res = await fetch("/api/reports/all-time");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function fetchTopDomains(start, end) {
  const res = await fetch(`/api/reports/domains?start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchDomainUsers(query, start, end) {
  const res = await fetch(`/api/reports/domain-users?q=${encodeURIComponent(query)}&start=${start}&end=${end}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}