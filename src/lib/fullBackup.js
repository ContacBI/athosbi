import JSZip from "jszip";
import { state } from "../data/useStore.js";
import { persistActiveCompany, fetchMonthlyReportBlob, restoreCompaniesAndGroups, fetchCompaniesAndGroups } from "./companies.js";
import { savePlanoSnapshot, loadPlano } from "./planoStore.js";
import { restoreIndicatorOverrides, loadIndicatorOverrides } from "./indicators.js";
import { restoreRepresentantes, loadRepresentantes } from "./representantes.js";
import { restorePlanosPadrao, loadPlanosPadrao } from "./planosPadrao.js";
import { supabase, MONTHLY_REPORTS_BUCKET } from "./supabaseClient.js";

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

  const manifest = {
    version: 3,
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

  return {
    companies: companies.length,
    groups: (manifest.groups || []).length,
    attachments: jobs.length,
  };
}
