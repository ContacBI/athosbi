import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, FileCheck2, FilePlus2, ListChecks, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { attachMonthlyReport, fetchMonthlyReportBlob, removeMonthlyReport, replaceAccounts, restorePreviousBalancete } from "../lib/companies.js";
import { importBalancete, importDiario } from "../importers/dominio.js";
import { attachJournalMonths, journalCountForMonth, journalMonthsPresent, removeJournalMonth, removeJournalMonths } from "../lib/journalMonths.js";

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
  // Separado do texto em si pra poder pintar a faixa de vermelho quando é um
  // erro de verdade (ex.: exclusão/importação que não salvou no Supabase) —
  // sem isso, um erro ficava com a mesma cor "info" azul de qualquer outro
  // aviso, fácil demais de ignorar justamente na hora que mais importa.
  const [busyIsError, setBusyIsError] = useState(false);
  // Selecionar vários meses de uma vez pra excluir o diário deles junto —
  // antes só dava pra excluir mês a mês, um clique + confirmação por vez,
  // o que ficava bem lento pra limpar um ano inteiro. Só existe dentro de
  // um ano por vez (a grade só mostra 12 meses do ano ativo mesmo), então
  // a seleção zera ao trocar de ano — mais simples do que tentar carregar
  // seleção "invisível" de outro ano.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
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
    setBusyIsError(false);
    setBusy(message);
    setTimeout(() => setBusy(""), 3500);
  }

  // Erros de salvar de verdade (conexão caiu no meio da escrita, etc.) ficam
  // visíveis mais tempo que um flashBusy comum — o usuário precisa ter tempo
  // de ler que a ação NÃO foi salva de verdade, não só ver algo piscar — e
  // com a faixa vermelha em vez do azul "info" de todo o resto.
  function flashError(message) {
    setBusyIsError(true);
    setBusy(message);
    setTimeout(() => setBusy(""), 7000);
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
    let entries;
    try {
      const chunks = await Promise.all(files.map((file) => importDiario(file, state.mappings)));
      entries = chunks.flat();
    } catch {
      flashBusy("Não consegui ler esse arquivo de diário.");
      return;
    }
    if (!entries.length) {
      flashBusy("Nenhum lançamento reconhecido nesse arquivo.");
      return;
    }
    // attachJournalMonths só resolve depois que o Supabase confirmou a
    // escrita de verdade (com as tentativas internas dele já esgotadas) —
    // se ela rejeitar, o próprio attachJournalMonths já desfez a mudança
    // otimista local, então a tela junto do banco: nenhum dos dois mostra
    // o mês como importado.
    try {
      const months = await attachJournalMonths(entries);
      flashBusy(`Meses atualizados: ${months.map(monthLabelFromKey).join(", ")}`);
    } catch (error) {
      console.error("Falha ao salvar diário importado:", error);
      flashError("Não consegui salvar de verdade — a conexão falhou e esse arquivo NÃO foi importado. Tenta de novo.");
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
    setBusyIsError(false);
    setBusy("Enviando arquivo…");
    try {
      await attachMonthlyReport(pendingMonthRef.current, file, "outro");
      setBusy("");
    } catch (error) {
      console.error("Falha ao enviar anexo:", error);
      flashError("Não consegui enviar o arquivo — tenta de novo.");
    }
  }

  async function handleRemoveMonthJournal(index) {
    const key = monthKey(index);
    const count = journalCountForMonth(key);
    if (!count) return;
    if (!window.confirm(`Remover os ${count} lançamentos de ${MONTHS[index]}/${year}? Os outros meses não são afetados.`)) return;
    setBusyIsError(false);
    setBusy("Excluindo...");
    try {
      await removeJournalMonth(key);
      flashBusy(`${MONTHS[index]}/${year} excluído.`);
    } catch (error) {
      console.error("Falha ao excluir mês do diário:", error);
      // removeJournalMonth já reverteu a remoção otimista local, então os
      // lançamentos continuam ali (e continuam no Supabase) — o erro aqui é
      // só pra deixar isso claro pro usuário, não pra "desfazer" nada.
      flashError(`Não consegui excluir de verdade ${MONTHS[index]}/${year} — a conexão falhou e os lançamentos continuam salvos. Tenta de novo.`);
    }
  }

  function toggleSelectMode() {
    setSelectMode((current) => !current);
    setSelectedKeys(new Set());
    setOpenMonth(null);
  }

  function toggleMonthSelected(index) {
    const key = monthKey(index);
    if (!journalCountForMonth(key)) return; // nada pra excluir nesse mês
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleBulkRemove() {
    const keys = [...selectedKeys];
    const total = keys.reduce((sum, key) => sum + journalCountForMonth(key), 0);
    if (!keys.length || !total) return;
    const meses = keys.map((key) => monthLabelFromKey(key)).join(", ");
    if (!window.confirm(`Remover o diário de ${keys.length} mês${keys.length === 1 ? "" : "es"} (${meses}) — ${total} lançamentos no total? Essa ação não pode ser desfeita.`)) return;
    setBusyIsError(false);
    setBusy("Excluindo...");
    try {
      // Um único setData + uma única escrita no Supabase pros meses todos —
      // ver o comentário de removeJournalMonths em lib/journalMonths.js.
      await removeJournalMonths(keys);
      flashBusy(`${keys.length} mês${keys.length === 1 ? "" : "es"} excluído${keys.length === 1 ? "" : "s"}: ${meses}.`);
      setSelectedKeys(new Set());
      setSelectMode(false);
    } catch (error) {
      console.error("Falha ao excluir meses do diário:", error);
      // Mantém a seleção e o modo de seleção ligados de propósito — a
      // exclusão não foi salva de verdade (e já foi revertida localmente),
      // então o usuário só precisa clicar em "Excluir selecionados" de novo.
      flashError(`Não consegui excluir de verdade — a conexão falhou e os ${total} lançamentos continuam salvos. Tenta de novo.`);
    }
  }

  async function openFile(report) {
    setBusyIsError(false);
    setBusy("Abrindo arquivo…");
    try {
      const blob = await fetchMonthlyReportBlob(report);
      setBusy("");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      console.error("Falha ao baixar anexo:", error);
      flashError("Não consegui abrir o arquivo.");
    }
  }

  const openKey = openMonth !== null ? monthKey(openMonth) : null;
  const openArchiveReports = (openKey ? monthlyReports[openKey] || [] : []).filter((report) => (report.kind || "outro") === "outro");
  const openJournalCount = openKey ? journalCountForMonth(openKey) : 0;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Dados</span>
          <h1 className="mt-1 text-[20px] font-semibold text-ink-900">Relatórios mensais</h1>
          <p className="mt-0.5 text-[13px] text-ink-400">Importe o diário e o balancete aqui — o app reconhece o mês de cada lançamento sozinho.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => { setYear((value) => value - 1); setSelectedKeys(new Set()); }}
              aria-label="Ano anterior"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-surface-card"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="w-14 text-center text-[14px] font-semibold text-ink-900">{year}</span>
            <button
              type="button"
              onClick={() => { setYear((value) => value + 1); setSelectedKeys(new Set()); }}
              aria-label="Próximo ano"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-surface-card"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleSelectMode}
            disabled={!attachedMonths.size && !selectMode}
            title="Selecionar vários meses pra excluir o diário deles de uma vez"
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selectMode ? "bg-danger-500 text-white hover:bg-danger-600" : "border border-line-strong text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {selectMode ? <X size={14} strokeWidth={1.8} /> : <ListChecks size={14} strokeWidth={1.8} />}
            {selectMode ? "Cancelar seleção" : "Selecionar vários"}
          </button>
        </div>
      </div>

      {selectMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-50 px-4 py-3 text-danger-700">
          <p className="text-[13px] font-medium">
            {selectedKeys.size === 0
              ? "Clique nos meses abaixo pra marcar quais excluir."
              : `${selectedKeys.size} mês${selectedKeys.size === 1 ? "" : "es"} selecionado${selectedKeys.size === 1 ? "" : "s"} · ${[...selectedKeys].reduce((sum, key) => sum + journalCountForMonth(key), 0)} lançamentos no total`}
          </p>
          <button
            type="button"
            onClick={handleBulkRemove}
            disabled={selectedKeys.size === 0}
            className="flex items-center gap-1.5 rounded-md bg-danger-600 px-3.5 py-2 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} strokeWidth={1.8} />
            Excluir selecionados
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
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

        <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
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

      {busy && (
        <p
          className={`rounded-lg px-3 py-2 text-[12px] font-medium ${
            busyIsError ? "bg-danger-50 text-danger-700" : "bg-accent-50 text-accent-700"
          }`}
        >
          {busy}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {MONTHS.map((label, index) => {
          const key = monthKey(index);
          const count = journalCountForMonth(key);
          const hasJournal = attachedMonths.has(key);
          const archiveCount = (monthlyReports[key] || []).filter((report) => (report.kind || "outro") === "outro").length;
          const isOpen = openMonth === index;
          const isSelected = selectedKeys.has(key);
          return (
            <button
              key={label}
              type="button"
              onClick={() => (selectMode ? toggleMonthSelected(index) : handleSquareClick(index))}
              disabled={selectMode && !hasJournal}
              className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                selectMode ? "" : "hover:-translate-y-0.5 hover:shadow-md"
              } ${
                isSelected
                  ? "border-danger-500 bg-danger-50 ring-2 ring-danger-200"
                  : isOpen
                    ? "border-accent-500 ring-2 ring-accent-100"
                    : hasJournal
                      ? "border-line bg-surface-card"
                      : "border-dashed border-line-strong bg-surface-page"
              }`}
            >
              {selectMode && hasJournal && (
                <span
                  className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    isSelected ? "border-danger-500 bg-danger-500 text-white" : "border-line-strong bg-surface-card"
                  }`}
                >
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </span>
              )}
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
        <div className="rounded-xl bg-surface-card p-5 shadow-sm">
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
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-600 hover:bg-surface-card"
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
