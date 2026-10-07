export const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
export const IDLE_WARNING_MS = 2 * 60 * 1000;

type ActivityStorage = Pick<Storage, "getItem" | "setItem">;

// This identifies a local activity record, not an authorization decision.
// Token refresh keeps session_id unchanged; a new login gets a new record.
export function activityKey(
  userId: string,
  token: string,
  fallback: string,
): string {
  let identity = fallback;
  try {
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (
      typeof payload.session_id === "string" &&
      /^[0-9a-f-]{36}$/i.test(payload.session_id)
    )
      identity = payload.session_id;
  } catch {
    /* Older/unsupported tokens use the last sign-in timestamp. */
  }
  return `bitez:activity:${userId}:${identity}`;
}

export function createActivityTracker(
  key: string,
  storage: ActivityStorage | null,
  now: () => number = Date.now,
) {
  let lastActivity = now();
  let lastWrite = 0;
  function read() {
    try {
      const raw = storage?.getItem(key);
      const value = raw == null ? NaN : Number(raw);
      if (Number.isFinite(value) && value > 0 && value <= now())
        lastActivity = Math.max(lastActivity, value);
    } catch {
      /* In-memory fallback when device storage is unavailable. */
    }
  }
  // Read before initializing: reopening an idle page must not reset its clock.
  try {
    const raw = storage?.getItem(key);
    const value = raw == null ? NaN : Number(raw);
    if (Number.isFinite(value) && value > 0 && value <= now())
      lastActivity = value;
  } catch {
    /* In-memory fallback. */
  }
  function write() {
    try {
      storage?.setItem(key, String(lastActivity));
    } catch {
      /* In-memory fallback. */
    }
    lastWrite = now();
  }
  write();
  function remaining() {
    read();
    return Math.max(0, IDLE_TIMEOUT_MS - (now() - lastActivity));
  }
  return {
    remaining,
    recordActivity() {
      // A click after expiry cannot resurrect the session, even after sleep.
      if (remaining() === 0) return false;
      lastActivity = now();
      if (now() - lastWrite >= 1000) write();
      return true;
    },
  };
}
