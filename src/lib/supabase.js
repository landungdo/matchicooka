import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "[matchicooka] Missing Supabase env vars. Create a .env.local file with " +
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server."
  );
}

export const supabase = createClient(url || "http://localhost", key || "public-anon-key");
