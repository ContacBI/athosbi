import { state, setData } from "../data/useStore.js";
import { PLANO_SNAPSHOT_KEY, PLANO_BACKUP_KEY, readStoredArray, writePersistent } from "./persistence.js";
import { parseCsv } from "../importers/csv.js";

// The plano gerencial used to be purely static (one CSV, fetched fresh on
// every boot, never written back). Now that it's editable — one account at
// a time from the tree in Parâmetros → Sistema, or wholesale via the Excel
// round-trip — "the current plano" is whatever was last saved, with the
// static CSV only ever used as the very first seed. Both editing paths
// funnel through savePlanoSnapshot() below, so there's one persisted
// source of truth instead of a base file plus a separate delta.

let basePlanoCache = null;

// The pristine, never-edited standard plano — fetched once and cached, used
// (a) to seed storage the very first time the app runs, and (b) to tell
// apart "an account that was always there" from "one the user added",
// which the Excel import path needs since it can't rely on a `custom` flag
// already being on the incoming rows.
export async function fetchBasePlano() {
  if (basePlanoCache) return basePlanoCache;
  const response = await fetch("/data/plano_gerencial_padrao.csv");
  if (!response.ok) throw new Error("falha ao carregar plano_gerencial_padrao.csv");
  basePlanoCache = parseCsv(await response.text());
  return basePlanoCache;
}

export async function loadPlano() {
  const saved = await readStoredArray(PLANO_SNAPSHOT_KEY);
  if (saved.length) {
    setData({ plano: saved });
  } else {
    const base = await fetchBasePlano();
    setData({ plano: base });
    writePersistent(PLANO_SNAPSHOT_KEY, base); // adopt the base CSV as the first saved snapshot
  }
  const backup = await readStoredArray(PLANO_BACKUP_KEY);
  setData({ planoBackupAvailable: backup.length > 0 });
}

// Every write path (tree "+"/excluir, Excel import) goes through here.
// `backupCurrent` snapshots whatever's live right now into the one-shot
// backup slot first — used by the riskier bulk Excel import, skipped for
// the tree UI's single-account add/remove since those are already low-risk
// and instantly reversible from the UI itself.
export function savePlanoSnapshot(newPlano, { backupCurrent = false } = {}) {
  if (backupCurrent) {
    writePersistent(PLANO_BACKUP_KEY, state.plano);
    setData({ planoBackupAvailable: true });
  }
  writePersistent(PLANO_SNAPSHOT_KEY, newPlano);
  setData({ plano: newPlano });
}

// One-shot undo for the Excel import — consumes the backup so restoring
// twice in a row does nothing the second time.
export async function restorePreviousPlano() {
  const backup = await readStoredArray(PLANO_BACKUP_KEY);
  if (!backup.length) return false;
  writePersistent(PLANO_SNAPSHOT_KEY, backup);
  writePersistent(PLANO_BACKUP_KEY, []);
  setData({ plano: backup, planoBackupAvailable: false });
  return true;
}
