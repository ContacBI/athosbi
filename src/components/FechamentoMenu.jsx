import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, ChevronDown, Lock } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { dataMonths } from "../lib/assistant/context.js";
import { definirFechamento } from "../lib/companies.js";
import { mesAnterior, mesFechadoDa, proximoMes } from "../lib/fechamento.js";

// Fechamento da empresa aberta (barra do topo, só pra quem edita a
// empresa): até que mês o cliente vê os números — ver lib/fechamento.js.
// "Fechar outubro" é o clique do dia a dia; a lista serve pra corrigir.

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const curto = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const longo = (mes) => `${MESES_LONGOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

export default function FechamentoMenu({ company }) {
  const appState = useAppState();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const raiz = useRef(null);
  const fechado = mesFechadoDa(company);
  const definido = Boolean(company.fechadoAte);
  // Meses com dados (a equipe vê todos), do mais novo pro mais antigo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const meses = useMemo(() => dataMonths().slice().reverse().slice(0, 15), [appState.journal, appState.companies, appState.activeCompanyId]);
  const ultimoComDados = meses[0] || "";
  const proximo = proximoMes(fechado);
  const podeFecharProximo = ultimoComDados && proximo <= ultimoComDados;

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (event) => raiz.current && !raiz.current.contains(event.target) && setAberto(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function fechar(mes) {
    setErro("");
    try {
      await definirFechamento(company.id, mes);
      setAberto(false);
    } catch (error) {
      setErro(`Não foi salvo: ${String(error?.message || error).slice(0, 120)}`);
    }
  }

  return (
    <div className="relative" ref={raiz}>
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        title="Até que mês o cliente vê os números desta empresa"
        className="fechamento-botao flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 text-[12px] text-white/85 transition-colors hover:border-white/30 hover:bg-white/10"
      >
        <Lock size={12} className="text-white/55" />
        <span className="text-white/55">Fechado até</span>
        <span className="font-medium text-white">{curto(fechado)}</span>
        <ChevronDown size={12} className="text-white/45" />
      </button>
      {aberto && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-72 rounded-xl bg-surface-card p-3 text-ink-800 shadow-lg ring-1 ring-line">
          <p className="text-[13px] font-semibold text-ink-900">Fechamento</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-400">
            O cliente vê os números até {longo(fechado)}
            {definido ? "." : " — sem fechamento marcado, vale o mês anterior ao atual."} A equipe continua vendo tudo.
          </p>
          {podeFecharProximo && (
            <button type="button" onClick={() => fechar(proximo)} className="fechamento-fechar mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-500 py-2 text-[12.5px] font-medium text-white hover:bg-accent-600">
              <CalendarCheck size={14} /> Fechar {longo(proximo)}
            </button>
          )}
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Ou escolha o mês fechado</p>
          <div className="mt-1.5 grid max-h-44 grid-cols-3 gap-1 overflow-y-auto">
            {meses.map((mes) => (
              <button
                key={mes}
                type="button"
                onClick={() => fechar(mes)}
                className={`rounded-md px-2 py-1.5 text-[12px] tabular-nums transition-colors ${definido && mes === fechado ? "bg-accent-500 font-medium text-white" : "bg-surface-muted text-ink-700 hover:bg-accent-50 hover:text-accent-700"}`}
              >
                {curto(mes)}
              </button>
            ))}
          </div>
          {definido && (
            <button type="button" onClick={() => fechar("")} className="mt-2.5 text-[11.5px] text-ink-400 hover:text-ink-800">
              Voltar ao padrão (mês anterior ao atual: {curto(mesAnterior())})
            </button>
          )}
          {erro && <p className="mt-2 text-[11.5px] text-danger-600">{erro}</p>}
          {appState.activeGroupId && <p className="mt-2 text-[11px] text-ink-400">Num grupo, vale o fechamento mais atrasado das empresas.</p>}
        </div>
      )}
    </div>
  );
}
