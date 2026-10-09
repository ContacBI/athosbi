import { useNavigate } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import ThemeToggle from "../ThemeToggle.jsx";

// Largura das telas da Reforma: a tela toda, com respiro nas laterais (as
// tabelas de itens precisam do espaço).
const LARGURA = "w-full px-4 sm:px-6 lg:px-8 2xl:px-12";

// Moldura das telas da Reforma Tributária: faixa azul de identidade (igual
// à da carteira em Empresas.jsx), voltar, título e ações à direita.
// `barra`: faixa fixa no topo ao rolar (abas, números principais) — fica
// sempre à mão, sem precisar voltar lá em cima pra trocar de etapa.
export default function ReformaShell({ titulo, subtitulo, voltarPara = "/", voltarRotulo = "Início", acoes, extra, barra, children }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-surface-page pb-16">
      <header className="relative overflow-hidden bg-navy-950 pb-5 pt-4 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(640px circle at 8% 0%, rgba(232,105,31,0.22), transparent 62%)" }} />
        <div className={`relative flex flex-col gap-3 ${LARGURA}`}>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => navigate(voltarPara)} className="flex items-center gap-1.5 rounded-md py-1 text-[13px] text-white/60 transition-colors hover:text-white">
              <ArrowLeft size={15} />
              {voltarRotulo}
            </button>
            <ThemeToggle />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-accent-400">
                <Scale size={13} />
                Reforma Tributária
              </span>
              <h1 className="mt-1 truncate text-[26px] font-medium leading-tight tracking-tight">{titulo}</h1>
              {subtitulo && <p className="mt-1 max-w-[900px] text-[13px] leading-relaxed text-white/60">{subtitulo}</p>}
            </div>
            {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
          </div>
          {extra}
        </div>
      </header>
      {barra && (
        <div className="sticky top-0 z-30 border-b border-line bg-surface-page/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface-page/75">
          <div className={`flex flex-wrap items-center justify-between gap-x-4 ${LARGURA}`}>{barra}</div>
        </div>
      )}
      <main className={`mt-5 flex flex-col gap-4 ${LARGURA}`}>{children}</main>
    </div>
  );
}
