// Keep PKCE callbacks on the browser's current origin. Supabase must allow this
// exact URL; its Site URL is still the fallback for rejected redirect requests.
export function authRedirectUrl(origin: string): string {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("Email links require HTTPS outside local development.");
  return `${url.origin}/`;
}

export function authLinkError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "otp_expired")
    return "This email link has expired or was already used. Try signing in if you already confirmed your email, or request a new link.";
  // PKCE verifiers live in the browser which requested the email.
  if (
    [
      "bad_code_verifier",
      "flow_state_not_found",
      "flow_state_expired",
      "pkce_code_verifier_not_found",
      "pkce_verifier_mismatch",
    ].includes(code)
  )
    return "Open this email link in the same browser where you requested it. If you confirmed your email in another browser, try signing in here. For a password reset, request a new link here.";
  return "We could not complete this email link. Try signing in if your email is already confirmed, or request a new confirmation or password reset link in this browser.";
}

export function callbackError(url: URL): string | null {
  const hash = new URLSearchParams(url.hash.slice(1));
  const params =
    hash.has("error") || hash.has("error_code") ? hash : url.searchParams;
  if (!params.has("error") && !params.has("error_code")) return null;
  // Do not display arbitrary error_description HTML/text supplied in the URL.
  return authLinkError({ code: params.get("error_code") });
}

export function clearCallbackError(url: URL): string {
  const hash = new URLSearchParams(url.hash.slice(1));
  for (const key of ["error", "error_code", "error_description", "sb"]) {
    url.searchParams.delete(key);
    hash.delete(key);
  }
  url.searchParams.delete("code");
  url.hash = hash.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}
