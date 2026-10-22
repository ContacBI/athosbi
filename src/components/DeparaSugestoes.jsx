import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import { CONFIDENCE_LABELS, CONFIDENCE_STYLE, confidenceRank } from "../lib/deparaSugestao.js";

// Revisão das sugestões de vínculo (ver lib/deparaSugestao.js): cada conta
// pendente com a linha sugerida, a confiança e o motivo. As de confiança
// alta já vêm marcadas; o usuário confere e vincula de uma vez.

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function DeparaSugestoes({ result, onApply, onClose }) {
  const items = useMemo(
    () => result.suggestions.filter((item) => item.row).sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.account.classificacao.localeCompare(b.account.classificacao, "pt-BR", { numeric: true })),
    [result]
  );
  const [selected, setSelected] = useState(() => new Set(items.filter((item) => item.confidence === "alta").map((item) => item.account.classificacao)));
  const [tier, setTier] = useState("todas");
  const [search, setSearch] = useState("");

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const term = norm(search.trim());
  const shown = items.filter((item) => (tier === "todas" || item.confidence === tier) && (!term || norm(`${item.account.classificacao} ${item.account.nome_conta} ${item.row.nome} ${item.row.codigo_gerencial}`).includes(term)));
  const allShown = shown.length > 0 && shown.every((item) => selected.has(item.account.classificacao));
  const without = result.counts.sem;

  const toggle = (code) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  function toggleShown() {
    setSelected((current) => {
      const next = new Set(current);
      shown.forEach((item) => (allShown ? next.delete(item.account.classificacao) : next.add(item.account.classificacao)));
      return next;
    });
  }
  function apply() {
    const chosen = items.filter((item) => selected.has(item.account.classificacao));
    if (chosen.length) onApply(chosen);
  }

  const tiers = [
    { id: "todas", label: "Todas", count: items.length },
    { id: "alta", label: "Alta", count: result.counts.alta },
    { id: "media", label: "Média", count: result.counts.media },
    { id: "baixa", label: "Baixa", count: result.counts.baixa },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/40 p-4 backdrop-blur-sm" onPointerDown={onClose}>
      <div className="depara-sugestoes-modal flex max-h-[90vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-surface-card shadow-2xl" onPointerDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="text-[16px] font-semibold text-ink-900">Sugestões de vínculo</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-500">
                {items.length
                  ? `Encontrei destino para ${items.length} de ${result.pending.length} ${result.pending.length === 1 ? "conta pendente" : "contas pendentes"}. As de confiança alta já vêm marcadas — confira e vincule.`
                  : `Não encontrei uma sugestão segura para ${result.pending.length === 1 ? "a conta pendente" : `as ${result.pending.length} contas pendentes`}. Vincule pela tela normal.`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-surface-muted hover:text-ink-700" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            <div className="inline-flex gap-0.5 rounded-full bg-surface-muted p-1">
              {tiers.map((item) => (
                <button key={item.id} type="button" onClick={() => setTier(item.id)} disabled={!item.count && item.id !== "todas"} className={`sugestao-filtro rounded-full px-3 py-1 text-[12px] font-medium disabled:opacity-40 ${tier === item.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"}`}>
                  {item.label} <span className="tabular-nums text-ink-400">{item.count}</span>
                </button>
              ))}
            </div>
            <label className="relative flex min-w-[200px] flex-1 items-center">
              <Search size={14} className="pointer-events-none absolute left-2.5 text-ink-300" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conta ou linha…" className="h-8 w-full rounded-lg border border-line bg-surface-page pl-8 pr-3 text-[12.5px] outline-none focus:border-accent-400" />
            </label>
            <button type="button" onClick={toggleShown} disabled={!shown.length} className="sugestao-marcar h-8 rounded-lg px-2.5 text-[12px] font-medium text-accent-600 hover:bg-accent-50 disabled:opacity-40">
              {allShown ? "Desmarcar" : "Marcar"} {term || tier !== "todas" ? "as da lista" : "todas"}
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {items.length > 0 && !shown.length && <p className="px-3 py-8 text-center text-[13px] text-ink-400">Nada com esse filtro.</p>}
          {shown.map((item) => {
            const on = selected.has(item.account.classificacao);
            return (
              <label key={item.account.classificacao} className={`sugestao-linha mb-1 flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${on ? "border-accent-300 bg-accent-50/60" : "border-line hover:bg-surface-muted"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(item.account.classificacao)} className="sugestao-check mt-1 h-4 w-4 shrink-0" />
                <span className="grid min-w-0 flex-1 grid-cols-1 items-center gap-x-3 gap-y-1 md:grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)_auto]">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium text-ink-800">{item.account.nome_conta}</span>
                    <span className="block text-[10.5px] text-ink-400">
                      {item.account.classificacao}
                      {item.account.soNoAno && <span className="ml-1.5 rounded bg-surface-muted px-1 py-px font-medium text-ink-500">{item.account.soNoAno}</span>}
                    </span>
                  </span>
                  <ArrowRight size={14} className="hidden text-ink-300 md:block" />
                  <span className="min-w-0">
                    <span className="sugestao-destino block truncate text-[12.5px] font-medium text-ink-800">{item.row.nome}</span>
                    <span className="block text-[10.5px] text-ink-400">
                      {item.row.codigo_gerencial} · {item.row.demonstrativo}
                      {item.row.grupo_macro && ` | ${item.row.grupo_macro}`}
                    </span>
                  </span>
                  <span className={`sugestao-confianca w-fit rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${CONFIDENCE_STYLE[item.confidence]}`}>{CONFIDENCE_LABELS[item.confidence]}</span>
                  <span className="text-[11px] leading-snug text-ink-500 md:col-span-4">Por quê: {item.reason}.</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
          <p className="text-[11.5px] text-ink-400">
            {without > 0 ? `${without} ${without === 1 ? "conta ficou" : "contas ficaram"} sem sugestão — vincule pela tela normal. ` : ""}
            Os vínculos aceitos ficam marcados como “sugerido” e ensinam as próximas sugestões.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg px-3 text-[13px] text-ink-600 hover:bg-surface-muted">
              Cancelar
            </button>
            <button type="button" onClick={apply} disabled={!selected.size} className="sugestao-aplicar h-9 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-40">
              Vincular {selected.size ? `${selected.size} ${selected.size === 1 ? "selecionada" : "selecionadas"}` : "selecionadas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
