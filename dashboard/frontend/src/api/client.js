export function subscribeUsers(onData, onError) {
  const es = new EventSource("/api/stream");

  es.addEventListener("users", (e) => {
    try {
      onData(JSON.parse(e.data));
    } catch (err) {
      console.error("failed to parse SSE payload", err);
    }
  });

  if (onError) {
    es.onerror = onError;
  }

  return () => es.close();
}

export async function fetchHosts() {
  const res = await fetch("/api/hosts");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}