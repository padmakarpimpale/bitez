import test from "node:test";
import assert from "node:assert/strict";
import {
  authRedirectUrl,
  authLinkError,
  callbackError,
  clearCallbackError,
} from "../src/authLinks.ts";
import {
  activityKey,
  createActivityTracker,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
} from "../src/sessionActivity.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("email callbacks use an exact origin root, never a user-controlled next URL", () => {
  assert.equal(
    authRedirectUrl("https://bitez-sg.vercel.app"),
    "https://bitez-sg.vercel.app/",
  );
  assert.equal(
    authRedirectUrl("https://bitez-sg.vercel.app/?next=https://evil.example"),
    "https://bitez-sg.vercel.app/",
  );
  assert.equal(
    authRedirectUrl("http://localhost:5173"),
    "http://localhost:5173/",
  );
  assert.equal(
    authRedirectUrl("http://127.0.0.1:5173"),
    "http://127.0.0.1:5173/",
  );
  assert.throws(() => authRedirectUrl("http://bitez-sg.vercel.app"));
  assert.throws(() => authRedirectUrl("javascript:alert(1)"));
});

test("expired and cross-browser email callbacks provide useful safe instructions", () => {
  assert.match(
    authLinkError({ code: "otp_expired" }),
    /expired or was already used/,
  );
  assert.match(authLinkError({ code: "bad_code_verifier" }), /same browser/);
  const url = new URL(
    "https://bitez-sg.vercel.app/?run=abc&code=old#error=access_denied&error_code=otp_expired&error_description=arbitrary-secret-text&sb=old",
  );
  assert.match(callbackError(url)!, /expired/);
  assert.ok(!callbackError(url)!.includes("arbitrary-secret-text"));
  assert.equal(clearCallbackError(url), "/?run=abc");
  assert.equal(
    callbackError(new URL("https://bitez-sg.vercel.app/#access_token=example")),
    null,
  );
});

test("idle session expires exactly at one hour and interaction after sleep cannot revive it", () => {
  let clock = 1_000_000;
  const tracker = createActivityTracker(
    "session",
    memoryStorage(),
    () => clock,
  );
  clock += IDLE_TIMEOUT_MS - IDLE_WARNING_MS;
  assert.equal(tracker.remaining(), IDLE_WARNING_MS);
  clock += IDLE_WARNING_MS;
  assert.equal(tracker.remaining(), 0);
  assert.equal(tracker.recordActivity(), false);
  clock += 24 * 60 * 60 * 1000;
  assert.equal(tracker.recordActivity(), false);
});

test("real interaction extends the deadline; repeated checks do not", () => {
  let clock = 1_000_000;
  const tracker = createActivityTracker(
    "session",
    memoryStorage(),
    () => clock,
  );
  clock += 59 * 60 * 1000;
  assert.ok(tracker.recordActivity());
  clock += 59 * 60 * 1000;
  assert.equal(tracker.remaining(), 60 * 1000);
  tracker.remaining();
  clock += 60 * 1000;
  assert.equal(tracker.remaining(), 0);
});

test("reloads and background resumes retain the original idle deadline", () => {
  let clock = 1_000_000;
  const storage = memoryStorage();
  createActivityTracker("session", storage, () => clock);
  clock += IDLE_TIMEOUT_MS + 1;
  const reopened = createActivityTracker("session", storage, () => clock);
  assert.equal(reopened.remaining(), 0);
  assert.equal(reopened.recordActivity(), false);
});

test("interaction in another tab extends the shared session without a stale-tab overwrite", () => {
  let clock = 1_000_000;
  const storage = memoryStorage();
  const first = createActivityTracker("session", storage, () => clock);
  const second = createActivityTracker("session", storage, () => clock);
  clock += 59 * 60 * 1000;
  second.recordActivity();
  clock += 2 * 60 * 1000;
  assert.equal(first.remaining(), IDLE_TIMEOUT_MS - 2 * 60 * 1000);
  assert.ok(first.recordActivity());
  assert.equal(second.remaining(), IDLE_TIMEOUT_MS);
});

test("new login has an independent activity record; token refresh keeps the old deadline", () => {
  const token = (id: string, expiry: number) =>
    `header.${btoa(JSON.stringify({ session_id: id, exp: expiry }))}.signature`;
  const id = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  const first = activityKey("user", token(id, 1), "fallback");
  assert.equal(first, activityKey("user", token(id, 2), "fallback"));
  assert.notEqual(first, activityKey("user", token(other, 2), "fallback"));
  let clock = 1_000_000;
  const storage = memoryStorage();
  createActivityTracker(first, storage, () => clock);
  clock += IDLE_TIMEOUT_MS;
  assert.equal(
    createActivityTracker(first, storage, () => clock).remaining(),
    0,
  );
  assert.equal(
    createActivityTracker(
      activityKey("user", token(other, 2), "fallback"),
      storage,
      () => clock,
    ).remaining(),
    IDLE_TIMEOUT_MS,
  );
});

test("unavailable or malformed activity storage does not crash the app", () => {
  let clock = 1_000_000;
  const failing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const tracker = createActivityTracker("session", failing, () => clock);
  clock += IDLE_TIMEOUT_MS;
  assert.equal(tracker.remaining(), 0);
  const storage = memoryStorage();
  storage.setItem("session", "NaN");
  assert.equal(
    createActivityTracker("session", storage, () => clock).remaining(),
    IDLE_TIMEOUT_MS,
  );
});
