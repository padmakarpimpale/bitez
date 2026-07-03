# KampongDrop MVP

KampongDrop is a web MVP for HDB group food runs. It supports nearby run discovery, host-created hubs, neighbor reservations, live delivery-fee recalculation, host manifests, WhatsApp export, and arrival status.

## Run locally

```bash
npm install
npm run dev
```

The app opens in demo mode until Supabase variables are added.

## Connect Supabase

1. Create a Supabase project in the Singapore region.
2. Run `supabase.schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Deploy to Vercel and add the same environment variables there.

## Deploy to Vercel

```bash
npm install
npm run build
npx vercel --prod
```

Use `dist` as the generated production output.
