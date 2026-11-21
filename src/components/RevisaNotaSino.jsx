import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { STATUS_DE_PEDIDO, eventoDoPedido } from "../lib/revisaNota.js";

// Sininho do Revisa Nota: lista as novidades dos pedidos (resposta do escritório, pedido aprovado ou recusado). As não lidas ficam em destaque e contam no sino; clicar abre a conversa.
const quando = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mesmoDia = d.toDateString() === new Date().toDateString();
  return mesmoDia ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function SinoDeAvisos({ pedidos, naoLidas, aoAbrir, aoMarcarTodas }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  const itens = useMemo(
    () => (pedidos || []).map((p) => ({ p, ev: eventoDoPedido(p) })).filter((x) => x.ev).sort((a, b) => String(b.ev.quando).localeCompare(String(a.ev.quando))).slice(0, 20),
    [pedidos],
  );
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative shrink-0">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-label={naoLidas.size ? `${naoLidas.size} aviso(s) novo(s)` : "Avisos"} aria-expanded={aberto} title="Avisos dos pedidos" className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${aberto ? "border-accent-500 bg-accent-500/10 text-accent-600" : "border-line text-ink-500 hover:bg-surface-muted hover:text-ink-900"}`}>
        <Bell size={16} />
        {naoLidas.size > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-500 px-1 text-[10.5px] font-bold text-white">{naoLidas.size}</span>}
      </button>
      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-line bg-surface-card shadow-xl" role="dialog" aria-label="Avisos dos pedidos">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-[13px] font-semibold text-ink-900">Avisos</p>
            {naoLidas.size > 0 && <button type="button" onClick={aoMarcarTodas} className="flex items-center gap-1 text-[12px] font-medium text-accent-600 hover:underline"><Check size={12} /> Marcar todas como lidas</button>}
          </div>
          <ul className="max-h-[420px] divide-y divide-line/60 overflow-y-auto">
            {itens.map(({ p, ev }) => {
              const nova = naoLidas.has(p.id);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => { setAberto(false); aoAbrir(p.id); }} className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-muted/60 ${nova ? "bg-accent-500/5" : ""}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${nova ? "bg-accent-500" : "bg-transparent"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <b className={`text-[12.5px] ${nova ? "text-ink-900" : "font-semibold text-ink-700"}`}>{ev.titulo}</b>
                        <span className="shrink-0 text-[11px] text-ink-400">{quando(ev.quando)}</span>
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-700">{p.descricao || p.alvo}</span>
                      {ev.texto && <span className="mt-0.5 block line-clamp-2 text-[12px] text-ink-500">{ev.texto}</span>}
                      <span className="mt-1 inline-block text-[10.5px] font-semibold text-ink-400">{STATUS_DE_PEDIDO[p.status]?.nome}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!itens.length && <li className="px-4 py-10 text-center text-[13px] text-ink-400">Nenhum aviso ainda. Quando o escritório responder um pedido, aparece aqui.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
