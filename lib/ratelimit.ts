// In-memory sliding window rate limiter.
// Werkt per serverless instance — goed genoeg voor een factuurservice.
// Swap later naar Redis als distributed limiting nodig is.

const WINDOW_MS = 60_000; // 1 minuut
const MAX_REQUESTS = 60;  // per project per minuut

const windows = new Map<string, number[]>();

export function checkRateLimit(projectId: string): {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
} {
  const now = Date.now();
  const timestamps = (windows.get(projectId) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );

  if (timestamps.length >= MAX_REQUESTS) {
    const resetInMs = WINDOW_MS - (now - timestamps[0]);
    windows.set(projectId, timestamps);
    return { allowed: false, remaining: 0, resetInMs };
  }

  timestamps.push(now);
  windows.set(projectId, timestamps);
  return { allowed: true, remaining: MAX_REQUESTS - timestamps.length, resetInMs: 0 };
}
