import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, Briefcase, Check, ChevronDown, Home, LayoutGrid, Scale, Wrench } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { AREAS_DO_HUB } from "../lib/hub.js";
import { MODULOS_COMPLEMENTARES, moduloDaRota, modulosLiberados } from "../lib/modulos.js";
import { realStaff } from "../lib/modoEquipe.js";
import { iconeDaFerramenta } from "../hub/iconesDasFerramentas.js";
import AthosMark from "./AthosMark.jsx";

function Item({ icone: Icone, nome, detalhe, ativo, desligado, selo, onClick }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={desligado} className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45 ${ativo ? "bg-surface-muted" : ""}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ativo ? "bg-accent-500 text-white" : "bg-accent-50 text-accent-600"}`}>
        <Icone size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-ink-900">{nome}</span>
          {selo && <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">{selo}</span>}
        </span>
        {detalhe && <span className="block truncate text-[11.5px] text-ink-400">{detalhe}</span>}
      </span>
      {ativo && <Check size={15} className="shrink-0 text-accent-500" />}
    </button>
  );
}

// A setinha ao lado da marca no topo do B.I. (pedido do Izaias, 29/10/2026):
// abre o menu do hub sem sair do B.I. — Início, Meu B.I., Reforma e as
// Ferramentas da empresa/grupo aberto (os módulos que ficavam no menu
// lateral). Só com o hub ligado.
export default function MenuDoHub() {
  const state = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const liberados = modulosLiberados(state);
  const ferramentas = MODULOS_COMPLEMENTARES.filter((modulo) => liberados.includes(modulo.id));
  const temDados = state.accounts.length > 0 || state.journal.length > 0;
  const moduloAqui = moduloDaRota(location.pathname);
  const emBreve = AREAS_DO_HUB.filter((area) => !area.pronta);
  const ir = (rota) => {
    setAberto(false);
    navigate(rota);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Menu do hub"
        aria-expanded={aberto}
        title="Menu: Início, Meu B.I., Reforma e Ferramentas"
        className={`flex items-center gap-1 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-white/10 ${aberto ? "bg-white/10" : ""}`}
      >
        <AthosMark size={26} />
        <ChevronDown size={14} className={`text-white/55 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 max-h-[calc(100vh-90px)] w-[300px] overflow-y-auto rounded-2xl bg-surface-card p-1.5 text-ink-900 shadow-xl ring-1 ring-line" role="menu" aria-label="Menu do hub">
            <Item icone={Home} nome="Início" onClick={() => ir("/hub")} />
            <Item icone={BarChart3} nome="Meu B.I." detalhe="Resumo, demonstrativos, indicadores" ativo={!moduloAqui} onClick={() => ir("/empresa")} />
            <Item icone={Scale} nome="Reforma Tributária" onClick={() => ir("/hub/reforma")} />
            <div className="my-1.5 h-px bg-line" />
            <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Ferramentas</p>
            {ferramentas.map((ferramenta) => (
              <Item
                key={ferramenta.id}
                icone={iconeDaFerramenta(ferramenta.id)}
                nome={ferramenta.nome}
                detalhe={ferramenta.precisaDeDados && !temDados ? "Sem dados importados ainda" : ferramenta.descricao}
                ativo={moduloAqui === ferramenta.id}
                desligado={ferramenta.precisaDeDados && !temDados}
                onClick={() => ir(ferramenta.rota)}
              />
            ))}
            {ferramentas.length === 0 && <p className="px-2.5 pb-1.5 text-[12px] text-ink-400">Nenhuma liberada para esta empresa.</p>}
            <Item icone={LayoutGrid} nome="Todas as ferramentas" onClick={() => ir("/hub/ferramentas")} />
            {(emBreve.length > 0 || realStaff(state)) && <div className="my-1.5 h-px bg-line" />}
            {emBreve.map((area) => (
              <Item key={area.id} icone={area.id === "servicos" ? Briefcase : BookOpen} nome={area.nome} selo="em breve" onClick={() => ir(area.rota)} />
            ))}
            {realStaff(state) && <Item icone={Wrench} nome="Console da equipe" detalhe="Editar grupos, acessos e cadastros" onClick={() => ir("/equipe")} />}
          </div>
        </>
      )}
    </div>
  );
}
