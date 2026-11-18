import { useEffect, useMemo, useState } from "react";
import { fetchUsers, fetchTopDomains, searchDomainUsers } from "../api/client.js";
import { formatBytes } from "../utils/format.js";
import { Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function Reports({ start, end, refresh }) {
  const [users, setUsers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchRevision, setSearchRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setUsers([]);
    setDomains([]);
    Promise.all([fetchUsers(start, end), fetchTopDomains(start, end)])
      .then(([nextUsers, nextDomains]) => {
        if (active) { setUsers(nextUsers); setDomains(nextDomains); }
      })
      .catch((err) => { if (active) setError(`Could not load report: ${err.message}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [start, end, refresh]);

  useEffect(() => {
    if (!submittedQuery) return;
    let active = true;
    setSearchLoading(true);
    setSearchError("");
    setResults([]);
    searchDomainUsers(submittedQuery, start, end)
      .then((data) => { if (active) setResults(data); })
      .catch((err) => { if (active) setSearchError(`Could not search domains: ${err.message}`); })
      .finally(() => { if (active) setSearchLoading(false); });
    return () => { active = false; };
  }, [submittedQuery, start, end, refresh, searchRevision]);

  const totals = useMemo(() => users.reduce((acc, user) => ({
    sent: acc.sent + user.bytes_sent,
    received: acc.received + user.bytes_recv,
  }), { sent: 0, received: 0 }), [users]);
  const chartData = users.slice(0, 10).map((u) => ({
    name: u.username, total: u.bytes_sent + u.bytes_recv,
  }));
  const maxDomain = domains.length ? domains[0].bytes_sent + domains[0].bytes_recv : 0;

  return (
    <div className="report-page">
      {error && <div className="error-message" role="alert">{error}</div>}
      {loading ? <div className="empty-state">Loading report...</div> : !error && <>
        <div className="report-stats">
          {[
            ["TOTAL TRAFFIC", formatBytes(totals.sent + totals.received)],
            ["DOWNLOAD", formatBytes(totals.received)],
            ["UPLOAD", formatBytes(totals.sent)],
            ["USERS", users.length],
          ].map(([label, value]) => <div className="report-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="report-grid">
          <section className="report-panel">
            <div className="panel-heading"><div><h2>Top users</h2><p>Ranked by total traffic</p></div><span>TOP 10</span></div>
            {chartData.length ? <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} width={110} />
                  <Tooltip cursor={{ fill: "var(--surface-alt)" }} contentStyle={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }} formatter={(value) => [formatBytes(value), "Total traffic"]} />
                  <Bar dataKey="total" fill="var(--accent)" barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <div className="empty-state">No traffic in this period.</div>}
          </section>
          <section className="report-panel">
            <div className="panel-heading"><div><h2>Top domains</h2><p>Upload and download combined</p></div><span>TOP 10</span></div>
            {domains.length ? <div className="domain-list">{domains.map((domain, i) => {
              const total = domain.bytes_sent + domain.bytes_recv;
              return <div className="domain-row" key={domain.website}>
                <span className="domain-rank">{String(i + 1).padStart(2, "0")}</span>
                <div className="domain-name"><span title={domain.website}>{domain.website}</span><div className="domain-track"><div style={{ width: `${maxDomain ? total / maxDomain * 100 : 0}%` }} /></div></div>
                <strong>{formatBytes(total)}</strong>
              </div>;
            })}</div> : <div className="empty-state">No domains in this period.</div>}
          </section>
        </div>
        <section className="report-panel">
          <div className="panel-heading"><div><h2>User breakdown</h2><p>All users in the selected period</p></div><span>{users.length} USERS</span></div>
          <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>User</th><th>Hosts</th><th>Upload</th><th>Download</th><th>Total</th><th>Share</th></tr></thead>
            <tbody>{users.map((u) => {
              const total = u.bytes_sent + u.bytes_recv;
              const all = totals.sent + totals.received;
              return <tr key={u.username}><td>{u.username}</td><td>{u.hostname}</td><td>{formatBytes(u.bytes_sent)}</td><td>{formatBytes(u.bytes_recv)}</td><td>{formatBytes(total)}</td><td>{all ? (total / all * 100).toFixed(1) : "0.0"}%</td></tr>;
            })}</tbody></table></div>
          {!users.length && <div className="empty-state">No users in this period.</div>}
        </section>
      </>}
      <section className="report-panel">
        <div className="panel-heading"><div><h2>Domain investigation</h2><p>Find users whose recorded domains contain your search.</p></div></div>
        <form className="search-form" onSubmit={(e) => { e.preventDefault(); const value = query.trim(); if (value) { setSubmittedQuery(value); setSearchRevision((n) => n + 1); } }}>
          <label className="search-input"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a domain..." aria-label="Search a domain" /></label>
          <button type="submit" disabled={!query.trim()}>Search</button>
        </form>
        {searchError && <div className="error-message" role="alert">{searchError}</div>}
        {searchLoading ? <div className="empty-state">Searching...</div> : submittedQuery && !searchError && <>
          <p className="search-caption">Results for “{submittedQuery}” · {results.length} users</p>
          {results.length ? <div className="overflow-x-auto"><table className="report-table"><thead><tr><th>User</th><th>Upload</th><th>Download</th><th>Total</th></tr></thead>
            <tbody>{results.map((u) => <tr key={u.username}><td>{u.username}</td><td>{formatBytes(u.bytes_sent)}</td><td>{formatBytes(u.bytes_recv)}</td><td>{formatBytes(u.bytes_sent + u.bytes_recv)}</td></tr>)}</tbody></table></div> : <div className="empty-state">No matching traffic in this period.</div>}
        </>}
      </section>
    </div>
  );
}
