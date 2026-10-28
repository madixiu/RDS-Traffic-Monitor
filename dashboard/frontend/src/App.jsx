import { useEffect, useMemo, useState } from "react";
import { subscribeUsers, fetchUsers } from "./api/client.js";
import { StatCards } from "./components/StatCards.jsx";
import { TrafficTable } from "./components/TrafficTable.jsx";
import { HostFilter } from "./components/HostFilter.jsx";
import { ConnectionBanner } from "./components/ConnectionBanner.jsx";

export default function App() {
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [hostFilter, setHostFilter] = useState(null);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .catch((err) => console.warn("initial fetch failed:", err));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (data) => {
        setUsers(data);
        setConnected(true);
      },
      () => setConnected(false)
    );
    return unsubscribe;
  }, []);

  const hosts = useMemo(
    () => Array.from(new Set(users.map((u) => u.hostname))).sort(),
    [users]
  );

  const filtered = useMemo(
    () => (hostFilter ? users.filter((u) => u.hostname === hostFilter) : users),
    [users, hostFilter]
  );

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">RDS Traffic — Live</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time per-user bandwidth across all RDS hosts
          </p>
        </div>
        <div className="flex items-center gap-6">
          <ConnectionBanner connected={connected} />
          <HostFilter hosts={hosts} selected={hostFilter} onChange={setHostFilter} />
        </div>
      </header>

      <section className="mb-6">
        <StatCards users={filtered} />
      </section>

      <section>
        <TrafficTable users={filtered} />
      </section>

      <footer className="mt-8 text-xs text-slate-500 text-center">
        Updates every 2 seconds via Server-Sent Events · Window: last 60 minutes
      </footer>
    </div>
  );
}