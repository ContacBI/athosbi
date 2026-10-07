import { Building2, Network } from "lucide-react";

// Tela cheia de "abrindo empresa/grupo" — fica no lugar do painel enquanto
// o razão baixa e os relatórios são calculados. Sem ela, um grupo grande
// mostrava uma tela em branco por vários segundos (o cálculo trava o
// navegador, então nada novo é desenhado até terminar). Usada pela tela de
// escolher empresa (Empresas.jsx) e pelo CompanyLayout (F5 dentro de um
// grupo/empresa, quando o razão ainda está chegando).
//
// `progress` (0..1, ou null quando não dá pra medir) só vale na fase
// "loading"; em "calculating" a barra fica cheia e pulsando.
export default function WorkspaceLoading({ name, isGroup, phase = "loading", progress = null, onCancel }) {
  const Icon = isGroup ? Network : Building2;
  const calculating = phase === "calculating" || (progress !== null && progress >= 1);
  const percent = progress === null ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-page px-6" role="status" aria-live="polite">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-sm">
          <Icon size={24} strokeWidth={1.8} />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-accent-600">
            {isGroup ? "Abrindo grupo" : "Abrindo empresa"}
          </p>
          <p className="text-[17px] font-medium leading-snug text-ink-900">{name}</p>
        </div>
        <div className="w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full bg-accent-500 transition-[width] duration-300 ${calculating ? "animate-pulse" : ""}`}
              style={{ width: calculating ? "100%" : `${Math.max(4, percent ?? 4)}%` }}
            />
          </div>
          <p className="mt-2.5 flex items-center justify-center gap-2 text-[12.5px] text-ink-500">
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-accent-100 border-t-accent-500" />
            {calculating
              ? "Calculando os relatórios…"
              : `Carregando os lançamentos${percent !== null ? ` — ${percent}%` : "…"}`}
          </p>
        </div>
        <p className="text-[11.5px] text-ink-400">
          {isGroup ? "Grupos com muitos lançamentos podem levar alguns segundos." : "Empresas com muitos lançamentos podem levar alguns segundos."}
        </p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-[12px] text-ink-400 underline decoration-line-strong underline-offset-2 hover:text-ink-700">
            Voltar pra lista
          </button>
        )}
      </div>
    </div>
  );
}
