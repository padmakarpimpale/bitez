import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { client } from "../api";
import { supabase } from "../supabase";
import { authRedirectUrl } from "../authLinks";
import type { Action } from "../types";

export function Auth({
  busy,
  action,
  notify,
  onSignedIn,
}: {
  busy: boolean;
  action: Action;
  notify: (s: string) => void;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      className="panel auth"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const email = String(f.get("email")).trim(),
          password = String(f.get("password") ?? "");
        void action(async () => {
          if (mode === "login") {
            const { error } = await client().auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
            client().auth.startAutoRefresh();
            onSignedIn();
          } else if (mode === "signup") {
            const { error } = await client().auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: authRedirectUrl(window.location.origin),
              },
            });
            if (error) throw error;
            notify(
              "Check your email to verify your account. Open the link in this browser, then sign in if needed.",
            );
          } else {
            const { error } = await client().auth.resetPasswordForEmail(email, {
              redirectTo: authRedirectUrl(window.location.origin),
            });
            if (error) throw error;
            notify(
              "If an account exists, a password reset link has been sent. Open it in this browser.",
            );
          }
        });
      }}
    >
      <span className="eyebrow">WELCOME TO BITEZ</span>
      <h1>
        {mode === "signup"
          ? "Meet your neighbours."
          : mode === "reset"
            ? "Reset your password."
            : "Welcome back."}
      </h1>
      <p>Sign in to find, host and join real food runs.</p>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      {mode !== "reset" && (
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={mode === "signup" ? 12 : 1}
            maxLength={128}
            required
          />
          <small>
            {mode === "signup" ? "Use at least 12 characters." : ""}
          </small>
        </label>
      )}
      {mode === "signup" && (
        <label className="checkbox">
          <input type="checkbox" required />I agree to the Community terms and
          Privacy policy linked below.
        </label>
      )}
      <small>
        For privacy on shared devices, Bitez signs you out after 60 minutes
        without interaction. Saved runs and orders remain in your account.
      </small>
      <button className="primary" disabled={busy || !supabase}>
        {busy
          ? "Please wait…"
          : mode === "signup"
            ? "Create account"
            : mode === "reset"
              ? "Send reset link"
              : "Sign in"}
        <ArrowRight size={18} />
      </button>
      <div className="actions">
        {mode === "signup" && (
          <button
            type="button"
            disabled={busy || !supabase}
            onClick={() => {
              const input = form.current?.elements.namedItem(
                "email",
              ) as HTMLInputElement | null;
              if (!input || !input.reportValidity()) return;
              const email = input.value.trim();
              void action(async () => {
                const { error } = await client().auth.resend({
                  type: "signup",
                  email,
                  options: {
                    emailRedirectTo: authRedirectUrl(window.location.origin),
                  },
                });
                if (error) throw error;
                notify(
                  "If this account needs confirmation, a new email has been sent. Use the newest link and open it in this browser.",
                );
              });
            }}
          >
            Resend confirmation email
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup"
            ? "Already registered? Sign in"
            : "Create an account"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode(mode === "reset" ? "login" : "reset")}
        >
          {mode === "reset" ? "Back to sign in" : "Forgot password?"}
        </button>
      </div>
    </form>
  );
}
