import { Eye, EyeOff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../data/useStore.js";
import { alternarVisaoCliente } from "../lib/visaoCliente.js";

// Botão fixo em todas as telas (só pra equipe): liga/desliga a visão do cliente. Ver lib/visaoCliente.js.
export default function VisaoClienteBotao() {
  const state = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  if (!state.realIsAdmin && !state.realIsColaborador) return null;
  const ligada = state.visaoCliente;
  function clicar() {
    const agora = alternarVisaoCliente();
    // o cliente não tem Parâmetros nem a Reforma da equipe: sai dessas telas ao ligar
    if (agora && (location.pathname.startsWith("/parametros") || location.pathname.startsWith("/reforma"))) navigate("/empresas");
  }
  return (
    <button
      type="button"
      onClick={clicar}
      title={ligada ? "Voltar à visão da equipe" : "Ver o portal como o cliente vê"}
      className={`fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-lg transition-colors ${ligada ? "bg-accent-500 text-white hover:bg-accent-600" : "border border-line-strong bg-surface-card text-ink-700 hover:bg-surface-muted"}`}
    >
      {ligada ? <EyeOff size={15} /> : <Eye size={15} />}
      {ligada ? "Visão do cliente · sair" : "Ver como cliente"}
    </button>
  );
}
