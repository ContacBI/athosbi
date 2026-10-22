import JSZip from "jszip";
import { state } from "../data/useStore.js";
import { persistActiveCompany, fetchMonthlyReportBlob, restoreCompaniesAndGroups, fetchCompaniesAndGroups, restoreOneCompany } from "./companies.js";
import { savePlanoSnapshot, loadPlano } from "./planoStore.js";
import { restoreIndicatorOverrides, loadIndicatorOverrides } from "./indicators.js";
import { restoreRepresentantes, loadRepresentantes } from "./representantes.js";
import { restorePlanosPadrao, loadPlanosPadrao } from "./planosPadrao.js";
import { supabase, MONTHLY_REPORTS_BUCKET } from "./supabaseClient.js";
import { ASSISTANT_FAVORITES_KEY, SLIDE_LIBRARY_KEY, companyKey, readCompanyJournal, readPersistent, readStoredArray, writePersistent } from "./persistence.js";

// The plain JSON backup (lib/companies.js exportBackupPayload) only ever
// covered companies + groups, and deliberately left out monthly-report
// attachments since a Blob can't survive JSON.stringify. This is the "tudo
// tudo mesmo" version: one .zip with a manifest covering every gaveta of
// data in the app (empresas, grupos, plano gerencial, indicadores
// personalizados, representantes) PLUS the real attachment files
// themselves, fetched from Supabase Storage and embedded alongside it.

function slug(text) {
  return (
    String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "empresa"
  );
}

function collectAttachmentJobs(companies) {
  const jobs = [];
  companies.forEach((company) => {
    Object.entries(company.monthlyReports || {}).forEach(([monthKey, reports]) => {
      (reports || []).forEach((report) => {
        if (report.storagePath) jobs.push({ company, monthKey, report });
      });
    });
  });
  return jobs;
}

// `onProgress(done, total)` is optional — the UI uses it to show
// "Gerando backup... (N de M anexos)" while the attachments download, since
// a carteira with a lot of anexos can take a while (each is its own fetch
// from Storage).
export async function exportFullBackup(onProgress) {
  persistActiveCompany();

  // Busca tudo FRESCO do banco antes de montar o manifesto, em vez de
  // confiar no que já está na memória desta aba. state.companies/groups/
  // plano/indicatorOverrides/representantes só são carregados UMA vez, no
  // primeiro carregamento da página — se essa aba ficou aberta um tempo e
  // um grupo ou uma conta do plano gerencial foi criada nesse meio tempo
  // (nesta mesma aba noutra tela, ou em outra aba/dispositivo), o que está
  // na memória fica desatualizado e o backup saía incompleto sem avisar
  // nada. fetchCompaniesAndGroups() é a leitura pura (sem mexer em
  // activeCompanyId/activeGroupId, que resetaria a tela que o usuário está
  // vendo); loadPlano/loadIndicatorOverrides/loadRepresentantes já buscam
  // fresco e atualizam state sozinhos.
  const [{ companies, groups }] = await Promise.all([
    fetchCompaniesAndGroups(),
    loadPlano(),
    loadIndicatorOverrides(),
    loadRepresentantes(),
    loadPlanosPadrao(),
  ]);

  const zip = new JSZip();

  // Biblioteca do escritório (pedidos salvos e slides prontos, ver
  // lib/officeLibrary.js) — a partir da v4.
  const [assistantFavorites, slideLibrary] = await Promise.all([readStoredArray(ASSISTANT_FAVORITES_KEY), readStoredArray(SLIDE_LIBRARY_KEY)]);

  const manifest = {
    version: 4,
    exportedAt: new Date().toISOString(),
    activeCompanyId: state.activeCompanyId,
    activeGroupId: state.activeGroupId,
    companies,
    groups,
    // Sempre o global puro — nunca state.plano, que é o efetivo (global +
    // extras) de quem estiver ativo no momento do backup, não uma "gaveta"
    // de verdade (ver data/store.js).
    plano: state.planoGlobal,
    planosPadrao: state.planosPadrao,
    indicatorOverrides: state.indicatorOverrides,
    representantes: state.representantes,
    assistantFavorites,
    slideLibrary,
  };
  zip.file("backup.json", JSON.stringify(manifest));

  const jobs = collectAttachmentJobs(companies);
  let done = 0;
  onProgress?.(done, jobs.length);
  for (const job of jobs) {
    try {
      const blob = await fetchMonthlyReportBlob(job.report);
      const path = `anexos/${slug(job.company.name)}/${job.monthKey}/${job.report.id}_${job.report.name}`;
      zip.file(path, blob);
    } catch (error) {
      // A single missing/broken attachment shouldn't sink the whole backup —
      // everything else (all the data, every other file) still needs to
      // come through. It just won't be in this zip.
      console.error(`Falha ao baixar anexo "${job.report.name}" pro backup:`, error);
    }
    done += 1;
    onProgress?.(done, jobs.length);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup_geral_portal_${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(url);

  return { companies: companies.length, attachments: jobs.length };
}

// Restores everything a exportFullBackup() zip carries: companies (with
// their journal/mappings/dashboardTabs), groups, plano gerencial,
// indicadores personalizados, representantes, and the attachment files
// themselves — re-uploaded fresh to Storage (never assumed to still be
// sitting at their old storagePath, since this backup is meant to stand on
// its own even in a different Supabase project) with each company's
// monthlyReports pointed at the new paths before the company records are
// written.
export async function importFullBackup(file, onProgress) {
  const zip = await JSZip.loadAsync(file);
  const manifestEntry = zip.file("backup.json");
  if (!manifestEntry) throw new Error("Esse arquivo não parece um backup geral (sem backup.json).");
  const manifest = JSON.parse(await manifestEntry.async("string"));

  const companies = Array.isArray(manifest.companies) ? manifest.companies : [];
  const jobs = collectAttachmentJobs(companies);
  let done = 0;
  onProgress?.(done, jobs.length);
  for (const job of jobs) {
    const path = `anexos/${slug(job.company.name)}/${job.monthKey}/${job.report.id}_${job.report.name}`;
    const entry = zip.file(path);
    if (entry) {
      try {
        const blob = await entry.async("blob");
        const storagePath = `${job.company.id}/${job.monthKey}/${job.report.id}-${job.report.name}`;
        const { error } = await supabase.storage.from(MONTHLY_REPORTS_BUCKET).upload(storagePath, blob, {
          upsert: true,
          contentType: job.report.type || "application/octet-stream",
        });
        if (error) throw error;
        job.report.storagePath = storagePath;
      } catch (error) {
        console.error(`Falha ao restaurar anexo "${job.report.name}":`, error);
        // Keep the metadata but drop the now-broken path rather than point
        // at a file that was never actually re-uploaded.
        delete job.report.storagePath;
      }
    } else {
      delete job.report.storagePath;
    }
    done += 1;
    onProgress?.(done, jobs.length);
  }

  await restoreCompaniesAndGroups({
    companies,
    groups: manifest.groups,
    activeCompanyId: manifest.activeCompanyId,
  });
  if (Array.isArray(manifest.plano) && manifest.plano.length) savePlanoSnapshot(manifest.plano);
  restoreIndicatorOverrides(manifest.indicatorOverrides);
  restoreRepresentantes(manifest.representantes);
  // Só existe a partir da v3 do backup — versões antigas simplesmente não
  // tinham plano padrão nenhum ainda, restaura lista vazia nesse caso.
  restorePlanosPadrao(manifest.planosPadrao);
  if (Array.isArray(manifest.assistantFavorites)) writePersistent(ASSISTANT_FAVORITES_KEY, manifest.assistantFavorites);
  if (Array.isArray(manifest.slideLibrary)) writePersistent(SLIDE_LIBRARY_KEY, manifest.slideLibrary);

  return {
    companies: companies.length,
    groups: (manifest.groups || []).length,
    attachments: jobs.length,
  };
}

// ---------------------------------------------------------------------------
// Backup de UMA empresa ("Baixar tudo desta empresa", em Parâmetros →
// Empresas): o registro dela (De/Para, balancetes, painel, apresentações,
// orçamentos…) e o razão, lidos frescos do banco, mais planilhas CSV pra
// abrir no Excel e os anexos dela. O mesmo arquivo restaura só essa
// empresa (importCompanyBackup).

function csvCell(value) {
  if (typeof value === "number") return String(value).replace(".", ",");
  const text = String(value ?? "");
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFile(headers, rows) {
  const lines = [headers.map(([, label]) => label).join(";"), ...rows.map((row) => headers.map(([key]) => csvCell(row[key])).join(";"))];
  return `\uFEFF${lines.join("\r\n")}`;
}

const LEIA_ME = (company, journalCount, exportedAt) => `Backup da empresa ${company.name}${company.cnpj ? ` (CNPJ ${company.cnpj})` : ""}
Gerado pelo AthosBI em ${new Date(exportedAt).toLocaleString("pt-BR")}.

O que tem aqui:
- empresa.json: tudo da empresa no AthosBI (cadastro, De/Para, balancetes,
  abas do painel, apresentações, orçamentos, relatórios mensais) e o razão
  (${journalCount} lançamentos). É este arquivo que o AthosBI usa para restaurar.
- razao.csv, balancete.csv e de-para.csv: as mesmas informações em planilha,
  para abrir no Excel (separador ponto e vírgula).
- anexos/: os arquivos anexados aos relatórios mensais, se houver.

Para restaurar: Parâmetros → Empresas → "Restaurar backup" e escolha este
arquivo .zip. Só esta empresa é substituída; as outras não mudam.
`;

export async function exportCompanyBackup(companyId, onProgress) {
  if (companyId === state.activeCompanyId && !state.activeGroupId) await persistActiveCompany();
  const [record, journal] = await Promise.all([readPersistent(companyKey(companyId)), readCompanyJournal(companyId)]);
  if (!record?.id) throw new Error("Empresa não encontrada no banco.");
  const exportedAt = new Date().toISOString();
  const { journal: _embedded, ...company } = record;
  const lines = Array.isArray(journal) ? journal : [];
  const zip = new JSZip();
  zip.file("empresa.json", JSON.stringify({ version: 1, tipo: "backup-empresa", exportedAt, company, journal: lines }));
  zip.file("LEIA-ME.txt", LEIA_ME(company, lines.length, exportedAt));
  zip.file(
    "razao.csv",
    csvFile(
      [["data", "Data"], ["linha_origem", "Lançamento"], ["classificacao", "Classificação"], ["descricao_conta", "Conta"], ["historico", "Histórico"], ["debito", "Débito"], ["credito", "Crédito"], ["codigo_gerencial", "Conta gerencial"], ["categoria_gerencial", "Nome gerencial"]],
      lines
    )
  );
  zip.file(
    "balancete.csv",
    csvFile(
      [["classificacao", "Classificação"], ["codigo", "Código"], ["nome_conta", "Conta"], ["tipo_sintetica", "Sintética"], ["saldo_anterior", "Saldo anterior"], ["debito", "Débito"], ["credito", "Crédito"], ["saldo_atual", "Saldo atual"]],
      company.accounts || []
    )
  );
  zip.file(
    "de-para.csv",
    csvFile([["classificacao", "Classificação"], ["nome_conta", "Conta"], ["codigo_gerencial", "Conta gerencial"], ["categoria_gerencial", "Nome gerencial"], ["demonstrativo", "Demonstrativo"]], company.mappings || [])
  );
  const jobs = collectAttachmentJobs([company]);
  let done = 0;
  onProgress?.(done, jobs.length);
  for (const job of jobs) {
    try {
      zip.file(`anexos/${job.monthKey}/${job.report.id}_${job.report.name}`, await fetchMonthlyReportBlob(job.report));
    } catch (error) {
      console.error(`Falha ao baixar anexo "${job.report.name}" pro backup:`, error);
    }
    done += 1;
    onProgress?.(done, jobs.length);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backup_${slug(company.name)}_${exportedAt.slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(url);
  return { name: company.name, journal: lines.length, attachments: jobs.length };
}

// Lê um .zip e diz o que ele é: backup geral (backup.json) ou de uma
// empresa (empresa.json) — pra tela perguntar a coisa certa antes.
export async function inspectBackupFile(file) {
  const zip = await JSZip.loadAsync(file);
  if (zip.file("empresa.json")) {
    const payload = JSON.parse(await zip.file("empresa.json").async("string"));
    return { kind: "empresa", zip, payload, name: payload.company?.name || "", exportedAt: payload.exportedAt, journal: (payload.journal || []).length };
  }
  if (zip.file("backup.json")) return { kind: "geral", zip };
  return { kind: "desconhecido", zip };
}

export async function importCompanyBackup(inspected, onProgress) {
  const { zip, payload } = inspected;
  const company = structuredClone(payload.company);
  const jobs = collectAttachmentJobs([company]);
  let done = 0;
  onProgress?.(done, jobs.length);
  for (const job of jobs) {
    const entry = zip.file(`anexos/${job.monthKey}/${job.report.id}_${job.report.name}`);
    if (entry) {
      try {
        const blob = await entry.async("blob");
        const storagePath = `${company.id}/${job.monthKey}/${job.report.id}-${job.report.name}`;
        const { error } = await supabase.storage.from(MONTHLY_REPORTS_BUCKET).upload(storagePath, blob, { upsert: true, contentType: job.report.type || "application/octet-stream" });
        if (error) throw error;
        job.report.storagePath = storagePath;
      } catch (error) {
        console.error(`Falha ao restaurar anexo "${job.report.name}":`, error);
        delete job.report.storagePath;
      }
    } else {
      delete job.report.storagePath;
    }
    done += 1;
    onProgress?.(done, jobs.length);
  }
  await restoreOneCompany({ company, journal: payload.journal || [] });
  return { name: company.name, journal: (payload.journal || []).length, attachments: jobs.length };
}
