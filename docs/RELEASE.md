# Release verification and remaining work

## Completed checks

The implementation removes the original local-only demo architecture and broad profile/order access policies. Database tests cover profile/order privacy, RPC ownership, duplicates, capacity, server totals and fee split, expired/locked runs, cancellation, host-only state transitions, anonymous rejection, discovery and collection. Domain tests cover coordinate validation, join eligibility, item validation, manifest aggregation and local datetime input. Production build and npm dependency audit are required checks. These checks are not a penetration test or a guarantee of zero vulnerabilities.

## Before public launch

1. Verify the deployed Vercel URL with production backend variables. Test two real verified accounts on separate devices: host a run, locate/search it, join, refresh both devices, cancel, lock, arrive and collect. Test denied GPS, unavailable tiles, an offline request, email confirmation and password recovery.
2. Enable strong server-side Auth password rules and leaked-password protection if supported by the account's plan. The database advisor currently reports leaked-password protection as disabled. The form's 12-character minimum alone is not sufficient because API callers can bypass the form.
3. Configure production SMTP and Auth redirect URLs, CAPTCHA/abuse controls and appropriate request limits. Default email infrastructure is not a production onboarding guarantee.
4. Set an operational owner and daily report-review process. Reports are stored in `public.safety_reports`; only reporters can read their own reports through the app. Review through the Supabase dashboard with owner access. Implement administrative resolution, suspension and run removal before broad user-generated-content release. A report button alone does not constitute active moderation.
5. Establish backup/restore procedures, uptime and error monitoring, retention/deletion policy, support response targets and load/concurrency testing. The restored free project can pause again; no plan upgrade or paid commitment was made.
6. Review the pilot terms, costs and privacy text for the actual business. If collecting advance payment later, use a real payment provider and server-side idempotent payment/order reconciliation; do not treat editable price estimates as merchant quotes.
7. Confirm a real pickup workflow and how hosts communicate delays without exposing personal phone numbers. Current arrival/status updates refresh while the app is foregrounded, typically every 20 seconds; there is no background push delivery guarantee.
8. App code is a shared React/Vite web client and a Supabase database API. Repository rename and hosting configuration must be checked together so the Git integration continues to deploy the intended branch.

## Android wrapper plan

Use a Capacitor Android app with the built `dist` web assets, rather than a permanent development `server.url`. Keep the shared UI and backend API. Before publishing:

- Create the Android package identity, configure signing and generate an Android App Bundle using Android Studio.
- Add native geolocation permission handling with a deliberate location prompt and a manual-area fallback. Request foreground location only; no background location is needed for current features.
- Test session persistence, logout, email verification/password-recovery links, external maps, copy export, Android back-button navigation and safe-area/keyboard behavior on real devices.
- Add native app lifecycle refresh and secure session storage appropriate to the native threat model. Do not assume browser localStorage has the same protection as an Android credential store.
- Keep current APIs compatible with foreground-only clients; a wrapper does not add push notifications, offline order processing or payments automatically.
- Complete Google Play Data safety, a public privacy/deletion URL, content rating, reviewer access and effective user-content moderation/reporting/blocking. Do not claim Play compliance solely from adding these UI controls.
- Check current target SDK and account-specific Play testing requirements. New personal accounts created after 13 November 2023 currently need at least 12 opted-in testers continuously for 14 days before requesting production access.

References:

- https://capacitorjs.com/docs/config
- https://capacitorjs.com/docs/apis/geolocation
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/9876937
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://operations.osmfoundation.org/policies/tiles/
- https://supabase.com/docs/guides/auth/password-security
