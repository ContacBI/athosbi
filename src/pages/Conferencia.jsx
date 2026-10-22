import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowDownUp, CalendarRange, Check, ChevronDown, ChevronRight, Copy, FilePlus2, RotateCcw, ScanSearch, TrendingUp } from "lucide-react";
import { useAppState, setData, state } from "../data/useStore.js";
import { persistActiveCompany } from "../lib/companies.js";
import { ANOMALY_KINDS, detectAnomalies } from "../lib/anomalias.js";
import { money, periodLabelPt } from "../lib/format.js";

// Conferência do razão (ver lib/anomalias.js): o que parece erro de
// lançamento no período — repetidos, valores e meses fora do padrão, sinal
// invertido e conta nova. "Está certo" guarda o aviso em
// company.anomaliasOk para não aparecer de novo.

const ICONS = { duplicado: Copy, valor: TrendingUp, mes: CalendarRange, sinal: ArrowDownUp, nova: FilePlus2 };
const LEVEL = {
  alta: { label: "Prioridade alta", className: "bg-danger-50 text-danger-600" },
  media: { label: "Conferir", className: "bg-warning-50 text-warning-700" },
  baixa: { label: "Só para saber", className: "bg-surface-muted text-ink-500" },
};
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthName = (month) => `${MONTHS[Number(month.slice(5, 7)) - 1]}/${month.slice(0, 4)}`;
const dateBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const when = (item) => (item.kind === "mes" || item.kind === "sinal" || item.kind === "nova" ? monthName(item.month) : dateBr(item.date));

// Grava a lista de "está certo" no cadastro da empresa ativa.
function setDismissed(companyId, ids) {
  const companies = state.companies.map((company) => (company.id === companyId ? { ...company, anomaliasOk: ids.slice(-3000) } : company));
  setData({ companies });
  persistActiveCompany();
}

export default function Conferencia() {
  const app = useAppState();
  const company = app.companies.find((item) => item.id === app.activeCompanyId) || null;
  // Vindo do assistente de slides: o período da apresentação.
  const location = useLocation();
  const fromDeck = location.state?.periodo?.start && location.state?.periodo?.end ? location.state.periodo : null;
  const [scope, setScope] = useState(fromDeck ? "apresentacao" : "periodo");
  const [kind, setKind] = useState("todos");
  const [showDismissed, setShowDismissed] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const dismissed = company?.anomaliasOk;

  const result = useMemo(
    () =>
      detectAnomalies(app.journal, {
        start: scope === "periodo" ? app.periodStart : scope === "apresentacao" ? fromDeck.start : "",
        end: scope === "periodo" ? app.periodEnd : scope === "apresentacao" ? fromDeck.end : "",
        natureRules: app.natureRules,
        dismissed: dismissed || [],
      }),
    [app.journal, app.periodStart, app.periodEnd, app.natureRules, dismissed, scope, fromDeck]
  );

  if (app.activeGroupId || !company) {
    return (
      <div className="mx-auto max-w-[900px] rounded-xl bg-surface-card p-8 text-center shadow-sm">
        <ScanSearch size={28} className="mx-auto text-ink-300" />
        <p className="mt-3 text-[14px] font-medium text-ink-800">A conferência é feita empresa por empresa.</p>
        <p className="mt-1 text-[13px] text-ink-400">Abra uma das empresas do grupo para conferir os lançamentos dela.</p>
      </div>
    );
  }

  // Desfeito o último "está certo", a caixa some — e a lista volta a ser a
  // dos avisos abertos.
  const viewDismissed = showDismissed && result.dismissed > 0;
  const shown = result.items.filter((item) => (viewDismissed ? item.dismissed : !item.dismissed) && (kind === "todos" || item.kind === kind));
  const toggleOpen = (id) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  function markOk(item) {
    setDismissed(company.id, [...new Set([...(dismissed || []), item.id])]);
  }
  function undo(item) {
    setDismissed(
      company.id,
      (dismissed || []).filter((id) => id !== item.id)
    );
  }

  const chips = [{ id: "todos", label: "Todos", count: result.open }, ...Object.entries(ANOMALY_KINDS).map(([id, info]) => ({ id, label: info.short, count: result.byKind[id] }))];

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Dados</span>
          <h1 className="mt-1 text-[20px] font-semibold text-ink-900">Conferência dos lançamentos</h1>
          <p className="mt-0.5 max-w-[720px] text-[13px] text-ink-400">
            O app procura no razão o que parece erro antes de o mês ir para o cliente: lançamento repetido, valor ou mês fora do padrão da conta, sinal invertido e conta usada pela primeira vez.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="inline-flex gap-0.5 rounded-full bg-surface-muted p-1">
            {[
              ...(fromDeck ? [{ id: "apresentacao", label: `Apresentação: ${periodLabelPt(fromDeck.start, fromDeck.end)}` }] : []),
              { id: "periodo", label: periodLabelPt(app.periodStart, app.periodEnd) || "Período" },
              { id: "tudo", label: "Todo o razão" },
            ].map((item) => (
              <button key={item.id} type="button" onClick={() => setScope(item.id)} className={`conferencia-escopo rounded-full px-3 py-1.5 text-[12px] font-medium ${scope === item.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="conferencia-resumo text-[12.5px] text-ink-500">
            {result.open ? (
              <>
                <b className="font-semibold text-ink-800">{result.open}</b> para conferir{result.alta ? <> · <b className="font-semibold text-danger-600">{result.alta}</b> de prioridade alta</> : ""}
              </>
            ) : (
              <span className="font-medium text-success-600">Nada estranho {scope === "tudo" ? "no razão" : "no período"}</span>
            )}
            {result.dismissed > 0 && ` · ${result.dismissed} marcado${result.dismissed === 1 ? "" : "s"} como certo${result.dismissed === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <button key={chip.id} type="button" onClick={() => setKind(chip.id)} disabled={chip.id !== "todos" && !chip.count && !viewDismissed} className={`conferencia-filtro rounded-full px-3 py-1.5 text-[12px] font-medium disabled:opacity-40 ${kind === chip.id ? "bg-accent-500 text-white" : "bg-surface-muted text-ink-600 hover:bg-accent-50"}`}>
              {chip.label} <span className={`tabular-nums ${kind === chip.id ? "text-white/80" : "text-ink-400"}`}>{chip.count}</span>
            </button>
          ))}
        </div>
        {result.dismissed > 0 && (
          <label className="ml-auto flex items-center gap-1.5 text-[12.5px] text-ink-600">
            <input type="checkbox" checked={viewDismissed} onChange={(event) => setShowDismissed(event.target.checked)} className="conferencia-ver-certos" />
            Ver os marcados como certos ({result.dismissed})
          </label>
        )}
      </div>

      {!app.journal.length ? (
        <p className="rounded-xl bg-surface-card px-4 py-10 text-center text-[13px] text-ink-400 shadow-sm">Sem lançamentos importados — traga o razão pela Domínio ou pela planilha em Dados.</p>
      ) : !shown.length ? (
        <p className="rounded-xl bg-surface-card px-4 py-10 text-center text-[13px] text-ink-400 shadow-sm">
          {viewDismissed ? "Nenhum aviso marcado como certo com esse filtro." : result.open ? "Nada desse tipo." : "Nenhum lançamento estranho encontrado. 👍"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((item) => {
            const Icon = ICONS[item.kind];
            const expanded = open.has(item.id);
            return (
              <div key={item.id} className={`conferencia-item rounded-xl bg-surface-card shadow-sm ring-1 ${item.level === "alta" && !item.dismissed ? "ring-danger-200" : "ring-line"}`}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.level === "alta" ? "bg-danger-50 text-danger-600" : item.level === "media" ? "bg-warning-50 text-warning-700" : "bg-surface-muted text-ink-500"}`}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-ink-900">{ANOMALY_KINDS[item.kind].label}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${LEVEL[item.level].className}`}>{LEVEL[item.level].label}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-700 sm:truncate">
                      {item.conta} <span className="text-ink-400">· {item.classificacao}</span>
                      {item.categoria && <span className="text-ink-400"> → {item.categoria}</span>}
                    </p>
                    <p className="mt-1 flex items-baseline gap-2 sm:hidden">
                      <span className="font-mono text-[14px] font-semibold tabular-nums text-ink-900">{money(item.value)}</span>
                      <span className="text-[11.5px] text-ink-400">{when(item)}</span>
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-ink-500">{item.reason}</p>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                    <span className="font-mono text-[15px] font-semibold tabular-nums text-ink-900">{money(item.value)}</span>
                    <span className="text-[11.5px] text-ink-400">{when(item)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2">
                  <button type="button" onClick={() => toggleOpen(item.id)} className="conferencia-ver flex items-center gap-1 text-[12px] font-medium text-accent-700 hover:underline">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {expanded ? "Esconder" : "Ver"} {item.entries.length === 1 ? "o lançamento" : `os lançamentos (${item.entries.length})`}
                  </button>
                  {item.dismissed ? (
                    <button type="button" onClick={() => undo(item)} className="conferencia-desfazer flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-ink-600 hover:bg-surface-muted">
                      <RotateCcw size={13} /> Voltar para a lista
                    </button>
                  ) : (
                    <button type="button" onClick={() => markOk(item)} className="conferencia-ok flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1 text-[12px] font-semibold text-success-600 hover:bg-success-500 hover:text-white" title="Conferido: não mostrar mais este aviso">
                      <Check size={13} /> Está certo
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="overflow-x-auto border-t border-line">
                    <table className="w-full min-w-[720px] text-[12px]">
                      <thead className="bg-surface-muted text-left text-[10.5px] uppercase tracking-wide text-ink-400">
                        <tr>
                          {item.kind === "duplicado" && <th className="px-3 py-1.5 font-medium">Cópia</th>}
                          <th className="px-3 py-1.5 font-medium">Data</th>
                          <th className="px-3 py-1.5 font-medium">Nº</th>
                          <th className="px-3 py-1.5 font-medium">Conta</th>
                          <th className="px-3 py-1.5 font-medium">Histórico</th>
                          <th className="px-3 py-1.5 text-right font-medium">Débito</th>
                          <th className="px-3 py-1.5 text-right font-medium">Crédito</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.entries.map((entry, index) => (
                          <tr key={index} className="conferencia-lancamento border-t border-line">
                            {item.kind === "duplicado" && <td className="px-3 py-1.5 text-ink-500">{entry.copia}ª</td>}
                            <td className="whitespace-nowrap px-3 py-1.5 text-ink-600">{dateBr(String(entry.data))}</td>
                            <td className="px-3 py-1.5 font-mono text-ink-500">{entry.linha_origem || "—"}</td>
                            <td className="max-w-[220px] truncate px-3 py-1.5 text-ink-700" title={`${entry.classificacao} ${entry.descricao_conta || ""}`}>
                              {entry.descricao_conta || entry.classificacao}
                            </td>
                            <td className="max-w-[340px] truncate px-3 py-1.5 text-ink-600" title={entry.historico}>
                              {entry.historico}
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums text-ink-800">{Number(entry.debito) ? money(entry.debito) : ""}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums text-ink-800">{Number(entry.credito) ? money(entry.credito) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11.5px] leading-snug text-ink-400">
        O app não altera nenhum lançamento: a correção é feita na Domínio (ou na planilha) e entra na próxima sincronização. Os lançamentos de apuração do resultado (“APURAÇÃO DE RESULTADO EM …”) ficam de fora da conferência.
      </p>
    </div>
  );
}
