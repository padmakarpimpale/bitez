import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  activityKey,
  createActivityTracker,
  IDLE_WARNING_MS,
} from "./sessionActivity";

export function useIdleSession(
  session: Session | null,
  onExpire: () => Promise<void>,
) {
  const identity = session
    ? activityKey(
        session.user.id,
        session.access_token,
        session.user.last_sign_in_at ?? session.user.created_at,
      )
    : null;
  const [checked, setChecked] = useState<string | null>(null);
  const [warningSeconds, setWarningSeconds] = useState<number | null>(null);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const resumeRef = useRef<() => void>(() => {});

  useEffect(() => {
    setWarningSeconds(null);
    if (!identity) {
      setChecked(null);
      return;
    }
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* Private/device storage restrictions. */
    }
    const tracker = createActivityTracker(identity, storage);
    let ended = false;
    const check = () => {
      if (ended) return;
      const remaining = tracker.remaining();
      if (remaining === 0) {
        ended = true;
        setChecked(null);
        setWarningSeconds(null);
        void expireRef.current();
      } else {
        setChecked(identity);
        setWarningSeconds(
          remaining <= IDLE_WARNING_MS ? Math.ceil(remaining / 1000) : null,
        );
      }
    };
    const activity = (event?: Event) => {
      if (
        ended ||
        document.visibilityState !== "visible" ||
        (event && !event.isTrusted)
      )
        return;
      if (tracker.recordActivity()) setWarningSeconds(null);
      check();
    };
    resumeRef.current = () => activity();
    const events = ["pointerdown", "keydown", "input", "wheel", "touchstart"];
    for (const event of events)
      document.addEventListener(event, activity, { passive: true });
    // Resume/focus and API/token/realtime traffic never count as user activity.
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("storage", check);
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 1000);
    check();
    return () => {
      ended = true;
      clearInterval(timer);
      for (const event of events) document.removeEventListener(event, activity);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("storage", check);
      document.removeEventListener("visibilitychange", check);
      resumeRef.current = () => {};
    };
  }, [identity]);

  return {
    ready: identity === checked,
    warningSeconds,
    staySignedIn: () => resumeRef.current(),
  };
}
