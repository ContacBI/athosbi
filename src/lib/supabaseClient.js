import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Both come from a .env.local (dev) or the host's env vars (prod) — see
// .env.example. Missing them is a setup problem, not a runtime one, so it
// fails loud immediately instead of every Supabase call quietly rejecting
// with a confusing "Invalid URL" deep in the storage layer.
if (!url || !anonKey) {
  throw new Error(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copie .env.example pra .env.local e preencha com os dados do seu projeto Supabase."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Bucket that holds the "outro" monthly-report archive attachments (see
// lib/companies.js attachMonthlyReport) — the one kind of data in this app
// that's a real binary file rather than JSON, so it can't live in the
// app_storage jsonb table alongside everything else.
export const MONTHLY_REPORTS_BUCKET = "monthly-reports";
