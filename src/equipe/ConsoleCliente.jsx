import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, CheckCircle2, CircleAlert, Eye, EyeOff, Info, LayoutGrid, PencilLine, Puzzle, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { listAccessGrants, listAccessPeople } from "../lib/access.js";
import { monthLabel } from "../lib/carteira.js";
import { MODULOS_COMPLEMENTARES } from "../lib/modulos.js";
import { gruposDaEmpresa, lembrarGrupoContexto } from "../lib/unidades.js";
import { abasDoAlvo, kAba, ocultoNaConfiguracao } from "../lib/visibilidade.js";
import AcessoClientesModal from "../components/AcessoClientesModal.jsx";
import Avatar from "../components/Avatar.jsx";
import { problemasDaEmpresa, statusDaUnidade, useSaude } from "./useSaude.js";
import { useNomesDaEquipe } from "./useNomes.js";
import { Responsaveis } from "./ConsoleClientes.jsx";
import { Cartao, IconeDaUnidade, SeloDeStatus } from "./pecas.jsx";

const ABAS = [
  { id: "visao", nome: "Visão geral" },
  { id: "paineis", nome: "Painéis" },
  { id: "dados", nome: "Dados" },
  { id: "acessos", nome: "Acessos" },
  { id: "ferramentas", nome: "Ferramentas" },
];

// Ferramentas que ainda vão entrar (pedido do Izaias, 29/10/2026: a apuração
// de ICMS não é pra todas as empresas — liga por grupo quando existir).
const EM_PREPARACAO = [{ id: "apuracao-icms", nome: "Apuração de ICMS", texto: "Automática, a partir das notas — só para os grupos que contratarem." }];

const ICONE_DO_NIVEL = {
  critico: <CircleAlert size={16} className="shrink-0 text-[#d8493a]" />,
  atencao: <TriangleAlert size={16} className="shrink-0 text-[#d99a2b]" />,
  info: <Info size={16} className="shrink-0 text-[var(--hub-texto-3)]" />,
  ok: <CheckCircle2 size={16} className="shrink-0 text-[#1d9e75]" />,
};

function quando(dias) {
  if (dias == null) return "—";
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.round(dias / 30);
  return meses <= 1 ? "há 1 mês" : `há ${meses} meses`;
}

function Titulo({ titulo, texto, acoes }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="hub-display text-[22px] font-bold">{titulo}</h2>
        {texto && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--hub-texto-2)]">{texto}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

function AbaVisaoGeral({ empresas, healths, onResolver }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {empresas.map((company) => {
        const saude = healths[company.id];
        const problemas = problemasDaEmpresa(saude);
        const emDia = (saude?.checks || []).filter((check) => check.level === "ok" || check.level === "info");
        return (
          <Cartao key={company.id} className="min-w-0 p-6">
            <div className="flex items-center gap-3.5">
              <Avatar name={company.name} size={40} className="rounded-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{company.name}</p>
                <p className="truncate text-[12.5px] text-[var(--hub-texto-3)]">{[company.codigo, company.cnpj].filter(Boolean).join(" · ") || "Empresa"}</p>
              </div>
              <SeloDeStatus status={saude?.status} />
            </div>
            <ul className="mt-5 space-y-2">
              {problemas.map((check) => (
                <li key={check.id} className="flex items-start gap-3 rounded-2xl bg-[var(--hub-fundo-2)] px-4 py-3">
                  {ICONE_DO_NIVEL[check.level]}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{check.title}</span>
                    {check.detail && <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--hub-texto-3)]">{check.detail}</span>}
                  </span>
                  {check.action && (
                    <button type="button" onClick={() => onResolver(company, check.action)} className="shrink-0 rounded-full border border-[var(--hub-borda-forte)] px-3 py-1 text-[12px] font-semibold text-[var(--hub-texto)] transition-colors hover:border-[var(--hub-acento)] hover:text-[var(--hub-acento)]">
                      {check.action.label}
                    </button>
                  )}
                </li>
              ))}
              {saude && problemas.length === 0 && <li className="rounded-2xl bg-[var(--hub-fundo-2)] px-4 py-3 text-[13.5px] font-semibold">Tudo em dia.</li>}
              {!saude && <li className="px-1 text-[13px] text-[var(--hub-texto-3)]">Conferindo…</li>}
            </ul>
            {emDia.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {emDia.map((check) => (
                  <span key={check.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hub-borda)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--hub-texto-2)]" title={check.detail}>
                    {ICONE_DO_NIVEL[check.level]}
                    {check.title}
                  </span>
                ))}
              </div>
            )}
          </Cartao>
        );
      })}
    </div>
  );
}

function AbaPaineis({ unidade, registro, onPersonalizar, onVisibilidade }) {
  const abas = abasDoAlvo(registro);
  const v = registro?.visibilidade;
  const configurado = v?.modo === "marcados" || Array.isArray(v?.ocultos);
  return (
    <>
      <Titulo
        titulo={unidade.tipo === "grupo" ? "Painéis do consolidado" : "Painéis do B.I."}
        texto={`As abas que aparecem no B.I. ${unidade.tipo === "grupo" ? "do grupo (cada empresa dele tem as dela)" : "desta empresa"} e se o cliente vê cada uma.${configurado ? "" : " Ainda sem configuração do que o cliente vê — hoje ele vê tudo."}`}
        acoes={
          <>
            <button type="button" onClick={onVisibilidade} className="hub-botao hub-botao-fantasma hub-botao-p">
              <Eye size={14} /> O que o cliente vê
            </button>
            <button type="button" onClick={onPersonalizar} className="hub-botao hub-botao-primario hub-botao-p">
              <LayoutGrid size={14} /> Personalizar painéis
            </button>
          </>
        }
      />
      <Cartao className="divide-y divide-[var(--hub-borda)] overflow-hidden">
        {abas.length === 0 && <p className="px-6 py-10 text-[14px] text-[var(--hub-texto-3)]">Nenhum painel montado ainda — use "Personalizar painéis".</p>}
        {abas.map((aba) => {
          const itens = aba.widgets.length + aba.subTabs.reduce((soma, sub) => soma + (sub.widgets || []).length, 0);
          const escondida = ocultoNaConfiguracao(v, kAba(aba.id));
          return (
            <div key={aba.id} className="flex items-center gap-4 px-6 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
                <BarChart3 size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold">{aba.name}</span>
                <span className="block text-[12.5px] text-[var(--hub-texto-3)]">
                  {itens} {itens === 1 ? "item" : "itens"}
                  {aba.subTabs.length ? ` · ${aba.subTabs.length} ${aba.subTabs.length === 1 ? "subaba" : "subabas"}` : ""}
                </span>
              </span>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${escondida ? "bg-[var(--hub-fundo-2)] text-[var(--hub-texto-3)]" : "bg-[rgba(29,158,117,0.12)] text-[#1d9e75]"}`}>
                {escondida ? <EyeOff size={13} /> : <Eye size={13} />}
                {escondida ? "Oculta pro cliente" : "O cliente vê"}
              </span>
            </div>
          );
        })}
      </Cartao>
    </>
  );
}

function AbaDados({ empresas, healths, onAbrir }) {
  return (
    <>
      <Titulo titulo="Dados de cada empresa" texto="De onde vem o balancete, até quando vai e o que falta vincular. A importação e o De/Para são feitos em cada empresa (o grupo soma as empresas)." />
      <Cartao className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-[var(--hub-borda)] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--hub-texto-3)]">
              <th className="px-6 py-3 font-bold">Empresa</th>
              <th className="px-3 py-3 font-bold">Origem</th>
              <th className="px-3 py-3 font-bold">Dados até</th>
              <th className="px-3 py-3 font-bold">Atualizado</th>
              <th className="px-3 py-3 font-bold">Lançamentos</th>
              <th className="px-3 py-3 font-bold">Sem De/Para</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hub-borda)]">
            {empresas.map((company) => {
              const m = healths[company.id]?.metrics || {};
              return (
                <tr key={company.id}>
                  <td className="max-w-[260px] truncate px-6 py-3.5 font-semibold">{company.name}</td>
                  <td className="px-3 py-3.5 text-[var(--hub-texto-2)]">{m.origem || "—"}</td>
                  <td className="px-3 py-3.5 text-[var(--hub-texto-2)]">{m.dataAte ? monthLabel(m.dataAte) : "—"}</td>
                  <td className="px-3 py-3.5 text-[var(--hub-texto-2)]">{quando(m.updatedDays)}</td>
                  <td className="px-3 py-3.5 tabular-nums text-[var(--hub-texto-2)]">{m.count != null ? Number(m.count).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-3 py-3.5 tabular-nums">{m.missing ? <span className="font-semibold text-[#d99a2b]">{m.missing}</span> : <span className="text-[var(--hub-texto-3)]">0</span>}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      {[
                        ["Importar dados", "/empresa/relatorios"],
                        ["De/Para", "/empresa/de-para"],
                        ["Conferência", "/empresa/conferencia"],
                      ].map(([rotulo, destino]) => (
                        <button key={destino} type="button" onClick={() => onAbrir(company, destino)} className="whitespace-nowrap rounded-full border border-[var(--hub-borda-forte)] px-3 py-1 text-[12px] font-semibold transition-colors hover:border-[var(--hub-acento)] hover:text-[var(--hub-acento)]">
                          {rotulo}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Cartao>
    </>
  );
}

function AbaAcessos({ unidade, empresas, admin, onGerenciar, versao }) {
  const state = useAppState();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!admin) return undefined;
    let vivo = true;
    setErro("");
    Promise.all([listAccessGrants(), listAccessPeople().catch(() => new Map())])
      .then(([grants, fichas]) => vivo && setDados({ grants, fichas }))
      .catch((error) => vivo && setErro(String(error?.message || error)));
    return () => {
      vivo = false;
    };
  }, [admin, versao]);

  const pessoas = useMemo(() => {
    if (!dados) return [];
    const nomeDaEmpresa = new Map(empresas.map((company) => [company.id, company.name]));
    const gruposAqui = unidade.tipo === "grupo" ? [unidade.id] : gruposDaEmpresa(state.groups, unidade.id).map((group) => group.id);
    const nomeDoGrupo = new Map(state.groups.map((group) => [group.id, group.name]));
    const porEmail = new Map();
    for (const grant of dados.grants) {
      let como = "";
      if (grant.scope_type === "group" && gruposAqui.includes(grant.scope_id)) como = unidade.tipo === "grupo" ? "O grupo inteiro" : `Pelo grupo ${nomeDoGrupo.get(grant.scope_id) || ""}`.trim();
      else if (grant.scope_type === "company" && nomeDaEmpresa.has(grant.scope_id)) como = unidade.tipo === "grupo" ? `Só ${nomeDaEmpresa.get(grant.scope_id)}` : "Esta empresa";
      if (!como) continue;
      const atual = porEmail.get(grant.email) || { email: grant.email, ficha: dados.fichas.get(grant.email), como: [] };
      atual.como.push(como);
      porEmail.set(grant.email, atual);
    }
    return [...porEmail.values()].sort((a, b) => String(a.ficha?.nome || a.email).localeCompare(String(b.ficha?.nome || b.email), "pt-BR"));
  }, [dados, empresas, unidade, state.groups]);

  return (
    <>
      <Titulo
        titulo="Quem tem acesso"
        texto={unidade.tipo === "grupo" ? "Clientes que recebem o grupo inteiro e quem ficou só com alguma empresa dele." : "Clientes desta empresa, direto ou pelo grupo."}
        acoes={
          admin && (
            <button type="button" onClick={onGerenciar} className="hub-botao hub-botao-primario hub-botao-p">
              <ShieldCheck size={14} /> Gerenciar acessos
            </button>
          )
        }
      />
      <Cartao className="divide-y divide-[var(--hub-borda)] overflow-hidden">
        {!admin && <p className="px-6 py-10 text-[14px] text-[var(--hub-texto-3)]">Só administradores veem a lista de acessos.</p>}
        {admin && erro && <p className="px-6 py-10 text-[14px] text-[#d8493a]">Não consegui ler os acessos: {erro}</p>}
        {admin && !erro && !dados && <p className="px-6 py-10 text-[14px] text-[var(--hub-texto-3)]">Carregando…</p>}
        {admin && dados && pessoas.length === 0 && <p className="px-6 py-10 text-[14px] text-[var(--hub-texto-3)]">Ninguém de fora tem acesso ainda.</p>}
        {pessoas.map((pessoa) => (
          <div key={pessoa.email} className="flex flex-wrap items-center gap-4 px-6 py-4">
            <Avatar name={pessoa.ficha?.nome || pessoa.email} size={38} className="rounded-full" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{pessoa.ficha?.nome || pessoa.email}</span>
              <span className="block truncate text-[12.5px] text-[var(--hub-texto-3)]">{pessoa.ficha?.nome ? pessoa.email : "Sem ficha"}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {pessoa.como.map((texto) => (
                <span key={texto} className="rounded-full bg-[var(--hub-fundo-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--hub-texto-2)]">
                  {texto}
                </span>
              ))}
            </span>
          </div>
        ))}
      </Cartao>
    </>
  );
}

function AbaFerramentas({ unidade, registro, onEscolher }) {
  const modulos = registro?.visibilidade?.modulos;
  const configurado = Array.isArray(modulos);
  return (
    <>
      <Titulo
        titulo="Ferramentas"
        texto={`O que os clientes ${unidade.tipo === "grupo" ? "deste grupo" : "desta empresa"} usam além do B.I. — o que fica desligado não aparece no menu deles.${configurado ? "" : " Ainda sem escolha aqui: vale o que estiver liberado na ficha de cada pessoa."}`}
        acoes={
          <button type="button" onClick={() => onEscolher(MODULOS_COMPLEMENTARES[0].id)} className="hub-botao hub-botao-primario hub-botao-p">
            <Puzzle size={14} /> Escolher as ferramentas
          </button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Cartao className="flex items-start gap-3.5 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
            <BarChart3 size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold">B.I. Contábil</span>
            <span className="mt-1 block text-[12.5px] text-[var(--hub-texto-3)]">Sempre ligado</span>
          </span>
        </Cartao>
        {MODULOS_COMPLEMENTARES.map((modulo) => {
          const ligado = configurado && modulos.includes(modulo.id);
          return (
            <button key={modulo.id} type="button" onClick={() => onEscolher(modulo.id)} className="hub-cartao hub-cartao-vivo flex items-start gap-3.5 p-5 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] text-[var(--hub-acento)]">
                <Puzzle size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold">{modulo.nome}</span>
                <span className={`mt-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${!configurado ? "text-[var(--hub-texto-3)]" : ligado ? "text-[#1d9e75]" : "text-[var(--hub-texto-3)]"}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: !configurado ? "var(--hub-borda-forte)" : ligado ? "#1d9e75" : "var(--hub-borda-forte)" }} />
                  {!configurado ? "Pela ficha de cada pessoa" : ligado ? "Ligado" : "Desligado"}
                </span>
              </span>
            </button>
          );
        })}
        {EM_PREPARACAO.map((item) => (
          <Cartao key={item.id} className="flex items-start gap-3.5 border-dashed p-5 opacity-80">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--hub-borda-forte)] text-[var(--hub-texto-3)]">
              <Puzzle size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[14.5px] font-bold">{item.nome}</span>
                <span className="hub-selo">Em preparação</span>
              </span>
              <span className="mt-1 block text-[12.5px] leading-snug text-[var(--hub-texto-3)]">{item.texto}</span>
            </span>
          </Cartao>
        ))}
      </div>
    </>
  );
}

// Console › ficha de um grupo (ou de uma empresa sem grupo): tudo dele num
// lugar só, com o atalho pra ver como o cliente vê e pra editar no B.I.
export default function ConsoleCliente() {
  const state = useAppState();
  const navigate = useNavigate();
  const { abrir } = useOutletContext();
  const { tipo, id } = useParams();
  const [params, setParams] = useSearchParams();
  const aba = ABAS.some((item) => item.id === params.get("aba")) ? params.get("aba") : "visao";
  const [modal, setModal] = useState(null); // seção do "Acesso dos clientes" aberta
  const [versaoDosAcessos, setVersaoDosAcessos] = useState(0);
  const { healths } = useSaude(state.companies);
  const nomes = useNomesDaEquipe();

  const grupo = tipo === "grupo" ? state.groups.find((group) => group.id === id) : null;
  const empresa = tipo === "empresa" ? state.companies.find((company) => company.id === id) : null;
  const registro = grupo || empresa;
  const empresas = useMemo(() => {
    if (grupo) return (grupo.companyIds || []).map((companyId) => state.companies.find((company) => company.id === companyId)).filter(Boolean);
    return empresa ? [empresa] : [];
  }, [grupo, empresa, state.companies]);

  if (!registro) {
    return (
      <Cartao className="px-6 py-12 text-center">
        <p className="text-[15px] font-semibold">Não encontrei {tipo === "grupo" ? "esse grupo" : "essa empresa"}.</p>
        <button type="button" onClick={() => navigate("/equipe/clientes")} className="hub-botao hub-botao-fantasma mt-6">
          <ArrowLeft size={16} /> Grupos e empresas
        </button>
      </Cartao>
    );
  }

  const unidade = { tipo: grupo ? "grupo" : "empresa", id: registro.id, nome: registro.name };
  const status = statusDaUnidade(empresas, healths);
  const responsaveis = [...new Set(empresas.flatMap((company) => company.responsaveis || []))];
  const datas = empresas.map((company) => healths[company.id]?.metrics?.dataAte).filter(Boolean).sort();
  const outrosGrupos = empresa ? gruposDaEmpresa(state.groups, empresa.id) : [];

  // Abrir uma empresa (do grupo) numa tela do B.I., editando — e lembrar o
  // grupo, pro seletor do topo mostrar o consolidado e as irmãs.
  const abrirEmpresa = (company, destino) => {
    if (grupo) lembrarGrupoContexto(grupo.id);
    abrir({ tipo: "empresa", id: company.id }, { destino });
  };
  const resolver = (company, acao) => {
    if (acao.path.startsWith("/parametros")) navigate(acao.path.replace(/^\/parametros/, "/equipe"));
    else abrirEmpresa(company, acao.path);
  };

  return (
    <>
      <button type="button" onClick={() => navigate("/equipe/clientes")} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--hub-texto-3)] transition-colors hover:text-[var(--hub-texto)]">
        <ArrowLeft size={15} /> Grupos e empresas
      </button>

      <Cartao className="p-7 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <IconeDaUnidade tipo={unidade.tipo} nome={unidade.nome} tamanho={64} />
          <div className="min-w-0 flex-1">
            <p className="hub-rotulo">{grupo ? "Grupo" : "Empresa"}</p>
            <h1 className="hub-display mt-1.5 truncate text-[30px] font-extrabold leading-tight sm:text-[36px]">{registro.name}</h1>
            <p className="mt-1 truncate text-[13.5px] text-[var(--hub-texto-3)]">
              {grupo ? empresas.map((company) => company.name).join(" · ") || "Sem empresas" : [empresa.codigo, empresa.cnpj, [empresa.municipio, empresa.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SeloDeStatus status={status} />
            <button type="button" onClick={() => abrir(unidade, { destino: "/empresa" })} className="hub-botao hub-botao-fantasma hub-botao-p" title="Abrir o B.I. com a edição ligada">
              <PencilLine size={14} /> Editar no B.I.
            </button>
            <button type="button" onClick={() => abrir(unidade, { comoCliente: true })} className="hub-botao hub-botao-primario hub-botao-p" title="Abrir exatamente como o cliente vê">
              <Eye size={14} /> Ver como cliente
            </button>
          </div>
        </div>
        <div className="mt-7 grid gap-6 border-t border-[var(--hub-borda)] pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="hub-rotulo !text-[10px]">{grupo ? "Empresas" : "Grupo"}</p>
            <p className="mt-1.5 text-[15px] font-bold">{grupo ? empresas.length : outrosGrupos.map((group) => group.name).join(", ") || "Sem grupo"}</p>
          </div>
          <div>
            <p className="hub-rotulo !text-[10px]">Dados até</p>
            <p className="mt-1.5 text-[15px] font-bold">{datas.length ? monthLabel(datas[0]) : "—"}</p>
          </div>
          <div>
            <p className="hub-rotulo !text-[10px]">Painéis</p>
            <p className="mt-1.5 text-[15px] font-bold">{abasDoAlvo(registro).length}</p>
          </div>
          <div className="min-w-0">
            <p className="hub-rotulo !text-[10px]">Responsáveis</p>
            <div className="mt-1.5">
              <Responsaveis emails={responsaveis} nomes={nomes} />
            </div>
          </div>
        </div>
      </Cartao>

      <div className="mb-7 mt-8 flex gap-6 overflow-x-auto border-b border-[var(--hub-borda)]" role="tablist" aria-label="Seções da ficha">
        {ABAS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={aba === item.id} onClick={() => setParams(item.id === "visao" ? {} : { aba: item.id }, { replace: true })} className="console-aba">
            {item.nome}
          </button>
        ))}
      </div>

      {aba === "visao" && <AbaVisaoGeral empresas={empresas} healths={healths} onResolver={resolver} />}
      {aba === "paineis" && <AbaPaineis unidade={unidade} registro={registro} onPersonalizar={() => abrir(unidade, { destino: "/empresa/personalizar" })} onVisibilidade={() => setModal("bi")} />}
      {aba === "dados" && <AbaDados empresas={empresas} healths={healths} onAbrir={abrirEmpresa} />}
      {aba === "acessos" && <AbaAcessos unidade={unidade} empresas={empresas} admin={state.realIsAdmin} versao={versaoDosAcessos} onGerenciar={() => setModal("pessoas")} />}
      {aba === "ferramentas" && <AbaFerramentas unidade={unidade} registro={registro} onEscolher={(secao) => setModal(secao)} />}

      {modal && (
        <AcessoClientesModal
          tipo={unidade.tipo}
          item={registro}
          secaoInicial={modal}
          onClose={() => {
            setModal(null);
            setVersaoDosAcessos((v) => v + 1);
          }}
        />
      )}
      {aba === "visao" && grupo && empresas.length === 0 && (
        <Cartao className="flex items-center gap-3 px-6 py-8 text-[14px] text-[var(--hub-texto-2)]">
          <Users size={16} /> Grupo sem empresas — monte em Cadastros › Grupos.
        </Cartao>
      )}
    </>
  );
}
