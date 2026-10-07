import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
// Match Supabase's existing default so deployed sessions survive this upgrade.
export const authStorageKey = url
  ? `sb-${new URL(url).hostname.split(".")[0]}-auth-token`
  : "";
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: authStorageKey,
          flowType: "pkce",
          detectSessionInUrl: true,
          autoRefreshToken: true,
          persistSession: true,
        },
      })
    : null;
