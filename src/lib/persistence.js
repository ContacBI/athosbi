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
// Planos padrão (ago/2026) — cada empresa usa o Plano gerencial global MAIS
// as contas extras do plano padrão que ela segue (ver lib/planosPadrao.js).
// Uma linha só, array pequeno (poucos planos, não uma por empresa), sem
// precisar de chunking como o razão.
export const PLANOS_PADRAO_KEY = "portalGerencial.planosPadrao.v1";

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

// Every company gets its OWN row (this key, one per id) instead of all
// companies sharing a single array under COMPANIES_KEY. That single-array
// design is what actually caused real data loss (see the Aug 2026 incident
// with two client companies losing their contas/De-Para): any tab/device
// holding an even slightly stale in-memory copy of `state.companies` — one
// that simply hadn't reloaded since another tab saved something — would
// blast that whole stale array back over Supabase the next time it saved
// ANYTHING, silently overwriting every other company's newer data with old
// data it never actually touched. With one row per company, a save can only
// ever affect the one company it actually has new data for; every other
// company's row is never read, never rewritten, and so can never be
// clobbered by a stale copy sitting in some other tab's memory.
export const companyKey = (companyId) => `portalGerencial.company.${companyId}`;
export const COMPANY_KEY_PREFIX = "portalGerencial.company.";

// Several screens can save the same "drawer" in quick succession (for
// example, creating a company first saves the currently open company and
// immediately after saves the new list). Network requests do not necessarily
// finish in the order they were sent. Serializing writes per key prevents an
// older request from arriving last and overwriting newer data in Supabase.
const writeQueues = new Map();
const localKey = (key) => `portalGerencial.fallback.${key}`;

// O razão (linha única ou cada pedaço .partN) NÃO ganha cópia no
// localStorage. Um pedaço tem ~8MB de JSON — maior que a cota inteira do
// localStorage (~5MB) — então a cópia falhava sempre, mas só depois de
// gastar um JSON.stringify gigante na thread da tela; e os razões menores
// que cabiam enchiam a cota até não sobrar espaço nem pra lembrar qual
// empresa/grupo está aberto (ver rememberActiveWorkspace abaixo). Sem a
// cópia, uma leitura de razão que falha vira journalLoadFailed (trava de
// escrita + aviso na tela), que é mais seguro do que mostrar uma cópia
// local possivelmente desatualizada como se fosse o dado de verdade.
const JOURNAL_KEY_PREFIX = "portalGerencial.companyJournal.";
const keepsLocalCopy = (key) => !key.startsWith(JOURNAL_KEY_PREFIX);

// Limpa de uma vez as cópias de razão que versões anteriores deixaram no
// localStorage — sem isso, quem já está com a cota cheia continuaria cheio.
function purgeLocalJournalCopies() {
  try {
    const prefix = localKey(JOURNAL_KEY_PREFIX);
    const stale = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(prefix)) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage can be unavailable */
  }
}
purgeLocalJournalCopies();

// Lembrar qual empresa/grupo estava aberto (pro F5 voltar pro mesmo lugar)
// é só conveniência — nunca pode impedir a troca em si. Com o localStorage
// cheio (QuotaExceededError) ou bloqueado, setItem lança exceção síncrona;
// sem esse try/catch ela escapava de selectCompany/selectGroup antes de
// qualquer estado mudar, e o clique na empresa/grupo simplesmente não fazia
// nada (nem "carregando" aparecia). removeItem primeiro: não precisa de
// cota e já libera o espaço da chave antiga.
export function rememberActiveWorkspace({ companyId = "", groupId = "" }) {
  try {
    if (!companyId) localStorage.removeItem(ACTIVE_COMPANY_KEY);
    if (!groupId) localStorage.removeItem(ACTIVE_GROUP_KEY);
    if (companyId) localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    if (groupId) localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
  } catch (error) {
    console.warn("Não consegui lembrar a empresa/grupo ativo no navegador (localStorage cheio ou bloqueado):", error);
  }
}

// Um único timeout/soluço de rede não pode virar "essa conta está vazia" —
// foi exatamente isso que fez o razão de empresas inteiras (uma com 85 mil
// lançamentos) aparecer com 0 lançamentos na lista, sem erro nenhum visível
// (ver readPersistent/readPersistentByPrefix abaixo). Tenta de novo antes de
// desistir — cobre a esmagadora maioria dos casos reais (uma falha
// passageira, mais comum quanto maior o payload, ex. um razão gigante).
const READ_RETRIES = 4;
const READ_RETRY_BASE_MS = 700;

// Uma requisição que trava (a conexão para de responder sem fechar) nunca
// terminava sozinha — sem tempo limite, o portal ficava preso em
// "Carregando…" indefinidamente (visto: mais de uma hora). Com o limite,
// ela vira um erro comum e cai no retry acima. Generoso o bastante pra um
// pedaço de razão de ~8MB numa conexão lenta. Um sinal novo por tentativa.
const READ_TIMEOUT_MS = 90000;
const readTimeoutSignal = () => (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined);

async function withReadRetries(run) {
  let lastError;
  for (let attempt = 0; attempt <= READ_RETRIES; attempt += 1) {
    const { data, error } = await run();
    if (!error) return data;
    lastError = error;
    if (attempt < READ_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, READ_RETRY_BASE_MS * (attempt + 1)));
    }
  }
  throw lastError;
}

// Erro distinto (não um valor "vazio" qualquer) pra quem chama conseguir
// separar "essa conta realmente não tem lançamento nenhum" de "não consegui
// nem confirmar se tem ou não" — a diferença importa demais pra virar um
// `|| []` qualquer (ver loadCompanies em lib/companies.js).
export class PersistenceReadError extends Error {}

export async function readPersistent(key) {
  let data;
  try {
    data = await withReadRetries(() => supabase.from("app_storage").select("value").eq("key", key).abortSignal(readTimeoutSignal()).maybeSingle());
  } catch (error) {
    console.error(`Falha ao ler "${key}" do Supabase (mesmo tentando de novo):`, error);
    try {
      const fallback = keepsLocalCopy(key) ? localStorage.getItem(localKey(key)) : null;
      if (fallback) return JSON.parse(fallback);
    } catch {
      /* cache local corrompido — ignora e cai no throw abaixo */
    }
    // Sem cache local pra usar de respaldo (dispositivo novo, ou essa chave
    // nunca foi lida aqui antes) — não dá pra saber se a conta existe ou
    // não. Propaga o erro em vez de fingir "vazio".
    throw new PersistenceReadError(`Não consegui ler "${key}" do Supabase.`, { cause: error });
  }
  // The local copy is only a safety net for a temporary database/network
  // outage; Supabase remains the source of truth whenever it is reachable.
  if (data?.value !== undefined) {
    if (keepsLocalCopy(key)) {
      try { localStorage.setItem(localKey(key), JSON.stringify(data.value)); } catch { /* storage can be unavailable */ }
    }
    return data.value;
  }
  return undefined;
}

const WRITE_RETRIES = 2;
const WRITE_RETRY_BASE_MS = 500;

async function upsertWithRetries(key, value) {
  let lastError;
  for (let attempt = 0; attempt <= WRITE_RETRIES; attempt += 1) {
    const { error } = await supabase.from("app_storage").upsert({ key, value, updated_at: new Date().toISOString() });
    if (!error) return;
    lastError = error;
    if (attempt < WRITE_RETRIES) await new Promise((resolve) => setTimeout(resolve, WRITE_RETRY_BASE_MS * (attempt + 1)));
  }
  throw lastError;
}

export function writePersistent(key, value) {
  if (keepsLocalCopy(key)) {
    try { localStorage.setItem(localKey(key), JSON.stringify(value)); } catch { /* storage can be unavailable */ }
  }
  const previous = writeQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => undefined) // a failed older save must not block later edits
    .then(async () => {
      try {
        await upsertWithRetries(key, value);
      } catch (error) {
        console.error(`Falha ao salvar "${key}" no Supabase (mesmo tentando de novo):`, error);
        throw error;
      }
    });
  writeQueues.set(key, next);
  return next.finally(() => {
    if (writeQueues.get(key) === next) writeQueues.delete(key);
  });
}

// Um razão de dezenas de milhares de lançamentos (uma linha JSONB só) às
// vezes falha ao gravar de uma vez, mesmo com retry — confirmado com um
// caso real de 85 mil lançamentos (~32MB) que falhava sempre como blob
// único mas gravava certinho em pedaços de ~20 mil. Journals menores (a
// esmagadora maioria das empresas) continuam gravando como uma linha só,
// sem nenhuma mudança de comportamento.
const JOURNAL_CHUNK_SIZE = 20000;

// `onProgress(fraction)` (0..1) deixa quem chamou mostrar uma barra/percentual
// de verdade em vez de só um "carregando" indefinido — importante justamente
// pros razões grandes o suficiente pra cair no caminho em pedaços abaixo, que
// são também os que mais demoram e mais sofrem com a conexão instável.
export async function writeCompanyJournal(companyId, journal, { onProgress } = {}) {
  const list = Array.isArray(journal) ? journal : [];
  const baseKey = companyJournalKey(companyId);
  const report = typeof onProgress === "function" ? onProgress : () => {};
  if (list.length <= JOURNAL_CHUNK_SIZE) {
    report(0);
    await writePersistent(baseKey, list);
    report(1);
    return;
  }
  const parts = [];
  for (let i = 0; i < list.length; i += JOURNAL_CHUNK_SIZE) parts.push(list.slice(i, i + JOURNAL_CHUNK_SIZE));
  // +1 unidade pro manifesto — ele só grava depois de TODAS as partes (ver
  // comentário abaixo), então sem contar essa última escrita a barra pularia
  // de "quase lá" pra "100%" antes dela realmente acontecer.
  const totalUnits = parts.length + 1;
  let doneUnits = 0;
  report(0);
  // As partes primeiro, o manifesto por último — se cair no meio (rede
  // caiu, aba fechou), uma leitura ainda vê o manifesto ANTIGO (ou
  // nenhum), nunca um manifesto novo apontando pra partes que não existem.
  await Promise.all(
    parts.map((part, index) =>
      writePersistent(`${baseKey}.part${index}`, part).then(() => {
        doneUnits += 1;
        report(doneUnits / totalUnits);
      })
    )
  );
  await writePersistent(baseKey, { __chunked: true, parts: parts.length });
  doneUnits += 1;
  report(doneUnits / totalUnits);
}

// `onProgress(fraction)` (0..1) — mesma ideia de writeCompanyJournal. Um
// razão grande em pedaços pode levar de verdade dezenas de segundos pra
// ler de volta (visto na prática: ~30s pra reler os mesmos ~31 mil
// lançamentos que levaram ~32s pra gravar) — sem isso, a tela que chamou
// não tem como distinguir "ainda carregando" de "razão realmente vazio".
export async function readCompanyJournal(companyId, { onProgress } = {}) {
  const baseKey = companyJournalKey(companyId);
  const report = typeof onProgress === "function" ? onProgress : () => {};
  report(0);
  const value = await readPersistent(baseKey);
  if (value && typeof value === "object" && !Array.isArray(value) && value.__chunked) {
    // Uma de cada vez, não Promise.all — pedir 5 pedaços de ~7MB TODOS ao
    // mesmo tempo é o que mais sobrecarrega uma conexão já instável (é
    // exatamente esse padrão que fazia razões grandes darem "não carregou"
    // com internet ruim). Sequencial é um pouco mais lento no caso feliz,
    // mas MUITO mais robusto quando a rede está capenga — e cada pedaço já
    // tem seu próprio retry via readPersistent.
    const pieces = [];
    for (let index = 0; index < value.parts; index += 1) {
      pieces.push(await readPersistent(`${baseKey}.part${index}`));
      report((index + 1) / value.parts);
    }
    return pieces.flatMap((piece) => (Array.isArray(piece) ? piece : []));
  }
  report(1);
  return Array.isArray(value) ? value : [];
}

export async function readStoredArray(key) {
  const stored = await readPersistent(key);
  return Array.isArray(stored) ? stored : [];
}

// Every row whose key starts with `prefix` — how the company list is loaded
// now (one row per company, see companyKey above) instead of one shared
// array under a single key.
export async function readPersistentByPrefix(prefix) {
  let data;
  try {
    data = await withReadRetries(() => supabase.from("app_storage").select("value").like("key", `${prefix}%`).abortSignal(readTimeoutSignal()));
  } catch (error) {
    console.error(`Falha ao listar "${prefix}*" do Supabase (mesmo tentando de novo):`, error);
    // Antes voltava [] aqui — pra loadCompanies() isso é indistinguível de
    // "não existe empresa nenhuma", o que apagava a lista inteira da tela
    // só por causa de uma falha de rede. Propaga o erro em vez disso.
    throw new PersistenceReadError(`Não consegui listar "${prefix}*" do Supabase.`, { cause: error });
  }
  return (data || []).map((row) => row.value);
}

// Apaga o razão da empresa por completo — a linha única (caso comum) ou o
// manifesto + todas as partes (caso uma empresa grande tenha sido dividida
// por writeCompanyJournal). Lê o manifesto primeiro só pra saber quantas
// partes existem; se não for chunked, isso não custa nada além da leitura
// normal que já aconteceria de qualquer jeito.
export async function deleteCompanyJournal(companyId) {
  const baseKey = companyJournalKey(companyId);
  let value;
  try {
    value = await readPersistent(baseKey);
  } catch {
    value = undefined;
  }
  await deletePersistent(baseKey);
  if (value && typeof value === "object" && !Array.isArray(value) && value.__chunked) {
    await Promise.all(Array.from({ length: value.parts }, (_, index) => deletePersistent(`${baseKey}.part${index}`)));
  }
}

export async function deletePersistent(key) {
  try {
    localStorage.removeItem(localKey(key));
  } catch {
    /* storage can be unavailable */
  }
  const { error } = await supabase.from("app_storage").delete().eq("key", key);
  if (error) console.error(`Falha ao apagar "${key}" do Supabase:`, error);
}
