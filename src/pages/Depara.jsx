import { useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Search, TriangleAlert, Upload, X } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { persistActiveCompany, remapJournal } from "../lib/companies.js";
import { parseCsv } from "../importers/csv.js";
import { NATURE_LABELS, accountNature, planoNature } from "../lib/accountNature.js";

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const MAPPING_HEADERS = [
  "codigo_conta",
  "classificacao",
  "nome_conta",
  "tipo_conta",
  "codigo_gerencial",
  "categoria_gerencial",
  "demonstrativo",
  "grupo_macro",
  "observacao",
];

function mappingsToCsv(mappings) {
  const lines = [MAPPING_HEADERS.join(";")];
  mappings.forEach((row) => {
    lines.push(MAPPING_HEADERS.map((key) => String(row[key] ?? "").replace(/;/g, ",")).join(";"));
  });
  return lines.join("\n");
}

// Popover combobox for picking the target managerial account — only
// `aceita_depara === "sim"` rows are valid landing spots (the plano's
// synthetic/rollup levels aren't something a real ledger account maps to
// directly), and only rows of the same natureza (Ativo/Passivo/PL/
// Resultado) as the ledger account being mapped — see lib/accountNature.js.
function AccountPicker({ options, natureLabel, onSelect, onClear, hasCurrent, onClose }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query) return options.slice(0, 60);
    const normalized = normalize(query);
    return options.filter((row) => normalize(`${row.codigo_gerencial} ${row.nome}`).includes(normalized)).slice(0, 60);
  }, [options, query]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-[calc(100%+6px)] z-50 flex max-h-80 w-80 flex-col overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-line">
        <div className="relative shrink-0 border-b border-line p-2">
          <Search size={13} className="pointer-events-none absolute left-4.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conta gerencial…"
            className="w-full rounded-md border border-line-strong py-1.5 pl-7 pr-2 text-[12.5px] outline-none focus:border-accent-500"
          />
          {natureLabel && (
            <p className="mt-1.5 text-[10.5px] text-ink-400">
              Mostrando só linhas de <span className="font-medium text-ink-600">{natureLabel}</span> — mesma natureza dessa conta.
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {hasCurrent && (
            <button
              type="button"
              onClick={onClear}
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-danger-600 hover:bg-danger-50"
            >
              <X size={13} strokeWidth={1.8} />
              Remover vínculo
            </button>
          )}
          {filtered.length === 0 && <p className="px-2.5 py-3 text-[12px] text-ink-400">Nenhuma conta gerencial encontrada.</p>}
          {filtered.map((row) => (
            <button
              key={row.codigo_gerencial}
              type="button"
              onClick={() => onSelect(row)}
              className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-surface-muted"
            >
              <span className="text-[12.5px] text-ink-800">{row.nome}</span>
              <span className="text-[11px] text-ink-400">
                {row.codigo_gerencial} · {row.demonstrativo}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function Depara() {
  const state = useAppState();
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [demonstrativoFilter, setDemonstrativoFilter] = useState("todos");
  const [openPickerFor, setOpenPickerFor] = useState(null);
  const [busy, setBusy] = useState("");
  const importInputRef = useRef(null);

  const mappingByClass = useMemo(() => new Map(state.mappings.map((row) => [row.classificacao, row])), [state.mappings]);
  const planoOptions = useMemo(
    () => state.plano.filter((row) => row.aceita_depara === "sim").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [state.plano]
  );
  // Same list, split by natureza (Ativo/Passivo/PL/Resultado) — so each
  // account's picker only ever offers lines from its own side of the
  // balance sheet / DRE, instead of the full plano every time.
  const planoByNature = useMemo(() => {
    const byNature = new Map();
    planoOptions.forEach((row) => {
      const nature = planoNature(row);
      if (!byNature.has(nature)) byNature.set(nature, []);
      byNature.get(nature).push(row);
    });
    return byNature;
  }, [planoOptions]);

  function optionsForAccount(account) {
    const nature = accountNature(account.classificacao, state.natureRules);
    // Unclassified (doesn't match any configured prefix) falls back to the
    // full list rather than an empty, dead-end picker.
    if (!nature) return { options: planoOptions, natureLabel: null };
    return { options: planoByNature.get(nature) || [], natureLabel: NATURE_LABELS[nature] };
  }

  const accountRows = useMemo(() => {
    return state.accounts
      .filter((account) => account.tipo_sintetica === "nao")
      .map((account) => ({ account, mapping: mappingByClass.get(account.classificacao) || null }))
      .sort((a, b) => a.account.classificacao.localeCompare(b.account.classificacao, "pt-BR", { numeric: true }));
  }, [state.accounts, mappingByClass]);

  const pendingCount = accountRows.filter((row) => !row.mapping).length;

  const filtered = accountRows.filter(({ account, mapping }) => {
    if (onlyPending && mapping) return false;
    if (demonstrativoFilter !== "todos" && mapping?.demonstrativo !== demonstrativoFilter) return false;
    if (!search) return true;
    const haystack = normalize(
      `${account.classificacao} ${account.nome_conta} ${mapping?.categoria_gerencial || ""} ${mapping?.codigo_gerencial || ""}`
    );
    return haystack.includes(normalize(search));
  });

  function flashBusy(message) {
    setBusy(message);
    setTimeout(() => setBusy(""), 3000);
  }

  function applyMapping(account, planoRow) {
    const next = state.mappings.filter((row) => row.classificacao !== account.classificacao);
    if (planoRow) {
      next.push({
        codigo_conta: account.codigo,
        classificacao: account.classificacao,
        nome_conta: account.nome_conta,
        tipo_conta: "",
        codigo_gerencial: planoRow.codigo_gerencial,
        categoria_gerencial: planoRow.nome,
        demonstrativo: planoRow.demonstrativo,
        grupo_macro: planoRow.grupo_macro,
        observacao: "",
      });
    }
    // Re-stamp the already-loaded journal immediately — without this, every
    // report keeps showing the old classification until the company is
    // reselected, since journal entries cache codigo_gerencial at import time.
    setData({ mappings: next, journal: remapJournal(state.journal, next) });
    persistActiveCompany();
    setOpenPickerFor(null);
  }

  async function handleImportCsv(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    flashBusy("Importando de/para...");
    try {
      const rows = parseCsv(await file.text());
      setData({ mappings: rows, journal: remapJournal(state.journal, rows) });
      persistActiveCompany();
      flashBusy(`De/para importado: ${rows.length} vínculos.`);
    } catch {
      flashBusy("Não consegui ler esse arquivo de de/para.");
    }
  }

  function handleExportCsv() {
    const blob = new Blob(["﻿" + mappingsToCsv(state.mappings)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "de_para.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Dados</span>
          <h1 className="mt-1 text-[20px] font-semibold text-ink-900">De/Para</h1>
          <p className="mt-0.5 text-[13px] text-ink-400">
            {accountRows.length} contas contábeis ·{" "}
            {pendingCount > 0 ? (
              <span className="font-medium text-warning-600">{pendingCount} sem vínculo</span>
            ) : (
              <span className="font-medium text-success-600">todas vinculadas</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted"
          >
            <Download size={14} strokeWidth={1.8} />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
          >
            <Upload size={14} strokeWidth={1.8} />
            Importar CSV
          </button>
        </div>
      </div>

      {busy && <p className="rounded-lg bg-accent-50 px-3 py-2 text-[12px] text-accent-700">{busy}</p>}

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conta contábil ou gerencial…"
            className="w-full rounded-md border border-line-strong py-1.5 pl-7 pr-2 text-[12.5px] outline-none focus:border-accent-500"
          />
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted p-1">
          {[
            { id: "todos", label: "Todos" },
            { id: "BP", label: "Balanço" },
            { id: "DRE", label: "DRE" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setDemonstrativoFilter(option.id)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                demonstrativoFilter === option.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
          <input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} />
          Só pendentes
        </label>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-3 border-b border-line bg-surface-muted px-4 py-2 text-[11px] font-medium text-ink-400">
          <span>Código</span>
          <span>Conta contábil</span>
          <span>Conta gerencial</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-400">Nenhuma conta encontrada com esse filtro.</p>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto">
            {filtered.map(({ account, mapping }) => {
              const { options: pickerOptions, natureLabel } = optionsForAccount(account);
              return (
              <div
                key={account.classificacao}
                className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_40px] items-center gap-3 border-b border-line px-4 py-2 text-[13px] last:border-b-0 hover:bg-surface-muted"
              >
                <span className="truncate text-[12px] text-ink-400">{account.classificacao}</span>
                <span className="truncate text-ink-800">{account.nome_conta}</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenPickerFor(openPickerFor === account.classificacao ? null : account.classificacao)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                      mapping
                        ? "border-line-strong bg-white text-ink-800 hover:border-accent-400"
                        : "border-dashed border-warning-400 bg-warning-50 text-warning-700 hover:border-warning-500"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {mapping ? (
                        <>
                          {mapping.categoria_gerencial}
                          <span className="ml-1.5 text-ink-400">· {mapping.demonstrativo}</span>
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <TriangleAlert size={12} strokeWidth={2} />
                          Selecionar conta
                        </span>
                      )}
                    </span>
                    <ChevronDown size={12} className="shrink-0 text-ink-400" />
                  </button>
                  {openPickerFor === account.classificacao && (
                    <AccountPicker
                      options={pickerOptions}
                      natureLabel={natureLabel}
                      hasCurrent={Boolean(mapping)}
                      onSelect={(planoRow) => applyMapping(account, planoRow)}
                      onClear={() => applyMapping(account, null)}
                      onClose={() => setOpenPickerFor(null)}
                    />
                  )}
                </div>
                <div className="flex justify-center">
                  {mapping && (
                    <button
                      type="button"
                      onClick={() => applyMapping(account, null)}
                      aria-label={`Remover vínculo de ${account.nome_conta}`}
                      title="Remover vínculo"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-300 hover:bg-danger-50 hover:text-danger-600"
                    >
                      <X size={14} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
    </div>
  );
}
