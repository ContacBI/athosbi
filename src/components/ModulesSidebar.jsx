import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Percent, Target, X } from "lucide-react";

// Módulos da empresa aberta (menu lateral): o B.I Contábil (resumo, demonstrativos, indicadores, gráficos) e os módulos complementares.
// Pra acrescentar um módulo novo é só uma linha aqui + a rota em App.jsx.
const MODULOS = [
  {
    id: "bi",
    nome: "B.I Contábil",
    descricao: "Resumo, demonstrativos, indicadores e gráficos",
    icone: LayoutGrid,
    to: "/empresa",
    // tudo que não é um dos módulos complementares abaixo é o B.I
    ativo: (path) => !path.startsWith("/empresa/orcamento") && !path.startsWith("/empresa/carga-tributaria"),
  },
  {
    id: "orcamento",
    nome: "Orçamento",
    descricao: "Orçado x realizado, mês a mês",
    icone: Target,
    to: "/empresa/orcamento",
    ativo: (path) => path.startsWith("/empresa/orcamento"),
    precisaDeDados: true,
  },
  {
    id: "carga-tributaria",
    nome: "Carga tributária",
    descricao: "Impostos do fiscal ÷ faturamento",
    icone: Percent,
    to: "/empresa/carga-tributaria",
    ativo: (path) => path.startsWith("/empresa/carga-tributaria"),
  },
];

export default function ModulesSidebar({ onClose, isGroup, hasData, overlay }) {
  const navigate = useNavigate();
  const location = useLocation();
  const itens = MODULOS.filter((item) => !(item.soEmpresa && isGroup) && !(item.precisaDeDados && !hasData));

  const painel = (
    <nav aria-label="Módulos" className={`flex w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface-card p-3 ${overlay ? "h-full shadow-xl" : "min-h-[calc(100vh-64px)]"}`}>
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">Módulos</p>
        <button type="button" onClick={onClose} aria-label="Fechar menu" title="Fechar menu" className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
          <X size={14} />
        </button>
      </div>
      {itens.map((item) => {
        const Icon = item.icone;
        const ativo = item.ativo(location.pathname);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              navigate(item.to);
              if (overlay) onClose();
            }}
            aria-current={ativo ? "page" : undefined}
            className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${ativo ? "bg-accent-500/12 text-accent-700" : "text-ink-700 hover:bg-surface-muted"}`}
          >
            <Icon size={16} strokeWidth={1.9} className={`mt-0.5 shrink-0 ${ativo ? "text-accent-600" : "text-ink-400"}`} />
            <span className="min-w-0">
              <span className={`block text-[13px] ${ativo ? "font-semibold" : "font-medium"}`}>{item.nome}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-400">{item.descricao}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );

  if (!overlay) return painel;
  return (
    <div className="fixed inset-0 z-40 flex">
      {painel}
      <button type="button" aria-label="Fechar menu" onClick={onClose} className="flex-1 bg-black/40" />
    </div>
  );
}
