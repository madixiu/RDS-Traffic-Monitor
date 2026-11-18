import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateLiveSpeed } from "./liveSpeed.js";

test("calculates bytes per second from traffic changes", () => {
  const previous = [{ ts_minute: 60, bytes_sent: 100, bytes_recv: 200 }];
  const current = [{ ts_minute: 60, bytes_sent: 300, bytes_recv: 600 }];
  assert.deepEqual(estimateLiveSpeed(previous, current, 2), { sent: 100, received: 200 });
});

test("handles minute rollover and ignores buckets leaving the sample", () => {
  const previous = [
    { ts_minute: 0, bytes_sent: 1000, bytes_recv: 1000 },
    { ts_minute: 60, bytes_sent: 100, bytes_recv: 200 },
  ];
  const current = [
    { ts_minute: 60, bytes_sent: 120, bytes_recv: 240 },
    { ts_minute: 120, bytes_sent: 30, bytes_recv: 60 },
  ];
  assert.deepEqual(estimateLiveSpeed(previous, current, 2), { sent: 25, received: 50 });
});

test("waits for a sample, rejects long gaps and counter resets", () => {
  const previous = [{ ts_minute: 60, bytes_sent: 100, bytes_recv: 200 }];
  const reset = [{ ts_minute: 60, bytes_sent: 99, bytes_recv: 200 }];
  assert.equal(estimateLiveSpeed(null, previous, 2), null);
  assert.equal(estimateLiveSpeed(previous, previous, 0), null);
  assert.equal(estimateLiveSpeed(previous, previous, 11), null);
  assert.equal(estimateLiveSpeed(previous, reset, 2), null);
  assert.deepEqual(estimateLiveSpeed(previous, previous, 2), { sent: 0, received: 0 });
});
