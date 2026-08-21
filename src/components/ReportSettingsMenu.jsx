import { useState } from "react";
import { Settings2 } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";
import { persistActiveCompany } from "../lib/companies.js";
import { DENSITY_OPTIONS, writeStoredDensity } from "../lib/density.js";

export default function ReportSettingsMenu({ tab }) {
  const state = useAppState();
  const [open, setOpen] = useState(false);

  const nonOperatingOptions = state.plano
    .filter((row) => String(row.demonstrativo || "").toUpperCase() === "DRE")
    .filter((row) => String(row.codigo_gerencial || "").startsWith("DRE.14."))
    .filter((row) => Number(row.nivel || 0) >= 3)
    .sort((a, b) => String(a.codigo_gerencial).localeCompare(String(b.codigo_gerencial), "pt-BR", { numeric: true }));

  const excluded = new Set(state.excludedNonOperatingCodes || []);
  const totalKey = tab === "BP" ? "showReportTotalBP" : tab === "DRE" ? "showReportTotalDRE" : "showReportTotalDFC";
  const canShowPrevious = tab === "BP" || tab === "DRE";

  function toggleExcluded(code) {
    const next = new Set(excluded);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    saveSettings({ excludedNonOperatingCodes: Array.from(next) });
  }

  function saveSettings(next) {
    setData(next);
    persistActiveCompany();
  }

  // Espaçamento das linhas é pessoal deste computador (ver lib/density.js)
  // — nunca passa por persistActiveCompany, só localStorage local.
  function setDensity(id) {
    setData({ reportDensity: id });
    writeStoredDensity(id);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Configurações do relatório"
        title="Configurações"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-500 transition-colors hover:bg-surface-muted"
      >
        <Settings2 size={14} strokeWidth={1.8} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-xl bg-surface-card p-3 shadow-lg ring-1 ring-line">
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={state.reportCompare}
                onChange={(event) => saveSettings({ reportCompare: event.target.checked })}
              />
              Comparar meses
            </label>
            {canShowPrevious && (
              <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={tab === "BP" ? state.showPreviousBalanceBP : state.showPreviousBalanceDRE}
                onChange={(event) =>
                  saveSettings({ [tab === "BP" ? "showPreviousBalanceBP" : "showPreviousBalanceDRE"]: event.target.checked })
                }
              />
              Mostrar saldo anterior
              </label>
            )}
            {tab !== "DFC" && !(tab === "BP" && state.bpMonthlyMode === "accumulated") && (
              <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
                <input
                  type="checkbox"
                  checked={Boolean(state[totalKey])}
                  onChange={(event) => saveSettings({ [totalKey]: event.target.checked })}
                />
                Mostrar coluna saldo total
              </label>
            )}

            {tab === "BP" && state.reportCompare && (
              <label className="mt-1 block px-2 py-1.5 text-[12px] text-ink-600">
                Valores mensais do balanço
                <select
                  value={state.bpMonthlyMode}
                  onChange={(event) => saveSettings({ bpMonthlyMode: event.target.value === "accumulated" ? "accumulated" : "movement" })}
                  className="mt-1 w-full rounded-md border border-line-strong px-2 py-1.5 text-[12px]"
                >
                  <option value="accumulated">Saldo acumulado até o mês</option>
                  <option value="movement">Movimento de cada mês</option>
                </select>
              </label>
            )}

            <div className="my-1.5 border-t border-line" />

            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={state.hideZeroNoMovement}
                onChange={(event) => saveSettings({ hideZeroNoMovement: event.target.checked })}
              />
              Ocultar contas zeradas
            </label>
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={Boolean(state.hideNonOperatingResults)}
                onChange={(event) => saveSettings({ hideNonOperatingResults: event.target.checked })}
              />
              Ocultar resultados não operacionais
            </label>

            {state.hideNonOperatingResults && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-surface-muted p-2">
                {nonOperatingOptions.length === 0 && <p className="px-1 text-[11px] text-ink-400">Nenhuma linha em DRE.14.</p>}
                {nonOperatingOptions.map((row) => (
                  <label key={row.codigo_gerencial} className="flex items-center gap-2 px-1 py-1 text-[12px] text-ink-700">
                    <input
                      type="checkbox"
                      checked={excluded.has(row.codigo_gerencial)}
                      onChange={() => toggleExcluded(row.codigo_gerencial)}
                    />
                    {row.nome || row.categoria_gerencial}
                  </label>
                ))}
              </div>
            )}

            <div className="my-1.5 border-t border-line" />
            <p className="px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">Espaçamento das linhas</p>
            <div className="mt-1.5 inline-flex w-full gap-0.5 rounded-full bg-surface-muted p-1">
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDensity(option.id)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-[11.5px] font-medium transition-colors ${
                    (state.reportDensity || "normal") === option.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="px-2 pb-1 pt-1.5 text-[10.5px] text-ink-400">
              Fica salvo só neste computador — ajuste se as linhas aparecerem muito espremidas (ou muito espaçadas) nessa tela.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
