import { useEffect, useRef } from "react";
import { ArrowRight, Lightbulb, X } from "lucide-react";
import { compactValue } from "../lib/presentations.js";
import { fmtPct } from "../lib/assistant/analysis.js";
import DeltaPill from "./DeltaPill.jsx";

// A explicação que abre por cima ao clicar num número ou alerta do cartão
// de uma empresa no Início do cliente: o valor da empresa (com a
// comparação), o que aconteceu e o que fazer (alertas) e o que o item
// significa (lib/glossario.js). No celular, sobe de baixo.
//
// item: { rotulo, valor?, sub?, metric?, texto?, acao?, severity?, positivo?, explicacao? }

function antes(metric) {
  if (!metric || metric.before == null || !Number.isFinite(metric.before)) return "";
  return metric.kind === "percent" ? fmtPct(metric.before) : compactValue(metric.before, "money");
}

function Secao({ titulo, children }) {
  return (
    <section className="mt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">{titulo}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-700">{children}</p>
    </section>
  );
}

export default function ExplicaItem({ item, empresa, periodo, prevLabel, onClose, onAbrirEmpresa }) {
  const fechar = useRef(null);
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose]);

  const explicacao = item.explicacao;
  const valorAntes = antes(item.metric);
  const cor = item.positivo ? "bg-success-500" : item.severity >= 3 ? "bg-danger-500" : item.severity === 2 ? "bg-warning-500" : "bg-ink-300";

  return (
    <div className="explica-item fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 backdrop-blur-[2px] sm:items-center sm:px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.rotulo}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-surface-card p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11.5px] font-medium text-ink-400">
              {empresa}
              {periodo ? ` · ${periodo}` : ""}
            </p>
            <h2 className="mt-0.5 flex items-start gap-2 text-[18px] font-semibold leading-snug tracking-tight text-ink-900">
              {item.severity != null || item.positivo ? <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${cor}`} /> : null}
              {item.rotulo}
            </h2>
          </div>
          <button ref={fechar} type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-400 hover:bg-surface-muted hover:text-ink-900">
            <X size={18} />
          </button>
        </div>

        {item.valor && (
          <div className="mt-4 rounded-2xl bg-surface-muted/70 p-4">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-ink-900">{item.valor}</span>
              <DeltaPill metric={item.metric} />
            </div>
            {(valorAntes || item.sub) && (
              <p className="mt-1 text-[12.5px] text-ink-500">
                {valorAntes && prevLabel ? `Em ${prevLabel}: ${valorAntes}` : ""}
                {valorAntes && prevLabel && item.sub ? " · " : ""}
                {item.sub || ""}
              </p>
            )}
          </div>
        )}

        {item.texto && <Secao titulo={item.positivo ? "O que aconteceu de bom" : "O que aconteceu"}>{item.texto}</Secao>}

        {item.acao && (
          <div className="mt-4 flex gap-2.5 rounded-xl bg-accent-50 p-3.5 ring-1 ring-accent-200">
            <Lightbulb size={17} className="mt-0.5 shrink-0 text-accent-600" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">O que fazer</p>
              <p className="mt-0.5 text-[13.5px] leading-snug text-ink-800">{item.acao}</p>
            </div>
          </div>
        )}

        {explicacao && (
          <div className={item.texto || item.valor ? "mt-5 border-t border-line pt-1" : ""}>
            {explicacao.titulo && explicacao.titulo !== item.rotulo && <p className="mt-4 text-[13px] font-semibold text-ink-900">Entenda: {explicacao.titulo}</p>}
            <Secao titulo="O que é">{explicacao.oque}</Secao>
            <Secao titulo="Como é calculado">{explicacao.calculo}</Secao>
            <Secao titulo="Como ler">{explicacao.leitura}</Secao>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-line-strong px-4 py-2 text-[13px] text-ink-700 hover:bg-surface-muted">
            Fechar
          </button>
          {onAbrirEmpresa && (
            <button type="button" onClick={onAbrirEmpresa} className="explica-abrir flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
              Ver na empresa <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
