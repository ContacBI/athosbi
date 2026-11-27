import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { periodoInterno, usePeriodoInterno } from "../lib/internoContabil.js";

// Seletor de período do Interno x Contábil, no lugar do "Período" do B.I.: um mês por vez e só os meses que têm relatório interno conferido.
const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default function PeriodoInterno() {
  const { meses, mes } = usePeriodoInterno();
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(null);
  const raiz = useRef(null);
  const anos = [...new Set(meses.map((m) => m.slice(0, 4)))].sort();
  const anoVisto = ano || (mes ? mes.slice(0, 4) : anos[anos.length - 1]);
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => raiz.current && !raiz.current.contains(e.target) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  if (!meses.length) return null;
  const [a, m] = String(mes || "").split("-");
  const i = anos.indexOf(anoVisto);
  return (
    <div className="relative" ref={raiz}>
      <button type="button" onClick={() => { setAno(null); setAberto((v) => !v); }} className="flex items-center gap-2 rounded-md border border-line-strong bg-surface-card px-3 py-1.5 text-[12px] text-ink-700 transition-colors hover:border-accent-400">
        <Calendar size={13} strokeWidth={1.8} className="text-ink-400" />
        <span className="text-ink-400">Período</span>
        <span className="font-medium tabular-nums text-ink-900">{mes ? `${LONGOS[Number(m) - 1]} de ${a}` : "—"}</span>
        <ChevronDown size={12} className={`text-ink-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-xl bg-surface-card p-3 shadow-lg ring-1 ring-line">
          <div className="mb-2.5 flex items-center justify-between">
            <button type="button" disabled={i <= 0} onClick={() => setAno(anos[i - 1])} className="rounded-md px-2 py-1 text-[13px] text-ink-500 hover:bg-surface-muted disabled:opacity-30">‹</button>
            <span className="text-[13px] font-semibold text-ink-900">{anoVisto}</span>
            <button type="button" disabled={i >= anos.length - 1} onClick={() => setAno(anos[i + 1])} className="rounded-md px-2 py-1 text-[13px] text-ink-500 hover:bg-surface-muted disabled:opacity-30">›</button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {CURTOS.map((rot, k) => {
              const chave = `${anoVisto}-${String(k + 1).padStart(2, "0")}`;
              const tem = meses.includes(chave);
              const sel = chave === mes;
              return (
                <button key={chave} type="button" disabled={!tem} onClick={() => { periodoInterno.set({ mes: chave }); setAberto(false); }} title={tem ? `${LONGOS[k]} de ${anoVisto}` : "Sem relatório interno neste mês"}
                  className={`rounded-lg py-2 text-[12px] font-semibold capitalize transition-colors ${sel ? "bg-accent-500 text-white" : tem ? "bg-accent-50 text-accent-700 hover:bg-accent-100" : "cursor-not-allowed text-ink-300"}`}>{rot}</button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[11px] text-ink-400">Só os meses com relatório interno conferido. A DFC segue o mesmo mês.</p>
        </div>
      )}
    </div>
  );
}
