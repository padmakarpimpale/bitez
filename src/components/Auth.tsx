import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { client } from "../api";
import { supabase } from "../supabase";
import type { Action } from "../types";

export function Auth({
  busy,
  action,
  notify,
}: {
  busy: boolean;
  action: Action;
  notify: (s: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  return (
    <form
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
          } else if (mode === "signup") {
            const { error } = await client().auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            });
            if (error) throw error;
            notify("Check your email to verify your account, then sign in.");
          } else {
            const { error } = await client().auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin,
            });
            if (error) throw error;
            notify(
              "If an account exists, a password reset link has been sent.",
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
