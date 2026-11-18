import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fetchTopDomains, searchDomainUsers, subscribeUsers } from "./client.js";

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
afterEach(() => { globalThis.fetch = originalFetch; globalThis.EventSource = originalEventSource; });

test("live subscription requests its window and receives users and traffic buckets", () => {
  let stream;
  globalThis.EventSource = class {
    constructor(url) { this.url = url; this.listeners = {}; stream = this; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    close() { this.closed = true; }
  };
  let users;
  let buckets;
  let disconnected = false;
  const unsubscribe = subscribeUsers((data) => { users = data; }, () => { disconnected = true; }, 900, (data) => { buckets = data; });
  assert.equal(stream.url, "/api/stream?window=900");
  stream.listeners.users({ data: '[{"username":"alice"}]' });
  stream.listeners.traffic_buckets({ data: '[{"ts_minute":60,"bytes_sent":10,"bytes_recv":20}]' });
  assert.equal(users[0].username, "alice");
  assert.equal(buckets[0].bytes_recv, 20);
  stream.onerror();
  assert.equal(disconnected, true);
  unsubscribe();
  assert.equal(stream.closed, true);
});

test("report requests include the selected range and encode the domain", async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    return { ok: true, json: async () => [] };
  };
  await fetchTopDomains(100, 200);
  await searchDomainUsers("foo & bar", 100, 200);
  assert.deepEqual(requests, [
    "/api/reports/domains?start=100&end=200",
    "/api/reports/domain-users?q=foo%20%26%20bar&start=100&end=200",
  ]);
});

test("report requests surface server errors", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  await assert.rejects(fetchTopDomains(100, 200), /HTTP 500/);
  await assert.rejects(searchDomainUsers("example.com", 100, 200), /HTTP 500/);
});
