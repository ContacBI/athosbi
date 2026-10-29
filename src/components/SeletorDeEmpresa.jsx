import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Network, Search, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { recentes } from "../lib/recentes.js";
import { realStaff } from "../lib/modoEquipe.js";
import { unidadesDaCarteira } from "../lib/unidades.js";
import Avatar from "./Avatar.jsx";

const norm = (valor) => String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Janela flutuante pra escolher a empresa ou o grupo do B.I. — no lugar da
// página "Escolha uma empresa" (pedido do Izaias, 29/10/2026: abrir o B.I.
// direto e trocar sem passar por outra página). Grupo primeiro: cada grupo
// com as empresas dele logo embaixo, e as empresas sem grupo à parte. Sem
// busca, as abertas por último vêm em cima; com busca: nome, código ou CNPJ.
export default function SeletorDeEmpresa({ aberto, onFechar, onEscolher }) {
  const state = useAppState();
  // A equipe no "ver como cliente" do portal continua vendo a carteira toda (lib/modoEquipe.js).
  const staff = Boolean(state.isAdmin || state.isColaborador || realStaff(state));
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState(0);
  const campo = useRef(null);
  const lista = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    setTermo("");
    setIndice(0);
    const t = setTimeout(() => campo.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [aberto]);

  const secoes = useMemo(() => {
    // Cliente só vê o grupo inteiro (mesma regra de Empresas.jsx).
    const { grupos, avulsas } = unidadesDaCarteira(state.companies, state.groups, { soCompletos: !staff });
    const daEmpresa = (company, extra = {}) => ({ tipo: "empresa", id: company.id, nome: company.name, detalhe: [company.codigo, company.cnpj].filter(Boolean).join(" · "), busca: `${company.codigo || ""} ${company.cnpj || ""}`, ...extra });
    const doGrupo = (unidade) => ({ tipo: "grupo", id: unidade.id, nome: unidade.nome, detalhe: `Consolidado · ${unidade.membros.length} ${unidade.membros.length === 1 ? "empresa" : "empresas"}` });
    const busca = norm(termo.trim());
    if (busca) {
      const grupoDe = new Map();
      grupos.forEach((unidade) => unidade.membros.forEach((company) => grupoDe.set(company.id, grupoDe.get(company.id) || unidade.nome)));
      const achados = [
        ...grupos.filter((unidade) => norm(unidade.nome).includes(busca)).map(doGrupo),
        ...state.companies
          .filter((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(busca))
          .map((company) => daEmpresa(company, { detalhe: [grupoDe.get(company.id) && `Grupo ${grupoDe.get(company.id)}`, company.codigo, company.cnpj].filter(Boolean).join(" · ") })),
      ];
      return [{ titulo: `${achados.length} ${achados.length === 1 ? "resultado" : "resultados"}`, itens: achados.slice(0, 40) }];
    }
    const todos = new Map([...grupos.map((unidade) => doGrupo(unidade)), ...state.companies.map((company) => daEmpresa(company))].map((item) => [`${item.tipo}:${item.id}`, item]));
    const ultimas = recentes()
      .map((item) => todos.get(`${item.tipo}:${item.id}`))
      .filter(Boolean)
      .slice(0, 4);
    const doGrupoComMembros = grupos.flatMap((unidade) => [doGrupo(unidade), ...unidade.membros.map((company) => daEmpresa(company, { membro: true }))]);
    return [
      { titulo: "Abertas por último", itens: ultimas },
      { titulo: "Grupos", itens: doGrupoComMembros },
      { titulo: grupos.length ? "Empresas sem grupo" : "Empresas", itens: avulsas.map((unidade) => daEmpresa(unidade.empresa)) },
    ].filter((secao) => secao.itens.length);
  }, [termo, staff, state.groups, state.companies]);

  const planos = secoes.flatMap((secao) => secao.itens);

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  if (!aberto) return null;
  const ativo = (item) => (item.tipo === "grupo" ? state.activeGroupId === item.id : !state.activeGroupId && state.activeCompanyId === item.id);
  const escolher = (item) => {
    onFechar();
    onEscolher(item);
  };
  let contador = -1;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#030712]/45 px-4 pt-[10vh] backdrop-blur-sm" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Escolher empresa ou grupo">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-surface-card text-ink-900 shadow-2xl ring-1 ring-line" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search size={18} className="shrink-0 text-ink-400" />
          <input
            ref={campo}
            value={termo}
            onChange={(event) => {
              setTermo(event.target.value);
              setIndice(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onFechar();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndice((i) => Math.min(planos.length - 1, i + 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndice((i) => Math.max(0, i - 1));
              }
              if (event.key === "Enter" && planos[indice]) escolher(planos[indice]);
            }}
            placeholder={staff ? "Grupo ou empresa — nome, código ou CNPJ" : "Qual empresa você quer ver?"}
            className="h-16 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-400"
          />
          <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-surface-muted hover:text-ink-900">
            <X size={16} />
          </button>
        </div>
        <div ref={lista} className="max-h-[60vh] overflow-y-auto p-2">
          {planos.length === 0 && <p className="px-4 py-8 text-center text-[13.5px] text-ink-400">Nada encontrado para "{termo.trim()}".</p>}
          {secoes.map((secao) => (
            <div key={secao.titulo} className="mb-1">
              <p className="px-3 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{secao.titulo}</p>
              {secao.itens.map((item) => {
                contador += 1;
                const i = contador;
                return (
                  <button
                    key={`${secao.titulo}:${item.tipo}:${item.id}:${i}`}
                    type="button"
                    data-indice={i}
                    onMouseEnter={() => setIndice(i)}
                    onClick={() => escolher(item)}
                    className={`flex w-full items-center gap-3 rounded-2xl text-left transition-colors ${item.membro ? "ml-6 w-[calc(100%-1.5rem)] px-3 py-1.5" : "px-3 py-2.5"} ${i === indice ? "bg-surface-muted" : ""}`}
                  >
                    {item.tipo === "grupo" ? (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white">
                        <Network size={16} />
                      </span>
                    ) : (
                      <Avatar name={item.nome} size={item.membro ? 26 : 36} className={item.membro ? "rounded-lg" : "rounded-xl"} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate font-semibold ${item.membro ? "text-[13px]" : "text-[14px]"}`}>{item.nome}</span>
                        {ativo(item) && <span className="shrink-0 rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700">aberta</span>}
                      </span>
                      {item.detalhe && !item.membro && <span className="block truncate text-[12px] text-ink-400">{item.detalhe}</span>}
                    </span>
                    {i === indice && <CornerDownLeft size={15} className="shrink-0 text-ink-400" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
