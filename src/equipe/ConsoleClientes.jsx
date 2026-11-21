import { useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { BarChart3, Building2, Eye, FolderDown, Network, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { createCompany, deleteCompany, updateCompany } from "../lib/companies.js";
import { createGroup, deleteGroup, updateGroup } from "../lib/groups.js";
import { exportCompanyBackup } from "../lib/fullBackup.js";
import { isResponsavelForGroup } from "../lib/colaboradores.js";
import { alinharComConfirmacao, pararComConfirmacao } from "../lib/visaoDoGrupo.js";
import Avatar from "../components/Avatar.jsx";
import EditorEmpresa from "./EditorEmpresa.jsx";
import GroupModal from "../components/GroupModal.jsx";
import AcessoClientesModal from "../components/AcessoClientesModal.jsx";
import { nomeDaPessoa, useNomesDaEquipe } from "./useNomes.js";
import { Cabecalho, Cartao, IconeDaUnidade } from "./pecas.jsx";

const norm = (valor) => String(valor || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const porNome = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");

const ABAS = [
  { id: "empresas", nome: "Empresas" },
  { id: "grupos", nome: "Grupos" },
];

const lancamentosDe = (company) => company.journalCount ?? (company.journal || []).length;

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

function BotaoIcone({ icone: Icone, titulo, onClick, perigo = false, ativo = false, disabled = false, onContextMenu }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${ativo ? "border-[var(--hub-acento)] bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]" : "border-[var(--hub-borda)] text-[var(--hub-texto-2)]"} ${perigo ? "hover:border-[#d8493a] hover:text-[#d8493a]" : "hover:border-[var(--hub-acento)] hover:text-[var(--hub-acento)]"}`}
    >
      <Icone size={15} />
    </button>
  );
}

function LinhaDaEmpresa({ company, grupos, nomes, podeEditar, admin, ocupado, acoes }) {
  const responsaveis = (company.responsaveis || []).map((email) => nomeDaPessoa(email, nomes));
  const detalhe = [company.cnpj || "CNPJ não informado", grupos.map((group) => group.name).join(", "), responsaveis.length ? `Responsáveis: ${responsaveis.join(", ")}` : "Sem responsável"].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5 transition-colors hover:bg-[var(--hub-fundo-2)]">
      <button type="button" onClick={acoes.ficha} title="Abrir a ficha" className="group flex min-w-0 flex-[1_1_340px] items-center gap-3.5 text-left">
        <Avatar name={company.name} size={38} className="rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            {company.codigo && <span className="shrink-0 text-[12.5px] font-semibold text-[var(--hub-texto-3)]">{company.codigo}</span>}
            <span className="truncate text-[14px] font-bold transition-colors group-hover:text-[var(--hub-acento)]">{company.name}</span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--hub-texto-3)]" title={detalhe}>
            {detalhe}
          </span>
        </span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <BotaoIcone icone={Eye} titulo="Ver como o cliente vê (abre em outra aba)" onClick={acoes.verComoCliente} />
        <BotaoIcone icone={BarChart3} titulo="Abrir o B.I. com a edição ligada (abre em outra aba)" onClick={acoes.abrirBi} />
        {podeEditar && <BotaoIcone icone={Pencil} titulo="Editar o cadastro" onClick={acoes.editar} />}
        {podeEditar && <BotaoIcone icone={ShieldCheck} titulo="Acesso dos clientes: quem entra e o que vê" onClick={acoes.acesso} />}
        {podeEditar && <BotaoIcone icone={FolderDown} titulo="Baixar tudo desta empresa (backup)" onClick={acoes.backup} disabled={ocupado} />}
        {admin && <BotaoIcone icone={Trash2} titulo="Remover da carteira" perigo onClick={acoes.remover} />}
      </div>
    </div>
  );
}

function LinhaDoGrupo({ group, membros, podeEditar, admin, acoes }) {
  const lancamentos = membros.reduce((soma, company) => soma + lancamentosDe(company), 0);
  const detalhe = `${membros.length} ${membros.length === 1 ? "empresa" : "empresas"} · ${lancamentos.toLocaleString("pt-BR")} lançamentos${membros.length ? ` · ${membros.map((company) => company.name).join(", ")}` : ""}`;
  const sincronizado = Boolean(group.sincronizarVisao);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5 transition-colors hover:bg-[var(--hub-fundo-2)]">
      <button type="button" onClick={acoes.ficha} title="Abrir a ficha" className="group flex min-w-0 flex-[1_1_340px] items-center gap-3.5 text-left">
        <IconeDaUnidade tipo="grupo" nome={group.name} tamanho={38} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold transition-colors group-hover:text-[var(--hub-acento)]">{group.name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--hub-texto-3)]" title={detalhe}>
            {detalhe}
          </span>
        </span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <BotaoIcone icone={Eye} titulo="Ver como o cliente vê (abre em outra aba)" onClick={acoes.verComoCliente} />
        <BotaoIcone icone={BarChart3} titulo="Abrir o B.I. do grupo com a edição ligada (abre em outra aba)" onClick={acoes.abrirBi} />
        {podeEditar && (
          <BotaoIcone
            icone={RefreshCw}
            ativo={sincronizado}
            titulo={sincronizado ? "Visão sincronizada — clique para realinhar (botão direito: parar de sincronizar)" : "Alinhar a visão do grupo com todas as empresas"}
            onClick={acoes.alinhar}
            onContextMenu={(event) => {
              if (!sincronizado) return;
              event.preventDefault();
              acoes.pararSincronia();
            }}
          />
        )}
        {podeEditar && <BotaoIcone icone={Pencil} titulo="Editar o grupo (nome e empresas)" onClick={acoes.editar} />}
        {podeEditar && <BotaoIcone icone={ShieldCheck} titulo="Acesso dos clientes: quem entra e o que vê" onClick={acoes.acesso} />}
        {admin && <BotaoIcone icone={Trash2} titulo="Remover o grupo (as empresas continuam na carteira)" perigo onClick={acoes.remover} />}
      </div>
    </div>
  );
}

function Vazio({ children }) {
  return <p className="px-6 py-12 text-center text-[14px] text-[var(--hub-texto-3)]">{children}</p>;
}

// Console › Grupos e empresas (pedido do Izaias, 21/11/2026): duas abas em
// lista, com o cadastro de cada um — Empresas (código, CNPJ, grupo,
// responsáveis e os botões do cadastro) e Grupos (as empresas de
// cada um, lançamentos, alinhar a visão). Sem a saúde de cada um aqui — ela
// fica na Visão geral e na Saúde da carteira. Clicar no nome abre a ficha aqui no
// console; o B.I. abre em outra aba.
export default function ConsoleClientes() {
  const state = useAppState();
  const navigate = useNavigate();
  const { abrir } = useOutletContext();
  // A lista só é refeita quando ela muda — qualquer outra mudança no portal
  // (o percentual de um razão chegando, por exemplo) redesenha a página.
  // `abrir` muda a cada desenho do console: vai por uma referência.
  const abrirRef = useRef(abrir);
  abrirRef.current = abrir;
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "grupos" ? "grupos" : "empresas";
  const [termo, setTermo] = useState("");
  const [minhas, setMinhas] = useState(() => params.get("minhas") === "1");
  const [modalEmpresa, setModalEmpresa] = useState(undefined); // undefined = fechado, null = nova, objeto = editar
  const [modalGrupo, setModalGrupo] = useState(undefined);
  const [acesso, setAcesso] = useState(null); // { tipo, id }
  const [ocupado, setOcupado] = useState(null); // backup de uma empresa: { label, done, total }
  const nomes = useNomesDaEquipe();
  const admin = Boolean(state.isAdmin);
  const eu = state.userEmail;

  const trocar = (mudancas) => {
    const novo = new URLSearchParams(params);
    Object.entries(mudancas).forEach(([chave, valor]) => (valor ? novo.set(chave, valor) : novo.delete(chave)));
    setParams(novo, { replace: true });
  };

  const empresas = useMemo(() => {
    const busca = norm(termo.trim());
    const lista = state.companies
      .filter((company) => !busca || norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(busca))
      .filter((company) => !minhas || (company.responsaveis || []).includes(eu))
      .sort(porNome);
    return lista;
  }, [state.companies, termo, minhas, eu]);

  const grupos = useMemo(() => {
    const busca = norm(termo.trim());
    const porId = new Map(state.companies.map((company) => [company.id, company]));
    const lista = state.groups
      .map((group) => ({ group, membros: (group.companyIds || []).map((id) => porId.get(id)).filter(Boolean) }))
      .filter(({ group, membros }) => !busca || norm(group.name).includes(busca) || membros.some((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(busca)))
      .filter(({ membros }) => !minhas || membros.some((company) => (company.responsaveis || []).includes(eu)))
      .sort((a, b) => porNome(a.group, b.group));
    return lista;
  }, [state.companies, state.groups, termo, minhas, eu]);

  async function backup(company) {
    setOcupado({ label: `Gerando o backup de ${company.name}…`, done: 0, total: 0 });
    try {
      const result = await exportCompanyBackup(company.id, (done, total) => setOcupado({ label: total && done < total ? "Baixando anexos…" : "Montando o arquivo…", done, total }));
      setOcupado(null);
      window.alert(`Backup de ${result.name} gerado: ${result.journal.toLocaleString("pt-BR")} lançamentos, ${result.attachments} anexo(s).`);
    } catch (error) {
      console.error("Falha ao gerar o backup da empresa:", error);
      setOcupado(null);
      window.alert("Não consegui gerar o backup desta empresa. Confira a conexão e tente de novo.");
    }
  }

  const linhasDeEmpresas = useMemo(
    () =>
      empresas.map((company) => {
        const item = { tipo: "empresa", id: company.id };
        return (
          <LinhaDaEmpresa
            key={company.id}
            company={company}
            grupos={state.groups.filter((group) => (group.companyIds || []).includes(company.id))}
            nomes={nomes}
            podeEditar={admin || (company.responsaveis || []).includes(eu)}
            admin={admin}
            ocupado={Boolean(ocupado)}
            acoes={{
              ficha: () => navigate(`/equipe/clientes/empresa/${company.id}`),
              verComoCliente: () => abrirRef.current(item, { comoCliente: true }),
              abrirBi: () => abrirRef.current(item, {}),
              editar: () => setModalEmpresa(company),
              acesso: () => setAcesso(item),
              backup: () => backup(company),
              remover: () => {
                if (window.confirm(`Remover ${company.name} da carteira?`)) deleteCompany(company.id);
              },
            }}
          />
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [empresas, state.groups, nomes, admin, eu, Boolean(ocupado), navigate]
  );

  const linhasDeGrupos = useMemo(
    () =>
      grupos.map(({ group, membros }) => {
        const item = { tipo: "grupo", id: group.id };
        return (
          <LinhaDoGrupo
            key={group.id}
            group={group}
            membros={membros}
            podeEditar={admin || isResponsavelForGroup(state, group.id)}
            admin={admin}
            acoes={{
              ficha: () => navigate(`/equipe/clientes/grupo/${group.id}`),
              verComoCliente: () => abrirRef.current(item, { comoCliente: true }),
              abrirBi: () => abrirRef.current(item, {}),
              alinhar: () => alinharComConfirmacao(group),
              pararSincronia: () => pararComConfirmacao(group),
              editar: () => setModalGrupo(group),
              acesso: () => setAcesso(item),
              remover: () => {
                if (window.confirm(`Remover o grupo "${group.name}"? As empresas continuam na carteira.`)) deleteGroup(group.id);
              },
            }}
          />
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grupos, admin, eu, state.companies, state.groups, navigate]
  );

  const emGrupo = new Set(state.groups.flatMap((group) => group.companyIds || [])).size;
  const percentual = ocupado?.total ? Math.min(100, Math.round((ocupado.done / ocupado.total) * 100)) : null;
  const itemDoAcesso = acesso ? (acesso.tipo === "grupo" ? state.groups : state.companies).find((item) => item.id === acesso.id) : null;

  return (
    <>
      <Cabecalho
        rotulo="Carteira"
        titulo="Grupos e"
        italico="empresas"
        texto={`${state.companies.length} ${state.companies.length === 1 ? "empresa" : "empresas"} e ${state.groups.length} ${state.groups.length === 1 ? "grupo" : "grupos"} (${emGrupo} ${emGrupo === 1 ? "empresa agrupada" : "empresas agrupadas"}). Clique no nome para abrir a ficha; o B.I. abre em outra aba.`}
        acoes={
          <>
            <button type="button" onClick={() => setModalGrupo(null)} disabled={state.companies.length < 2} title={state.companies.length < 2 ? "Um grupo junta duas ou mais empresas" : undefined} className="hub-botao hub-botao-fantasma disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={16} /> Novo grupo
            </button>
            <button type="button" onClick={() => setModalEmpresa(null)} className="hub-botao hub-botao-primario">
              <Plus size={16} /> Nova empresa
            </button>
          </>
        }
      />

      <div className="mb-5 flex gap-7 overflow-x-auto border-b border-[var(--hub-borda)]" role="tablist" aria-label="Empresas ou grupos">
        {ABAS.map((item) => {
          const Icone = item.id === "grupos" ? Network : Building2;
          const total = item.id === "grupos" ? state.groups.length : state.companies.length;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={aba === item.id} onClick={() => trocar({ aba: item.id === "empresas" ? "" : item.id })} className="console-aba inline-flex items-center gap-2">
              <Icone size={16} />
              {item.nome}
              <span className="rounded-full bg-[var(--hub-fundo-2)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--hub-texto-2)]">{total}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--hub-texto-3)]" />
          <input value={termo} onChange={(event) => setTermo(event.target.value)} placeholder={aba === "grupos" ? "Buscar grupo ou empresa dentro dele" : "Buscar empresa — nome, código ou CNPJ"} className="h-12 w-full rounded-full border border-[var(--hub-borda-forte)] bg-[var(--hub-cartao)] pl-11 pr-4 text-[14px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)] focus:border-[var(--hub-acento)]" />
        </div>
        <label className="flex h-12 cursor-pointer items-center gap-2 rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] px-4 text-[13px] font-semibold text-[var(--hub-texto-2)]">
          <input type="checkbox" checked={minhas} onChange={(event) => setMinhas(event.target.checked)} className="h-4 w-4 accent-[#e8691f]" />
          Só as minhas
        </label>
      </div>

      {ocupado && (
        <Cartao className="mb-4 px-5 py-3.5" role="status">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate font-semibold text-[var(--hub-acento)]">
              {ocupado.label}
              {ocupado.total ? ` (${ocupado.done}/${ocupado.total} anexos)` : ""}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--hub-borda)]">
            <div className={`h-full rounded-full bg-[var(--hub-acento)] ${percentual == null ? "w-full animate-pulse" : "transition-[width]"}`} style={percentual == null ? undefined : { width: `${percentual}%` }} />
          </div>
        </Cartao>
      )}

      <Cartao className="divide-y divide-[var(--hub-borda)] overflow-hidden">
        {aba === "empresas" && (linhasDeEmpresas.length ? linhasDeEmpresas : <Vazio>{state.companies.length ? "Nenhuma empresa com esse filtro." : 'Nenhuma empresa cadastrada ainda — use "Nova empresa".'}</Vazio>)}
        {aba === "grupos" && (linhasDeGrupos.length ? linhasDeGrupos : <Vazio>{state.groups.length ? "Nenhum grupo com esse filtro." : state.companies.length < 2 ? "Cadastre pelo menos 2 empresas para montar um grupo." : 'Nenhum grupo criado ainda — use "Novo grupo".'}</Vazio>)}
      </Cartao>

      {modalEmpresa !== undefined && (
        <EditorEmpresa
          company={modalEmpresa}
          onClose={() => setModalEmpresa(undefined)}
          onSubmit={(fields) => {
            if (modalEmpresa) updateCompany(modalEmpresa.id, fields);
            else createCompany(fields);
            setModalEmpresa(undefined);
          }}
        />
      )}
      {modalGrupo !== undefined && (
        <GroupModal
          group={modalGrupo}
          onClose={() => setModalGrupo(undefined)}
          onSubmit={(fields) => {
            if (modalGrupo) updateGroup(modalGrupo.id, fields);
            else createGroup(fields);
            setModalGrupo(undefined);
          }}
        />
      )}
      {itemDoAcesso && <AcessoClientesModal tipo={acesso.tipo} item={itemDoAcesso} onClose={() => setAcesso(null)} />}
    </>
  );
}
