import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, CheckCircle2, CircleAlert, Eye, EyeOff, History, Info, LayoutGrid, Mail, PencilLine, Puzzle, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { inviteUser, listAccessGrants, listAccessPeople, ultimosAcessos } from "../lib/access.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { saveVisibilidadeEmpresa } from "../lib/companies.js";
import { saveVisibilidadeGrupo } from "../lib/groups.js";
import { alteracoesRecentes, descreverAlteracao } from "../lib/historico.js";
import { haQuanto } from "../lib/uso.js";
import { monthLabel } from "../lib/carteira.js";
import { MODULOS_COMPLEMENTARES } from "../lib/modulos.js";
import { gruposDaEmpresa, lembrarGrupoContexto } from "../lib/unidades.js";
import { abasDoAlvo, kAba, ocultoNaConfiguracao } from "../lib/visibilidade.js";
import AcessoClientesModal from "../components/AcessoClientesModal.jsx";
import Avatar from "../components/Avatar.jsx";
import { problemasDaEmpresa, statusDaUnidade, useSaude } from "./useSaude.js";
import { nomeDaPessoa, useNomesDaEquipe } from "./useNomes.js";
import { Responsaveis } from "./ConsoleClientes.jsx";
import { Cartao, IconeDaUnidade, SeloDeStatus } from "./pecas.jsx";
import { iconeDaFerramenta } from "../hub/iconesDasFerramentas.js";

const ABAS = [
  { id: "visao", nome: "Visão geral" },
  { id: "paineis", nome: "Painéis" },
  { id: "dados", nome: "Dados" },
  { id: "acessos", nome: "Acessos" },
  { id: "ferramentas", nome: "Ferramentas" },
  { id: "historico", nome: "Histórico" },
];

const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
const quandoFoi = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

// Quem tem acesso a esta unidade, com as concessões e a ficha (só o admin lê tudo).
async function lerAcessos() {
  const [grants, fichas] = await Promise.all([listAccessGrants(), listAccessPeople().catch(() => new Map())]);
  return { grants, fichas };
}

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

function AbaAcessos({ unidade, empresas, admin, onGerenciar, onVerComo, versao }) {
  const state = useAppState();
  const [dados, setDados] = useState(null);
  const [ultimos, setUltimos] = useState(new Map());
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState({});
  useEffect(() => {
    if (!admin) return undefined;
    let vivo = true;
    setErro("");
    lerAcessos()
      .then((lidos) => {
        if (!vivo) return;
        setDados(lidos);
        // Último acesso (registro da Central): diz se a pessoa já entrou ou se o convite está parado.
        ultimosAcessos(lidos.grants.map((grant) => grant.email))
          .then((mapa) => vivo && setUltimos(mapa))
          .catch(() => {});
      })
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
      const atual = porEmail.get(grant.email) || { email: grant.email, ficha: dados.fichas.get(grant.email), como: [], liberadoEm: grant.created_at };
      atual.como.push(como);
      if (grant.created_at && grant.created_at < atual.liberadoEm) atual.liberadoEm = grant.created_at;
      porEmail.set(grant.email, atual);
    }
    // Tudo o que cada pessoa tem (não só aqui) — pro "ver como".
    for (const pessoa of porEmail.values()) {
      const deles = dados.grants.filter((grant) => grant.email === pessoa.email);
      pessoa.escopo = { empresas: deles.filter((grant) => grant.scope_type === "company").map((grant) => grant.scope_id), grupos: deles.filter((grant) => grant.scope_type === "group").map((grant) => grant.scope_id) };
    }
    return [...porEmail.values()].sort((a, b) => String(a.ficha?.nome || a.email).localeCompare(String(b.ficha?.nome || b.email), "pt-BR"));
  }, [dados, empresas, unidade, state.groups]);

  async function reenviar(email) {
    setAvisos((atual) => ({ ...atual, [email]: "Enviando…" }));
    try {
      const resultado = await inviteUser(email);
      setAvisos((atual) => ({ ...atual, [email]: resultado?.alreadyExists ? "Já tem conta — não precisa de convite." : "Convite reenviado." }));
    } catch {
      setAvisos((atual) => ({ ...atual, [email]: "Não consegui enviar agora." }));
    }
  }

  // Abre o que a pessoa vê aqui: o grupo, se ela tem o grupo; senão a empresa dela dentro dele.
  function verComo(pessoa) {
    const alvo = unidade.tipo === "grupo" && pessoa.escopo.grupos.includes(unidade.id) ? unidade : { tipo: "empresa", id: empresas.find((company) => pessoa.escopo.empresas.includes(company.id))?.id || unidade.id };
    onVerComo(alvo, { email: pessoa.email, nome: pessoa.ficha?.nome || "", modulos: pessoa.ficha?.modulos || [], ...pessoa.escopo });
  }

  return (
    <>
      <Titulo
        titulo="Quem tem acesso"
        texto={`${unidade.tipo === "grupo" ? "Clientes que recebem o grupo inteiro e quem ficou só com alguma empresa dele." : "Clientes desta empresa, direto ou pelo grupo."} "Ver como" abre exatamente o que aquela pessoa vê.`}
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
        {pessoas.map((pessoa) => {
          const ultimo = ultimos.get(pessoa.email);
          return (
            <div key={pessoa.email} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
              <Avatar name={pessoa.ficha?.nome || pessoa.email} size={38} className="rounded-full" />
              <span className="min-w-0 flex-[1_1_220px]">
                <span className="block truncate text-[14px] font-bold">{pessoa.ficha?.nome || pessoa.email}</span>
                <span className="block truncate text-[12.5px] text-[var(--hub-texto-3)]">
                  {pessoa.ficha?.nome ? `${pessoa.email} · ` : ""}
                  {pessoa.liberadoEm ? `liberado em ${dataCurta(pessoa.liberadoEm)} · ` : ""}
                  {ultimo ? `último acesso ${haQuanto(ultimo)}` : <span className="font-semibold text-[#d99a2b]">nenhum acesso registrado</span>}
                </span>
                {avisos[pessoa.email] && <span className="mt-0.5 block text-[12px] font-semibold text-[var(--hub-acento)]">{avisos[pessoa.email]}</span>}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {pessoa.como.map((texto) => (
                  <span key={texto} className="rounded-full bg-[var(--hub-fundo-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--hub-texto-2)]">
                    {texto}
                  </span>
                ))}
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => reenviar(pessoa.email)} title="Mandar o e-mail de convite de novo (se o link venceu ou a pessoa não achou)" className="hub-botao hub-botao-fantasma hub-botao-p">
                  <Mail size={14} /> Reenviar convite
                </button>
                <button type="button" onClick={() => verComo(pessoa)} title={`Ver exatamente o que ${pessoa.ficha?.nome || pessoa.email} vê`} className="hub-botao hub-botao-fantasma hub-botao-p">
                  <Eye size={14} /> Ver como
                </button>
              </span>
            </div>
          );
        })}
      </Cartao>
    </>
  );
}

function Interruptor({ ligado, onChange, desligado, rotulo }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desligado} onClick={() => onChange(!ligado)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ligado ? "bg-[#1d9e75]" : "bg-[var(--hub-borda-forte)]"}`}>
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ligado ? "translate-x-5" : ""}`} />
    </button>
  );
}

// Ferramentas por grupo (pedido do Izaias, 29/10/2026): liga e desliga aqui
// mesmo. Fica no cadastro do grupo/empresa (`visibilidade.modulos`, o mesmo
// do "Acesso dos clientes") — e, num grupo sincronizado, vale pras empresas
// dele. Sem escolha ainda, vale a ficha de cada pessoa: o primeiro clique
// parte do que as fichas de quem tem acesso já liberam.
function AbaFerramentas({ unidade, registro, podeEditar, admin, onEscolher }) {
  const modulos = registro?.visibilidade?.modulos;
  const configurado = Array.isArray(modulos);
  const [dasFichas, setDasFichas] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const scopeType = unidade.tipo === "grupo" ? "group" : "company";

  useEffect(() => {
    if (configurado || !admin) return undefined;
    let vivo = true;
    lerAcessos()
      .then(({ grants, fichas }) => {
        const uniao = new Set();
        grants.filter((grant) => grant.scope_type === scopeType && grant.scope_id === unidade.id).forEach((grant) => (fichas.get(grant.email)?.modulos || []).forEach((id) => uniao.add(id)));
        if (vivo) setDasFichas(uniao);
      })
      .catch(() => vivo && setDasFichas(new Set()));
    return () => {
      vivo = false;
    };
  }, [configurado, admin, scopeType, unidade.id]);

  const ligados = configurado ? new Set(modulos) : dasFichas || new Set();
  const salvar = (visibilidade) => (unidade.tipo === "grupo" ? saveVisibilidadeGrupo(unidade.id, visibilidade) : saveVisibilidadeEmpresa(unidade.id, visibilidade));
  function alternar(id, ligar) {
    setSalvando(true);
    const novo = new Set(ligados);
    if (ligar) novo.add(id);
    else novo.delete(id);
    salvar({ ...(registro.visibilidade || {}), modulos: MODULOS_COMPLEMENTARES.map((modulo) => modulo.id).filter((m) => novo.has(m)) });
    setSalvando(false);
  }
  function voltarParaAsFichas() {
    const { modulos: _ignorado, ...resto } = registro.visibilidade || {};
    salvar(resto);
  }

  return (
    <>
      <Titulo
        titulo="Ferramentas"
        texto={`O que os clientes ${unidade.tipo === "grupo" ? "deste grupo" : "desta empresa"} usam além do B.I. — o que fica desligado não aparece pra eles.${configurado ? "" : " Ainda sem escolha aqui: hoje vale a ficha de cada pessoa (o que aparece ligado é o que as fichas já liberam); mexer aqui passa a valer pra todos."}`}
        acoes={
          <>
            {configurado && podeEditar && (
              <button type="button" onClick={voltarParaAsFichas} className="hub-botao hub-botao-fantasma hub-botao-p" title="Deixar de escolher aqui e voltar a valer o que está liberado na ficha de cada pessoa">
                Usar a ficha de cada pessoa
              </button>
            )}
            <button type="button" onClick={() => onEscolher(MODULOS_COMPLEMENTARES[0].id)} className="hub-botao hub-botao-fantasma hub-botao-p">
              <Puzzle size={14} /> O que cada uma mostra
            </button>
          </>
        }
      />
      {!podeEditar && <p className="-mt-2 mb-4 text-[13px] text-[var(--hub-texto-3)]">Só visualização — você não é responsável por {unidade.tipo === "grupo" ? "este grupo" : "esta empresa"}.</p>}
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
          const ligado = ligados.has(modulo.id);
          const Icone = iconeDaFerramenta(modulo.id);
          return (
            <Cartao key={modulo.id} className="flex items-start gap-3.5 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] text-[var(--hub-acento)]">
                <Icone size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold">{modulo.nome}</span>
                <span className="mt-1 block text-[12.5px] leading-snug text-[var(--hub-texto-3)]">{modulo.descricao}</span>
                <span className={`mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold ${ligado ? "text-[#1d9e75]" : "text-[var(--hub-texto-3)]"}`}>
                  {ligado ? "Ligada" : "Desligada"}
                  {!configurado && " · pelas fichas"}
                </span>
              </span>
              <Interruptor ligado={ligado} rotulo={`${modulo.nome} para os clientes`} desligado={!podeEditar || salvando || (!configurado && admin && dasFichas === null)} onChange={(valor) => alternar(modulo.id, valor)} />
            </Cartao>
          );
        })}
      </div>
    </>
  );
}

// Histórico de alterações (pedido do Izaias, 29/10/2026: "quem mudou o quê"),
// do backup automático do banco — ver lib/historico.js.
function AbaHistorico({ empresas, comGrupos, admin, nomes }) {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState("");
  const ids = empresas.map((company) => company.id).join(",");
  useEffect(() => {
    if (!admin) return undefined;
    let vivo = true;
    alteracoesRecentes({ empresas: ids ? ids.split(",") : [], comGrupos })
      .then((lidas) => vivo && setLinhas(lidas))
      .catch((error) => vivo && setErro(String(error?.message || error)));
    return () => {
      vivo = false;
    };
  }, [admin, ids, comGrupos]);
  const nomeDaEmpresa = (id) => empresas.find((company) => company.id === id)?.name;
  return (
    <>
      <Titulo
        titulo="Quem mudou o quê"
        texto="As alterações recentes no cadastro (painéis, De/Para, dados, o que o cliente vê, ferramentas). O banco guarda no máximo uma a cada 10 minutos por cadastro, por 60 dias."
        acoes={
          admin && (
            <button type="button" onClick={() => navigate("/equipe/sistema/historico")} className="hub-botao hub-botao-fantasma hub-botao-p">
              <History size={14} /> Ver e restaurar versões
            </button>
          )
        }
      />
      <Cartao className="divide-y divide-[var(--hub-borda)] overflow-hidden">
        {!admin && <p className="px-6 py-10 text-[14px] text-[var(--hub-texto-3)]">Só administradores veem o histórico.</p>}
        {admin && erro && <p className="px-6 py-10 text-[14px] text-[#d8493a]">Não consegui ler o histórico: {erro}</p>}
        {admin && !erro && !linhas && <p className="px-6 py-10 text-[14px] text-[var(--hub-texto-3)]">Carregando…</p>}
        {admin && linhas && linhas.length === 0 && <p className="px-6 py-10 text-[14px] text-[var(--hub-texto-3)]">Nenhuma alteração registrada nos últimos 60 dias.</p>}
        {(linhas || []).map((linha) => (
          <div key={linha.id} className="flex items-start gap-3.5 px-6 py-4">
            <Avatar name={nomeDaPessoa(linha.saved_by, nomes) || "?"} size={34} className="rounded-full" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] leading-snug">
                <b>{linha.saved_by ? nomeDaPessoa(linha.saved_by, nomes) : "Alguém"}</b> {descreverAlteracao(linha, nomeDaEmpresa)}
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--hub-texto-3)]">{quandoFoi(linha.saved_at)}</span>
            </span>
          </div>
        ))}
      </Cartao>
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
  // Mesma regra do B.I.: admin edita tudo; colaborador, onde é responsável.
  const podeEditar = Boolean(state.isAdmin || (grupo ? isResponsavelForGroup(state, grupo.id) : (empresa.responsaveis || []).includes(state.userEmail)));

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
      {aba === "acessos" && <AbaAcessos unidade={unidade} empresas={empresas} admin={state.realIsAdmin} versao={versaoDosAcessos} onGerenciar={() => setModal("pessoas")} onVerComo={(alvo, pessoa) => abrir(alvo, { pessoa })} />}
      {aba === "ferramentas" && <AbaFerramentas unidade={unidade} registro={registro} podeEditar={podeEditar} admin={state.realIsAdmin} onEscolher={(secao) => setModal(secao)} />}
      {aba === "historico" && <AbaHistorico empresas={empresas} comGrupos={Boolean(grupo)} admin={state.realIsAdmin} nomes={nomes} />}

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
