import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileCheck2, FilePlus2, RotateCcw, Trash2, Upload } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { attachMonthlyReport, fetchMonthlyReportBlob, removeMonthlyReport, replaceAccounts, restorePreviousBalancete } from "../lib/companies.js";
import { importBalancete, importDiario } from "../importers/dominio.js";
import { attachJournalMonths, journalCountForMonth, journalMonthsPresent, removeJournalMonth } from "../lib/journalMonths.js";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function defaultYear(journal) {
  const dates = (journal || []).map((entry) => entry.data).filter(Boolean).sort();
  const latest = dates[dates.length - 1];
  return latest ? Number(latest.slice(0, 4)) : new Date().getFullYear();
}

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function monthLabelFromKey(key) {
  const [, month] = key.split("-");
  return `${MONTHS[Number(month) - 1]?.slice(0, 3)}/${key.slice(2, 4)}`;
}

export default function RelatoriosMensais() {
  const state = useAppState();
  const company = state.companies.find((item) => item.id === state.activeCompanyId);
  const [year, setYear] = useState(() => defaultYear(state.journal));
  const [openMonth, setOpenMonth] = useState(null);
  const [busy, setBusy] = useState("");
  const fileInputRef = useRef(null);
  const diarioInputRef = useRef(null);
  const balanceteInputRef = useRef(null);
  const pendingMonthRef = useRef(null);

  const monthlyReports = company?.monthlyReports || {};
  const lastBalancete = company?.lastBalanceteMeta;
  const attachedMonths = journalMonthsPresent();

  function monthKey(index) {
    return `${year}-${String(index + 1).padStart(2, "0")}`;
  }

  function flashBusy(message) {
    setBusy(message);
    setTimeout(() => setBusy(""), 3500);
  }

  // Every lançamento carries its own date — importing (or re-importing) a
  // diário only ever touches the month(s) actually present in that file,
  // so uploading 6 months at once flags all 6, and uploading just month 6
  // again later only refreshes month 6, leaving the rest untouched.
  async function handleDiarioChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    flashBusy("Importando diário...");
    try {
      const chunks = await Promise.all(files.map((file) => importDiario(file, state.mappings)));
      const months = attachJournalMonths(chunks.flat());
      flashBusy(months.length ? `Meses atualizados: ${months.map(monthLabelFromKey).join(", ")}` : "Nenhum lançamento reconhecido nesse arquivo.");
    } catch {
      flashBusy("Não consegui ler esse arquivo de diário.");
    }
  }

  // Balancete is a single cumulative snapshot, not a per-month file — a new
  // upload always replaces the chart of accounts wholesale (that's how the
  // source accounting software exports it), so there's just one "current"
  // balancete with a status line, not 12 month squares to fill in.
  async function handleBalanceteChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    flashBusy("Importando balancete...");
    try {
      const accounts = await importBalancete(file);
      // Keeps a one-shot backup of whatever balancete this is replacing —
      // see replaceAccounts in lib/companies.js.
      replaceAccounts(accounts, { name: file.name, uploadedAt: new Date().toISOString(), accountsCount: accounts.length });
      flashBusy(`Balancete atualizado: ${accounts.length} contas.`);
    } catch {
      flashBusy("Não consegui ler esse arquivo de balancete.");
    }
  }

  function handleRestoreBalancete() {
    const backup = company?.previousBalancete;
    if (!backup) return;
    const when = backup.meta ? `"${backup.meta.name}" (${backup.meta.accountsCount} contas)` : `${backup.accounts.length} contas`;
    if (!window.confirm(`Voltar para o balancete anterior — ${when}? O balancete atual será substituído.`)) return;
    restorePreviousBalancete();
    flashBusy("Balancete anterior restaurado.");
  }

  function handleSquareClick(index) {
    setOpenMonth(openMonth === index ? null : index);
  }

  function handleUploadClick(index) {
    pendingMonthRef.current = monthKey(index);
    fileInputRef.current?.click();
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !pendingMonthRef.current) return;
    setBusy("Enviando arquivo…");
    try {
      await attachMonthlyReport(pendingMonthRef.current, file, "outro");
      setBusy("");
    } catch (error) {
      console.error("Falha ao enviar anexo:", error);
      setBusy("Não consegui enviar o arquivo — tenta de novo.");
      setTimeout(() => setBusy(""), 3500);
    }
  }

  function handleRemoveMonthJournal(index) {
    const key = monthKey(index);
    const count = journalCountForMonth(key);
    if (!count) return;
    if (!window.confirm(`Remover os ${count} lançamentos de ${MONTHS[index]}/${year}? Os outros meses não são afetados.`)) return;
    removeJournalMonth(key);
  }

  async function openFile(report) {
    setBusy("Abrindo arquivo…");
    try {
      const blob = await fetchMonthlyReportBlob(report);
      setBusy("");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      console.error("Falha ao baixar anexo:", error);
      setBusy("Não consegui abrir o arquivo.");
      setTimeout(() => setBusy(""), 3500);
    }
  }

  const openKey = openMonth !== null ? monthKey(openMonth) : null;
  const openArchiveReports = (openKey ? monthlyReports[openKey] || [] : []).filter((report) => (report.kind || "outro") === "outro");
  const openJournalCount = openKey ? journalCountForMonth(openKey) : 0;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Dados</span>
          <h1 className="mt-1 text-[20px] font-semibold text-ink-900">Relatórios mensais</h1>
          <p className="mt-0.5 text-[13px] text-ink-400">Importe o diário e o balancete aqui — o app reconhece o mês de cada lançamento sozinho.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setYear((value) => value - 1)}
            aria-label="Ano anterior"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-white"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="w-14 text-center text-[14px] font-semibold text-ink-900">{year}</span>
          <button
            type="button"
            onClick={() => setYear((value) => value + 1)}
            aria-label="Próximo ano"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-white"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Diário</p>
            <p className="mt-1 text-[14px] font-medium text-ink-900">
              {state.journal.length} lançamentos · {attachedMonths.size} {attachedMonths.size === 1 ? "mês" : "meses"}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-400">Reimportar um mês só atualiza aquele mês.</p>
          </div>
          <button
            type="button"
            onClick={() => diarioInputRef.current?.click()}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
          >
            <Upload size={14} strokeWidth={1.8} />
            Importar
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Balancete</p>
            <p className="mt-1 text-[14px] font-medium text-ink-900">{state.accounts.length} contas carregadas</p>
            <p className="mt-0.5 truncate text-[12px] text-ink-400">
              {lastBalancete
                ? `Enviado em ${new Date(lastBalancete.uploadedAt).toLocaleDateString("pt-BR")} · ${lastBalancete.name}`
                : "Nenhum balancete enviado ainda."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {company?.previousBalancete && (
              <button
                type="button"
                onClick={handleRestoreBalancete}
                title="Desfazer a última importação de balancete"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line-strong text-ink-500 transition-colors hover:bg-surface-muted"
              >
                <RotateCcw size={14} strokeWidth={1.8} />
              </button>
            )}
            <button
              type="button"
              onClick={() => balanceteInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-medium text-ink-700 transition-colors hover:bg-surface-muted"
            >
              <Upload size={14} strokeWidth={1.8} />
              Importar
            </button>
          </div>
        </div>
      </div>

      {busy && <p className="rounded-lg bg-accent-50 px-3 py-2 text-[12px] text-accent-700">{busy}</p>}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {MONTHS.map((label, index) => {
          const key = monthKey(index);
          const count = journalCountForMonth(key);
          const hasJournal = attachedMonths.has(key);
          const archiveCount = (monthlyReports[key] || []).filter((report) => (report.kind || "outro") === "outro").length;
          const isOpen = openMonth === index;
          return (
            <button
              key={label}
              type="button"
              onClick={() => handleSquareClick(index)}
              className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                isOpen
                  ? "border-accent-500 ring-2 ring-accent-100"
                  : hasJournal
                    ? "border-line bg-white"
                    : "border-dashed border-line-strong bg-surface-page"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  hasJournal ? "bg-accent-50 text-accent-600" : "bg-surface-muted text-ink-300"
                }`}
              >
                {hasJournal ? <FileCheck2 size={19} strokeWidth={1.8} /> : <FilePlus2 size={19} strokeWidth={1.7} />}
              </span>
              <span className={`text-[13px] font-medium ${hasJournal ? "text-ink-900" : "text-ink-400"}`}>{label}</span>
              <span className="text-[11px] text-ink-400">
                {hasJournal ? `${count} lançamento${count > 1 ? "s" : ""}` : "vazio"}
                {archiveCount > 0 ? ` · ${archiveCount} anexo${archiveCount > 1 ? "s" : ""}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {openMonth !== null && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-ink-900">
            {MONTHS[openMonth]} de {year}
          </h2>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface-page p-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink-900">Diário deste mês</p>
              <p className="text-[12px] text-ink-400">
                {openJournalCount > 0 ? `${openJournalCount} lançamentos importados` : "Nenhum lançamento neste mês ainda."}
              </p>
            </div>
            {openJournalCount > 0 && (
              <button
                type="button"
                onClick={() => handleRemoveMonthJournal(openMonth)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-danger-600 hover:bg-danger-50"
              >
                <Trash2 size={14} strokeWidth={1.8} />
                Remover
              </button>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-ink-900">Outros arquivos</h3>
              <button
                type="button"
                onClick={() => handleUploadClick(openMonth)}
                className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
              >
                <FilePlus2 size={14} strokeWidth={1.8} />
                Anexar
              </button>
            </div>

            {openArchiveReports.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-400">Nenhum arquivo avulso guardado neste mês.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {openArchiveReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-page p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                        <FileCheck2 size={17} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-900">{report.name}</p>
                        <p className="text-[11px] text-ink-400">
                          {formatSize(report.size)} · anexado em {new Date(report.uploadedAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openFile(report)}
                        aria-label={`Abrir ${report.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-600 hover:bg-white"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMonthlyReport(openKey, report.id)}
                        aria-label={`Remover ${report.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-danger-600 hover:bg-danger-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <input ref={diarioInputRef} type="file" accept=".xlsx,.xls,.csv" multiple className="hidden" onChange={handleDiarioChange} />
      <input ref={balanceteInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBalanceteChange} />
      <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
