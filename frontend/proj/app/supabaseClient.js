import { createClient } from "@supabase/supabase-js";

// Supabase Auth client. Created lazily and only in the browser — the auth
// client uses localStorage, which doesn't exist during SSR. Configure with
// VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (the anon key is public/safe).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client;
export function getSupabase() {
  if (typeof window === "undefined") return null; // no auth during SSR
  if (!client) {
    if (!url || !anonKey) {
      console.warn(
        "[auth] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — sign-in is disabled."
      );
      return null;
    }
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Parse the recovery/confirmation tokens Supabase puts in the URL after
        // an email link (used by the /reset-password page).
        detectSessionInUrl: true
      }
    });
  }
  return client;
}
