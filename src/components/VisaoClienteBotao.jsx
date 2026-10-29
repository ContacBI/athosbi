import { Eye, EyeOff, PencilLine } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../data/useStore.js";
import { alternarVisaoCliente } from "../lib/visaoCliente.js";
import { entrarNoModo, usaModos } from "../lib/modoEquipe.js";

function useAlternar() {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    const agora = alternarVisaoCliente();
    // o cliente não tem Parâmetros nem a Reforma da equipe: sai dessas telas ao ligar
    if (agora && (location.pathname.startsWith("/parametros") || location.pathname.startsWith("/reforma"))) navigate("/empresas");
  };
}

// "Olhinho" do topo (barra da empresa e início): liga/desliga a visão do cliente, em qualquer tela. Só pra equipe. Ver lib/visaoCliente.js.
export function VisaoClienteOlho({ className = "" }) {
  const state = useAppState();
  const alternar = useAlternar();
  if (!state.realIsAdmin && !state.realIsColaborador) return null;
  const ligada = state.visaoCliente;
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={ligada}
      title={ligada ? "Visão do cliente ligada — clique para voltar à visão da equipe" : "Ver o portal como o cliente vê"}
      className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors ${ligada ? "border-accent-500 bg-accent-500 text-white hover:bg-accent-600" : "border-white/15 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white"} ${className}`}
    >
      {ligada ? <EyeOff size={14} strokeWidth={1.8} /> : <Eye size={14} strokeWidth={1.8} />}
      {ligada && <span>Visão do cliente</span>}
    </button>
  );
}

// Equipe com o hub (lib/modoEquipe.js): no lugar do olhinho, o modo da tela — no portal, "Visão do cliente" com o atalho pra editar ali
// mesmo; editando (vindo do console), o atalho pra ver como o cliente vê. Troca sem sair da tela.
export function ModoDaTela({ className = "" }) {
  const state = useAppState();
  if (state.modoEquipe === "portal") {
    return (
      <span title={state.pessoaVista ? `Vendo exatamente o que ${state.pessoaVista.nome || state.pessoaVista.email} vê` : undefined} className={`flex h-8 items-center gap-1 rounded-md border border-accent-500/50 bg-accent-500/15 pl-2.5 pr-1 text-[12px] font-semibold text-accent-700 ${className}`}>
        <Eye size={14} strokeWidth={1.8} /> {state.pessoaVista ? `Como ${String(state.pessoaVista.nome || state.pessoaVista.email).split(/[ @]/)[0]}` : "Visão do cliente"}
        <button type="button" onClick={() => entrarNoModo("console")} title="Editar esta empresa/grupo (modo do console)" className="ml-1.5 flex h-6 items-center gap-1 rounded bg-accent-500 px-2 text-[11.5px] font-semibold text-white hover:bg-accent-600">
          <PencilLine size={12} /> Editar
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => entrarNoModo("portal")} title="Ver exatamente como o cliente vê" aria-label="Ver como cliente" className={`flex h-8 items-center gap-1.5 rounded-md border border-white/15 px-2.5 text-[12px] font-medium text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white ${className}`}>
      <Eye size={14} strokeWidth={1.8} /> <span className="hidden 2xl:inline">Ver como cliente</span>
    </button>
  );
}

// Telas sem barra de topo própria (lista de empresas, carteira…): enquanto a visão do cliente está ligada, fica uma pílula fixa pra sair dela.
export default function VisaoClienteBotao() {
  const state = useAppState();
  const location = useLocation();
  const alternar = useAlternar();
  if (!state.visaoCliente || usaModos(state)) return null;
  if (location.pathname.startsWith("/empresa") || location.pathname === "/") return null; // essas já têm o olhinho no topo
  return (
    <button type="button" onClick={alternar} title="Voltar à visão da equipe" className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg hover:bg-accent-600">
      <EyeOff size={15} /> Visão do cliente · sair
    </button>
  );
}
