import { useState } from "react";
import { Settings2 } from "lucide-react";
import { useAppState, setData } from "../data/useStore.js";

export default function ReportSettingsMenu({ tab }) {
  const state = useAppState();
  const [open, setOpen] = useState(false);

  const nonOperatingOptions = state.plano
    .filter((row) => String(row.demonstrativo || "").toUpperCase() === "DRE")
    .filter((row) => String(row.codigo_gerencial || "").startsWith("DRE.14."))
    .filter((row) => Number(row.nivel || 0) >= 3)
    .sort((a, b) => String(a.codigo_gerencial).localeCompare(String(b.codigo_gerencial), "pt-BR", { numeric: true }));

  const excluded = new Set(state.excludedNonOperatingCodes || []);

  function toggleExcluded(code) {
    const next = new Set(excluded);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setData({ excludedNonOperatingCodes: Array.from(next) });
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
                onChange={(event) => setData({ reportCompare: event.target.checked })}
              />
              Comparar meses
            </label>
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={tab === "BP" ? state.showPreviousBalanceBP : state.showPreviousBalanceDRE}
                onChange={(event) =>
                  setData({ [tab === "BP" ? "showPreviousBalanceBP" : "showPreviousBalanceDRE"]: event.target.checked })
                }
              />
              Mostrar saldo anterior
            </label>
            {!(tab === "BP" && state.bpMonthlyMode === "accumulated") && (
              <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
                <input
                  type="checkbox"
                  checked={state.showReportTotal}
                  onChange={(event) => setData({ showReportTotal: event.target.checked })}
                />
                Mostrar coluna saldo total
              </label>
            )}

            {tab === "BP" && state.reportCompare && (
              <label className="mt-1 block px-2 py-1.5 text-[12px] text-ink-600">
                Valores mensais do balanço
                <select
                  value={state.bpMonthlyMode}
                  onChange={(event) => setData({ bpMonthlyMode: event.target.value === "accumulated" ? "accumulated" : "movement" })}
                  className="mt-1 w-full rounded-md border border-line-strong px-2 py-1.5 text-[12px]"
                >
                  <option value="movement">Movimento de cada mês</option>
                  <option value="accumulated">Saldo acumulado até o mês</option>
                </select>
              </label>
            )}

            <div className="my-1.5 border-t border-line" />

            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={state.hideZeroNoMovement}
                onChange={(event) => setData({ hideZeroNoMovement: event.target.checked })}
              />
              Ocultar contas zeradas
            </label>
            <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-700 hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={Boolean(state.hideNonOperatingResults)}
                onChange={(event) => setData({ hideNonOperatingResults: event.target.checked })}
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
          </div>
        </>
      )}
    </div>
  );
}
