# Bitez

Neighbour-organised food runs in Singapore. A host publishes a restaurant, public pickup point, cutoff and delivery fee. Neighbours search nearby runs and reserve items; the host places the combined restaurant order independently.

## What is implemented

- Supabase email/password accounts, email verification, password recovery and private profiles.
- Persistent host runs and reservations. No local-only demo data or fake live badge.
- Search by restaurant, host, block/instructions or pickup postal code; radius filters, straight-line pickup distance and server-side pagination.
- Optional browser GPS with consent, manual area selection, clickable pickup map and coordinate fallback. Area-centre searches are labelled approximate.
- Multi-item reservations; server-computed totals, unique participant reservations, capacity and deadline enforcement, cancellation before cutoff and row locks around run mutations.
- Private participant orders and host manifests, combined items, copy export, order locking, arrival and collection controls.
- Block/report controls, basic per-user quotas, account deletion, public `/privacy` and `/terms` pages.
- Responsive mobile navigation, accessible native dialogs, Bitez vector branding and mobile icons, Web App Manifest, Vercel security headers and dependency lockfile.

## Local development (PowerShell or a terminal)

Use Node 22.12 or later.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and fill in the project's publishable key. Only the URL and publishable/legacy anon key belong in `VITE_*` variables. Never put service-role keys or database passwords in client environment variables.

```sh
npm run dev
npm test
npm run build
```

The app fails closed when backend configuration is absent; it does not silently enter demo mode. GPS requires HTTPS outside localhost.

## Existing backend upgrade

The linked project is `kjbxtjfcybkdwzqyqqmv` in Singapore. Ordered SQL upgrades are in `supabase/migrations`. The initial tables already exist there; `supabase.schema.sql` is the historical bootstrap, not the current authorization design. Do not rerun the bootstrap against an existing database.

All table access uses explicit grants plus RLS. Mutating RPCs have public security-invoker wrappers and private security-definer implementations with fixed empty search paths, authenticated caller checks, ownership checks and input validation. Direct writes to runs and reservations are revoked. The private schema must **not** be exposed in Data API settings.

`tests/database.sql` exercises real database authorization and business rules with temporary fixtures inside a rolled-back transaction. Execute it through the Supabase SQL editor as the database owner. It must finish with PASS and leave no test users/orders behind.

## Vercel deployment

The production deployment is https://bitez-sg.vercel.app/. The Vercel project and GitHub repository are both named `bitez`. The previous https://kampong-drop.vercel.app/ address also remains connected.

Configure these variables for Production and Preview in Vercel:

```text
VITE_SUPABASE_URL=https://kjbxtjfcybkdwzqyqqmv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
```

The older `VITE_SUPABASE_ANON_KEY` remains supported if already configured. Vercel uses `npm run build` and the `dist` directory via `vercel.json`.

In Supabase Auth URL settings, set the production Site URL and allow the exact production and approved preview redirect URLs. Keep email verification enabled. Configure production SMTP, password rules, abuse protection and auth rate limits. Test sign-up verification and password recovery against the actual deployed domain before admitting users.

## Release limits and operations

This is a pilot, not an audited production service. Read `docs/RELEASE.md` for the outstanding launch requirements and Android plan. No card payments, restaurant API, delivery integration, background push notifications or guaranteed moderation are implemented. The host counts in the fee split but their own food items must be added when placing the final restaurant order. Rounding differences are agreed outside the app. Do not promise payments or merchant-confirmed prices.

OpenStreetMap tiles need a working Internet connection and visible attribution. Comply with the tile usage policy and choose a supported provider before substantial traffic. The manual coordinate fallback remains usable if tiles fail.
