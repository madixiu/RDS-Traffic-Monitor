export function estimateLiveSpeed(previous, current, elapsedSeconds) {
  if (!previous || elapsedSeconds <= 0 || elapsedSeconds > 10) return null;

  const previousBuckets = new Map(previous.map((bucket) => [bucket.ts_minute, bucket]));
  let sent = 0;
  let received = 0;
  for (const bucket of current) {
    const old = previousBuckets.get(bucket.ts_minute);
    const sentDelta = bucket.bytes_sent - (old?.bytes_sent ?? 0);
    const receivedDelta = bucket.bytes_recv - (old?.bytes_recv ?? 0);
    if (sentDelta < 0 || receivedDelta < 0) return null;
    sent += sentDelta;
    received += receivedDelta;
  }
  return { sent: sent / elapsedSeconds, received: received / elapsedSeconds };
}
