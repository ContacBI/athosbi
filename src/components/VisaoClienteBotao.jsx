import { Eye, EyeOff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../data/useStore.js";
import { alternarVisaoCliente } from "../lib/visaoCliente.js";

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

// Telas sem barra de topo própria (lista de empresas, carteira…): enquanto a visão do cliente está ligada, fica uma pílula fixa pra sair dela.
export default function VisaoClienteBotao() {
  const state = useAppState();
  const location = useLocation();
  const alternar = useAlternar();
  if (!state.visaoCliente) return null;
  if (location.pathname.startsWith("/empresa") || location.pathname === "/") return null; // essas já têm o olhinho no topo
  return (
    <button type="button" onClick={alternar} title="Voltar à visão da equipe" className="fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-lg hover:bg-accent-600">
      <EyeOff size={15} /> Visão do cliente · sair
    </button>
  );
}
