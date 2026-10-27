import { useEffect, useState } from "react";
import { Eye, EyeOff, Settings2, Smartphone, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import Celular from "../pages/Celular.jsx";
import ResumoCelularConfig from "./ResumoCelularConfig.jsx";
import { useGravarResumo } from "../lib/useGravarResumo.js";

// Personalizar › Resumo do celular: o resumo do cliente dentro de uma
// moldura de celular, ao vivo, e ao lado o painel pra marcar o que aparece.
// Tudo que muda no painel aparece na hora no celular — é a tela que o
// cliente abre, com os números de verdade da empresa/grupo.
export default function ResumoCelularModal({ onClose }) {
  const appState = useAppState();
  const { config, mudar, salvo } = useGravarResumo();
  const [comoCliente, setComoCliente] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  // Tela estreita: um de cada vez (prévia ou configuração).
  const [aba, setAba] = useState("previa");
  const company = appState.companies.find((item) => item.id === appState.activeCompanyId) || null;
  const group = appState.activeGroupId ? appState.groups.find((item) => item.id === appState.activeGroupId) : null;
  const nome = group?.name || company?.name || "";

  useEffect(() => {
    const fechar = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [onClose]);

  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="resumo-modal fixed inset-0 z-50 flex flex-col bg-navy-950/70 backdrop-blur-sm lg:flex-row">
      <div className="flex shrink-0 items-center gap-2 bg-surface-card px-3 py-2 lg:hidden">
        {[
          { id: "previa", nome: "Celular", icone: Smartphone },
          { id: "config", nome: "Configurar", icone: Settings2 },
        ].map(({ id, nome: rotulo, icone: Icone }) => (
          <button key={id} type="button" onClick={() => setAba(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-medium ${aba === id ? "bg-accent-500 text-white" : "text-ink-600"}`}>
            <Icone size={14} /> {rotulo}
          </button>
        ))}
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1.5 text-ink-400">
          <X size={18} />
        </button>
      </div>

      <div className={`min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-4 lg:flex ${aba === "previa" ? "flex" : "hidden"}`} onClick={(event) => event.target === event.currentTarget && onClose()}>
        <div className="flex items-center gap-3 text-white">
          <p className="text-[13px] font-medium">{comoCliente ? "Assim o cliente vê no celular" : "Visão da equipe (com os alertas de conferência)"}</p>
          <button type="button" onClick={() => setComoCliente((atual) => !atual)} className="resumo-modal-visao flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/85 hover:bg-white/20">
            {comoCliente ? <EyeOff size={13} /> : <Eye size={13} />}
            {comoCliente ? "Ver como equipe" : "Ver como cliente"}
          </button>
        </div>

        {/* Moldura do celular */}
        <div className="relative shrink-0 rounded-[46px] bg-[#0b0d12] p-[11px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/10" style={{ width: "min(392px, 100%)", height: "min(812px, calc(100vh - 110px))" }}>
          <div className="pointer-events-none absolute left-1/2 top-[19px] z-40 h-[26px] w-[110px] -translate-x-1/2 rounded-full bg-black" />
          <div className="flex h-full flex-col overflow-hidden rounded-[36px] bg-surface-page">
            <div className="flex h-[44px] shrink-0 items-center justify-between bg-navy-950 px-7 pt-1 text-[13px] font-semibold text-white">
              <span>{hora}</span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-4 rounded-[3px] border border-white/80" />
              </span>
            </div>
            <div className="resumo-modal-tela min-h-0 flex-1 overflow-y-auto">
              <Celular previa comoCliente={comoCliente} onAnalysis={setAnalysis} />
            </div>
          </div>
        </div>
      </div>

      <div className={`min-h-0 w-full shrink-0 lg:block lg:h-full lg:w-[440px] ${aba === "config" ? "block flex-1" : "hidden"}`}>
        <ResumoCelularConfig
          embutido
          config={config}
          onChange={mudar}
          onClose={onClose}
          verComoCliente={comoCliente}
          onVerComoCliente={setComoCliente}
          salvo={salvo}
          nome={nome}
          analysis={analysis}
        />
      </div>
    </div>
  );
}
