import { supabase } from "./supabaseClient.js";

// One "gaveta" per logical chunk of app data, same key names the IndexedDB
// version used — kept identical so nothing downstream (companies.js,
// planoStore.js, indicators.js, groups.js, representantes.js) needs to
// change; they just call readPersistent/writePersistent/readStoredArray
// like before, and those now talk to Supabase's app_storage table instead
// of the browser's IndexedDB. See supabase/schema.sql for the table.
export const COMPANIES_KEY = "portalGerencial.companies.v2";
export const ACTIVE_COMPANY_KEY = "portalGerencial.activeCompany.v2";
export const GROUPS_KEY = "portalGerencial.groups.v1";
export const ACTIVE_GROUP_KEY = "portalGerencial.activeGroup.v1";
export const REPRESENTANTES_KEY = "portalGerencial.representantes.v1";
export const INDICATORS_KEY = "portalGerencial.indicatorOverrides.v1";
export const PLANO_OVERRIDES_KEY = "portalGerencial.planoOverrides.v1";
export const PLANO_SNAPSHOT_KEY = "portalGerencial.planoSnapshot.v1";
export const PLANO_BACKUP_KEY = "portalGerencial.planoBackup.v1";

// A company's "journal" (monthly ledger entries) is the one piece of data
// that can run into the tens of thousands of rows — everything else in a
// company record together rarely exceeds a few hundred KB. Keeping it
// embedded inside the single COMPANIES_KEY blob meant editing anything on
// any one company (even just a De/Para link) re-uploaded every company's
// entire ledger on every save — multi-megabyte writes that took the better
// part of a minute and were trivial to interrupt with a page reload,
// silently discarding the edit. Splitting it into its own per-company key
// means a save only ever re-uploads the ledger of the company that actually
// changed. See lib/companies.js writeStoredCompanies/loadCompanies.
export const companyJournalKey = (companyId) => `portalGerencial.companyJournal.${companyId}`;

// Several screens can save the same "drawer" in quick succession (for
// example, creating a company first saves the currently open company and
// immediately after saves the new list). Network requests do not necessarily
// finish in the order they were sent. Serializing writes per key prevents an
// older request from arriving last and overwriting newer data in Supabase.
const writeQueues = new Map();
const localKey = (key) => `portalGerencial.fallback.${key}`;

export async function readPersistent(key) {
  const { data, error } = await supabase.from("app_storage").select("value").eq("key", key).maybeSingle();
  if (error) {
    console.error(`Falha ao ler "${key}" do Supabase:`, error);
    try {
      const fallback = localStorage.getItem(localKey(key));
      return fallback ? JSON.parse(fallback) : undefined;
    } catch {
      return undefined;
    }
  }
  // The local copy is only a safety net for a temporary database/network
  // outage; Supabase remains the source of truth whenever it is reachable.
  if (data?.value !== undefined) {
    try { localStorage.setItem(localKey(key), JSON.stringify(data.value)); } catch { /* storage can be unavailable */ }
    return data.value;
  }
  return undefined;
}

export function writePersistent(key, value) {
  try { localStorage.setItem(localKey(key), JSON.stringify(value)); } catch { /* storage can be unavailable */ }
  const previous = writeQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => undefined) // a failed older save must not block later edits
    .then(async () => {
      const { error } = await supabase.from("app_storage").upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) {
        console.error(`Falha ao salvar "${key}" no Supabase:`, error);
        throw error;
      }
    });
  writeQueues.set(key, next);
  return next.finally(() => {
    if (writeQueues.get(key) === next) writeQueues.delete(key);
  });
}

export async function readStoredArray(key) {
  const stored = await readPersistent(key);
  return Array.isArray(stored) ? stored : [];
}
