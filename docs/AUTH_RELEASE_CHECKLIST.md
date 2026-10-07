# Email links and inactivity logout

## Required production configuration

These are hosted Supabase Auth settings, not SQL migrations. Merging code or
redeploying Vercel does not change them.

Open https://supabase.com/dashboard/project/kjbxtjfcybkdwzqyqqmv/auth/url-configuration

1. Set **Site URL** to `https://bitez-sg.vercel.app/`.
2. Add the exact **Redirect URL** `https://bitez-sg.vercel.app/`.
3. If the older alias is still used for accounts, add
   `https://kampong-drop.vercel.app/` too.
4. For development only, allow the actual Vite URL, for example
   `http://localhost:5173/` and/or `http://127.0.0.1:5173/`. Add exact trusted
   preview origins individually when testing signup on a preview. Do not allow
   every `*.vercel.app` deployment or arbitrary domains.
5. Check **Authentication → Emails → Confirm signup / Reset password**. Standard
   Supabase templates should link to `{{ .ConfirmationURL }}`. Remove any
   hard-coded localhost link. This app does not implement an SSR `/auth/confirm`
   token-hash endpoint; do not paste an SSR template into this SPA.

On 2026-10-08 (Singapore), safe requests using a deliberately invalid signup
token and each live redirect spelling (with/without trailing slash) returned a
303 to `http://localhost:3000#error=…`. No real token, user or email was used.
This confirms a production configuration failure, not a Vercel build failure.
The connected Supabase tools do not expose Auth configuration reads/updates,
so the dashboard change still requires an account administrator.

## Email flow checks after saving settings

- Request a **fresh** confirmation email using a tester-owned account. Links
  already sent are not rewritten by changing settings.
- Open the latest link in the same browser that requested it. This SPA uses
  PKCE: the requesting browser holds the code verifier. A confirmation opened
  elsewhere can verify the email without being able to sign that browser in;
  sign in with the verified email/password instead.
- Confirm the final URL is Bitez, never localhost. Confirm signup, resend,
  sign-in, expired/used-link guidance and password reset.
- Password recovery must be requested and completed in the same browser. Show
  the new-password form and successfully sign in with the new password. Test
  Android email links as well: the external browser and WebView do not share
  storage. Verified Android App Links remain a separate release requirement.
- Do not turn off email verification to bypass this problem. Do not put
  credentials or real email tokens in issue bodies, screenshots or logs.

## Pilot session policy

The web app and Android WebView sign out the current device session after
**60 minutes without user interaction**, with a **two-minute warning**. The
warning's Stay signed in button resets the deadline. Typing, tapping and
scrolling count; background polling, messages arriving and token refresh do not.

The activity timestamp is scoped to the auth session and shared between browser
tabs. Refreshing/reopening a page or returning after device sleep checks the
existing deadline; it does not make an expired session active again. A fresh
sign-in starts a new clock. Where local storage is unavailable, an in-memory
fallback works while the page lives, but cannot preserve activity across reloads.

This is a conservative pilot UX policy, not a universal food-industry standard.
Keeping customers signed in on their own phones can be reasonable. Reassess
the duration with testers; avoid interrupting long-running pickup coordination.
Saved runs/orders are retained, but unsaved forms/messages may be lost on logout.

This **client-side** idle feature is not a server-enforced security boundary.
Supabase's built-in session lifetime/inactivity limits require Pro or higher;
its inactivity setting measures token refresh, not clicks, so auto-refresh can
keep an open idle tab alive. Do not shorten JWT lifetime expecting idle logout:
the SDK renews tokens. Keep the normal one-hour access-token lifetime unless a
separate security review justifies changing it.

Logout revokes the current session's refresh token when online. Already-issued
access tokens can remain valid until expiry. If offline revocation fails, the
app removes the saved device credential; this does not revoke a copied token
on the server. Add server checks/re-authentication before future real payments.

## Verification

`npm test` includes expiry boundaries, reload/sleep, activity in multiple tabs,
independent new logins, token-refresh identity, storage failures and safe auth
callback instructions. `npm run build` checks types and production bundling.

Before launch, exercise the warning and timeout in the actual browser/Android
wrapper, including chat dialogs, background/resume and offline sign-out.

References:

- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
