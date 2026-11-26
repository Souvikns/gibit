export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5;

export interface AttemptRecord {
  count: number;
  windowStart: number;
}

function expired(record: AttemptRecord, now: number): boolean {
  return now - record.windowStart >= LOGIN_WINDOW_MS;
}

export function isBlocked(record: AttemptRecord | null, now: number): { blocked: boolean; retryAfterMs: number } {
  if (!record || expired(record, now) || record.count < LOGIN_MAX_ATTEMPTS) {
    return { blocked: false, retryAfterMs: 0 };
  }
  return { blocked: true, retryAfterMs: record.windowStart + LOGIN_WINDOW_MS - now };
}

export function recordFailure(record: AttemptRecord | null, now: number): AttemptRecord {
  if (!record || expired(record, now)) return { count: 1, windowStart: now };
  return { count: record.count + 1, windowStart: record.windowStart };
}
