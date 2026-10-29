import { useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, PencilLine, Plus, Search } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { monthLabel } from "../lib/carteira.js";
import { unidadesDaCarteira } from "../lib/unidades.js";
import Avatar from "../components/Avatar.jsx";
import { COR_DO_STATUS, problemasDaEmpresa, statusDaUnidade, useSaude } from "./useSaude.js";
import { nomeDaPessoa, useNomesDaEquipe } from "./useNomes.js";
import { Cabecalho, Cartao, IconeDaUnidade, PontoDeStatus, SeloDeStatus } from "./pecas.jsx";

const norm = (valor) => String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ORDEM = { critico: 0, atencao: 1, ok: 2 };

const FILTROS = [
  { id: "todos", nome: "Todos" },
  { id: "grupos", nome: "Grupos" },
  { id: "avulsas", nome: "Sem grupo" },
  { id: "pendencias", nome: "Com pendência" },
];

function dadosAte(health) {
  const m = health?.metrics;
  if (!m) return "";
  if (m.dataAte) return `até ${monthLabel(m.dataAte)}`;
  return m.origem ? m.origem : "sem balancete";
}

export function Responsaveis({ emails, nomes }) {
  if (!emails.length) return <span className="text-[12.5px] text-[var(--hub-texto-3)]">Sem responsável</span>;
  const nomesLegiveis = emails.map((email) => nomeDaPessoa(email, nomes));
  return (
    <span className="flex min-w-0 items-center gap-2" title={nomesLegiveis.join(", ")}>
      <span className="flex -space-x-2">
        {emails.slice(0, 3).map((email) => (
          <Avatar key={email} name={nomeDaPessoa(email, nomes)} size={26} className="rounded-full ring-2 ring-[var(--hub-cartao-solido)]" />
        ))}
      </span>
      <span className="truncate text-[12.5px] text-[var(--hub-texto-2)]">
        {nomesLegiveis[0]}
        {emails.length > 1 ? ` +${emails.length - 1}` : ""}
      </span>
    </span>
  );
}

function CartaoDaUnidade({ unidade, healths, nomes, onFicha, onAbrir }) {
  const responsaveis = [...new Set(unidade.empresas.flatMap((company) => company.responsaveis || []))];
  const grupo = unidade.tipo === "grupo";
  const empresa = unidade.empresas[0];
  return (
    <Cartao className="flex min-w-0 flex-col p-6">
      <div className="flex items-start gap-4">
        <IconeDaUnidade tipo={unidade.tipo} nome={unidade.nome} />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onFicha} className="hub-display block max-w-full truncate text-left text-[18px] font-bold transition-colors hover:text-[var(--hub-acento)]">
            {unidade.nome}
          </button>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--hub-texto-3)]">{grupo ? `Grupo · ${unidade.empresas.length} ${unidade.empresas.length === 1 ? "empresa" : "empresas"}` : [empresa?.codigo, empresa?.cnpj, dadosAte(healths[empresa?.id])].filter(Boolean).join(" · ") || "Empresa"}</p>
        </div>
        <SeloDeStatus status={unidade.status} />
      </div>
      {grupo && (
        <ul className="mt-5 space-y-1.5">
          {unidade.empresas.length === 0 && <li className="rounded-xl bg-[var(--hub-fundo-2)] px-3 py-2 text-[13px] text-[var(--hub-texto-3)]">Grupo ainda sem empresas.</li>}
          {unidade.empresas.map((company) => {
            // O motivo do status (o pior problema) no lugar da data — é ele que explica o selo do grupo.
            const problemas = problemasDaEmpresa(healths[company.id]);
            return (
              <li key={company.id} className="flex items-center gap-2.5 rounded-xl bg-[var(--hub-fundo-2)] px-3 py-2" title={problemas.map((problema) => problema.title).join(" · ") || undefined}>
                <PontoDeStatus status={healths[company.id]?.status} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{company.name}</span>
                {problemas.length ? (
                  <span className="max-w-[45%] shrink-0 truncate text-[12px] font-semibold" style={{ color: COR_DO_STATUS[problemas[0].level] }}>
                    {problemas[0].title}
                    {problemas.length > 1 ? ` +${problemas.length - 1}` : ""}
                  </span>
                ) : (
                  <span className="shrink-0 text-[12px] text-[var(--hub-texto-3)]">{dadosAte(healths[company.id])}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <Responsaveis emails={responsaveis} nomes={nomes} />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onAbrir({ comoCliente: true })} className="hub-botao hub-botao-fantasma hub-botao-p" title="Abrir exatamente como o cliente vê">
            <Eye size={14} /> Ver como cliente
          </button>
          <button type="button" onClick={() => onAbrir({})} className="hub-botao hub-botao-fantasma hub-botao-p" title="Abrir o B.I. com a edição ligada">
            <PencilLine size={14} /> Editar
          </button>
          <button type="button" onClick={onFicha} aria-label={`Abrir a ficha de ${unidade.nome}`} title="Ficha" className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[var(--hub-acento)] text-white transition-transform hover:-translate-y-0.5">
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </Cartao>
  );
}

// Console › Grupos e empresas: a carteira por grupo (com as empresas dentro)
// e as empresas sem grupo à parte.
export default function ConsoleClientes() {
  const state = useAppState();
  const navigate = useNavigate();
  const { abrir } = useOutletContext();
  // A lista de cartões só é refeita quando ela muda — qualquer outra mudança
  // no portal (o percentual de um razão chegando, por exemplo) redesenha a
  // página, e com a carteira toda isso pesava. `abrir` muda a cada desenho
  // do console: vai por uma referência.
  const abrirRef = useRef(abrir);
  abrirRef.current = abrir;
  const [params, setParams] = useSearchParams();
  const ver = FILTROS.some((filtro) => filtro.id === params.get("ver")) ? params.get("ver") : "todos";
  const [termo, setTermo] = useState("");
  const [minhas, setMinhas] = useState(false);
  const { healths } = useSaude(state.companies);
  const nomes = useNomesDaEquipe();
  const { grupos, avulsas } = useMemo(() => unidadesDaCarteira(state.companies, state.groups), [state.companies, state.groups]);

  const unidades = useMemo(() => {
    const busca = norm(termo.trim());
    const lista = [...grupos.map((unidade) => ({ ...unidade, empresas: unidade.membros })), ...avulsas.map((unidade) => ({ ...unidade, empresas: [unidade.empresa] }))]
      .filter((unidade) => ver !== "grupos" || unidade.tipo === "grupo")
      .filter((unidade) => ver !== "avulsas" || unidade.tipo === "empresa")
      .filter((unidade) => !busca || norm(unidade.nome).includes(busca) || unidade.empresas.some((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(busca)))
      .filter((unidade) => !minhas || unidade.empresas.some((company) => (company.responsaveis || []).includes(state.userEmail)))
      .map((unidade) => ({ ...unidade, status: statusDaUnidade(unidade.empresas, healths) }))
      .filter((unidade) => ver !== "pendencias" || unidade.status === "critico" || unidade.status === "atencao");
    if (ver === "pendencias") lista.sort((a, b) => ORDEM[a.status] - ORDEM[b.status]);
    return lista;
  }, [grupos, avulsas, healths, termo, ver, minhas, state.userEmail]);

  const cartoes = useMemo(
    () => unidades.map((unidade) => <CartaoDaUnidade key={`${unidade.tipo}:${unidade.id}`} unidade={unidade} healths={healths} nomes={nomes} onFicha={() => navigate(`/equipe/clientes/${unidade.tipo}/${unidade.id}`)} onAbrir={(opcoes) => abrirRef.current(unidade, opcoes)} />),
    [unidades, healths, nomes, navigate]
  );

  return (
    <>
      <Cabecalho
        rotulo="Carteira"
        titulo="Grupos e"
        italico="empresas"
        texto={`${grupos.length} ${grupos.length === 1 ? "grupo" : "grupos"} e ${avulsas.length} ${avulsas.length === 1 ? "empresa" : "empresas"} sem grupo. O cliente recebe o grupo inteiro — o consolidado e cada empresa dentro dele.`}
        acoes={
          <>
            <button type="button" onClick={() => navigate("/equipe/grupo")} className="hub-botao hub-botao-fantasma">
              <Plus size={16} /> Novo grupo
            </button>
            <button type="button" onClick={() => navigate("/equipe/empresas")} className="hub-botao hub-botao-primario">
              <Plus size={16} /> Nova empresa
            </button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--hub-texto-3)]" />
          <input value={termo} onChange={(event) => setTermo(event.target.value)} placeholder="Buscar grupo ou empresa — nome, código ou CNPJ" className="h-12 w-full rounded-full border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] pl-11 pr-4 text-[14px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)] focus:border-[var(--hub-acento)]" />
        </div>
        <div className="flex rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] p-1" role="tablist" aria-label="Filtrar">
          {FILTROS.map((filtro) => (
            <button
              key={filtro.id}
              type="button"
              role="tab"
              aria-selected={ver === filtro.id}
              onClick={() => setParams(filtro.id === "todos" ? {} : { ver: filtro.id }, { replace: true })}
              className={`h-10 rounded-full px-4 text-[13px] font-semibold transition-colors ${ver === filtro.id ? "bg-[var(--hub-texto)] text-[var(--hub-fundo)]" : "text-[var(--hub-texto-2)] hover:text-[var(--hub-texto)]"}`}
            >
              {filtro.nome}
            </button>
          ))}
        </div>
        <label className="flex h-12 cursor-pointer items-center gap-2 rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] px-4 text-[13px] font-semibold text-[var(--hub-texto-2)]">
          <input type="checkbox" checked={minhas} onChange={(event) => setMinhas(event.target.checked)} className="h-4 w-4 accent-[#e8691f]" />
          Só as minhas
        </label>
      </div>

      {unidades.length === 0 && <Cartao className="px-6 py-12 text-center text-[14px] text-[var(--hub-texto-3)]">Nada com esse filtro.</Cartao>}
      <div className="grid gap-5 lg:grid-cols-2">
        {cartoes}
      </div>
    </>
  );
}
