import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpDown, Building2, Layers, Network, Search, Settings, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { selectCompany } from "../lib/companies.js";
import { selectGroup, groupCompanies } from "../lib/groups.js";
import Avatar from "../components/Avatar.jsx";

function StatPill({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 backdrop-blur-sm">
      <span className="text-[19px] font-medium leading-none text-white">{value}</span>
      <span className="text-[11px] text-white/60">{label}</span>
    </div>
  );
}

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// journalCount (não company.journal.length) — o razão de cada empresa só
// carrega de verdade quando ela é aberta (ver ensureCompanyJournalLoaded em
// lib/companies.js); essa contagem vem do registro leve, sem baixar nada,
// o que é exatamente o que essa tela precisa mostrar (nunca o razão
// inteiro).
function journalCountOf(company) {
  return company.journalCount ?? (company.journal || []).length;
}

const SORT_OPTIONS = [
  { id: "nome", label: "Nome (A-Z)" },
  { id: "codigo", label: "Código" },
  { id: "lancamentos", label: "Mais lançamentos" },
];

function sortCompanies(companies, sort) {
  const sorted = [...companies];
  if (sort === "codigo") {
    sorted.sort((a, b) => {
      const code = String(a.codigo || "").localeCompare(String(b.codigo || ""), "pt-BR", { numeric: true });
      return code || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    });
  } else if (sort === "lancamentos") {
    sorted.sort((a, b) => journalCountOf(b) - journalCountOf(a));
  } else {
    sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }
  return sorted;
}

// Linha compacta (não mais um card grande) — cada empresa/grupo é uma
// linha só, tudo alinhado horizontalmente, pra dar pra escanear a carteira
// inteira olhando pra baixo em vez de ler bloco por bloco.
function CompanyRow({ company, isActive, onSelect }) {
  const contas = (company.accounts || []).length;
  const lancamentos = journalCountOf(company);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-4 border-l-2 px-4 py-3 text-left transition-colors ${
        isActive ? "border-accent-500 bg-accent-50/50" : "border-transparent hover:bg-surface-muted"
      }`}
    >
      <Avatar name={company.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium leading-tight text-ink-900">
          {company.codigo && <span className="mr-1.5 font-normal text-ink-400">{company.codigo}</span>}
          {company.name}
          {isActive && <span className="ml-2 rounded-full bg-accent-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-accent-700">ativa</span>}
        </p>
        <p className="truncate text-[11.5px] text-ink-400">{company.cnpj || "CNPJ não informado"}{company.atividade ? ` · ${company.atividade}` : ""}</p>
      </div>
      {company.journalLoadFailed ? (
        <p className="hidden shrink-0 items-center gap-1 text-[11px] font-medium text-warning-600 sm:flex">
          <TriangleAlert size={12} strokeWidth={2} />
          não carregou
        </p>
      ) : (
        <div className="hidden shrink-0 items-center gap-3 text-[11.5px] text-ink-400 sm:flex">
          <span className="w-20 text-right">{contas.toLocaleString("pt-BR")} contas</span>
          <span className="w-28 text-right">{lancamentos.toLocaleString("pt-BR")} lanç.</span>
        </div>
      )}
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent-600 transition-transform group-hover:translate-x-0.5">
        Acessar
        <ArrowRight size={13} />
      </span>
    </button>
  );
}

function GroupRow({ group, members, isActive, onSelect }) {
  const lancamentos = members.reduce((sum, company) => sum + journalCountOf(company), 0);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-4 border-l-2 px-4 py-3 text-left transition-colors ${
        isActive ? "border-accent-500 bg-accent-50/50" : "border-transparent hover:bg-surface-muted"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
        <Network size={15} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium leading-tight text-ink-900">
          {group.name}
          {isActive && <span className="ml-2 rounded-full bg-accent-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-accent-700">ativo</span>}
        </p>
        <p className="truncate text-[11.5px] text-ink-400">{members.length} empresa{members.length === 1 ? "" : "s"}</p>
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        {members.slice(0, 4).map((company) => (
          <Avatar key={company.id} name={company.name} size={22} className="ring-2 ring-surface-card -ml-1.5 first:ml-0" />
        ))}
        {members.length > 4 && <span className="ml-0.5 text-[11px] text-ink-400">+{members.length - 4}</span>}
      </div>
      <span className="hidden w-28 shrink-0 text-right text-[11.5px] text-ink-400 sm:block">{lancamentos.toLocaleString("pt-BR")} lanç.</span>
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent-600 transition-transform group-hover:translate-x-0.5">
        Acessar
        <ArrowRight size={13} />
      </span>
    </button>
  );
}

export default function Empresas() {
  const state = useAppState();
  const navigate = useNavigate();
  const [tab, setTab] = useState("empresas");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("nome");

  function handleAccess(id) {
    selectCompany(id);
    navigate("/empresa");
  }

  function handleAccessGroup(id) {
    selectGroup(id);
    navigate("/empresa");
  }

  const totalLancamentos = state.companies.reduce((sum, company) => sum + journalCountOf(company), 0);

  const visibleCompanies = useMemo(() => {
    const term = norm(search);
    const filtered = term
      ? state.companies.filter((company) => norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(term))
      : state.companies;
    return sortCompanies(filtered, sort);
  }, [state.companies, search, sort]);

  const visibleGroups = useMemo(() => {
    const term = norm(search);
    const groups = term ? state.groups.filter((group) => norm(group.name).includes(term)) : state.groups;
    return [...groups].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }, [state.groups, search]);

  const showTabs = state.groups.length > 0;
  const effectiveTab = showTabs ? tab : "empresas";

  return (
    <div className="min-h-screen bg-surface-page pb-16">
      {/* Hero — mesma linguagem navy/accent do Login/Landing, ancorando a
          carteira como a "porta de entrada" real do produto em vez de mais
          uma tela de lista genérica. */}
      <div className="relative overflow-hidden bg-navy-950 px-6 pb-10 pt-6 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(680px circle at 15% 0%, rgba(47,111,237,0.25), transparent 60%), radial-gradient(420px circle at 85% 30%, rgba(47,111,237,0.14), transparent 65%)",
          }}
        />
        <div className="relative mx-auto flex max-w-[1100px] flex-col gap-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-[13px] text-white/60 transition-colors hover:text-white"
            >
              <ArrowLeft size={15} />
              Início
            </button>
            {state.isAdmin && (
              <button
                type="button"
                onClick={() => navigate("/parametros")}
                className="flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-white/80 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white"
              >
                <Settings size={15} />
                Cadastrar / editar empresas
              </button>
            )}
          </div>

          <div>
            <span className="text-[12px] font-medium uppercase tracking-wide text-accent-400">Carteira</span>
            <h1 className="mt-1.5 text-[32px] font-medium leading-tight">Escolha uma empresa</h1>
            <p className="mt-1.5 max-w-md text-[14px] text-white/60">Selecione um cliente para acessar os relatórios dele.</p>
          </div>

          {state.companies.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <StatPill label="Empresas na carteira" value={state.companies.length} />
              <StatPill label="Lançamentos ao todo" value={totalLancamentos.toLocaleString("pt-BR")} />
              {state.groups.length > 0 && <StatPill label="Grupos consolidados" value={state.groups.length} />}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto -mt-4 flex max-w-[1100px] flex-col gap-5 px-6">
        {/* Barra de controle: abas Empresas/Grupos (só aparece se existir
            algum grupo — senão é só ruído) + busca + ordenação, tudo junto
            pra achar uma empresa numa carteira grande ser rápido em vez de
            rolar a página inteira procurando. */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-surface-card p-2.5 shadow-sm">
          {showTabs && (
            <div className="inline-flex gap-0.5 rounded-full bg-surface-muted p-1">
              <button
                type="button"
                onClick={() => setTab("empresas")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  effectiveTab === "empresas" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"
                }`}
              >
                <Building2 size={13} strokeWidth={2} />
                Empresas
              </button>
              <button
                type="button"
                onClick={() => setTab("grupos")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  effectiveTab === "grupos" ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500"
                }`}
              >
                <Layers size={13} strokeWidth={2} />
                Grupos
              </button>
            </div>
          )}
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={effectiveTab === "grupos" ? "Buscar grupo..." : "Buscar por nome, código ou CNPJ..."}
              className="w-full rounded-lg border border-line bg-surface-page py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400"
            />
          </div>
          {effectiveTab === "empresas" && (
            <div className="relative">
              <ArrowUpDown size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="appearance-none rounded-lg border border-line bg-surface-page py-2 pl-7 pr-7 text-[12.5px] text-ink-700 outline-none focus:border-accent-400"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {effectiveTab === "empresas" ? (
          state.companies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-card px-6 py-16 text-center shadow-sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                <Building2 size={26} strokeWidth={1.6} />
              </span>
              <p className="text-[15px] font-medium text-ink-900">
                {state.isAdmin ? "Nenhuma empresa cadastrada" : "Nenhum acesso liberado pra você ainda"}
              </p>
              <p className="max-w-xs text-[13px] text-ink-400">
                {state.isAdmin
                  ? "Vá em Parâmetros para cadastrar a primeira empresa da sua carteira."
                  : "Fale com quem administra o portal pra liberar as empresas ou grupos que você precisa ver."}
              </p>
              {state.isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate("/parametros")}
                  className="mt-1 rounded-full bg-accent-500 px-5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
                >
                  Cadastrar / editar empresas
                </button>
              )}
            </div>
          ) : (
            <section className="divide-y divide-line overflow-hidden rounded-xl bg-surface-card shadow-sm">
              {visibleCompanies.length === 0 && (
                <p className="py-12 text-center text-[13px] text-ink-400">Nenhuma empresa bate com essa busca.</p>
              )}
              {visibleCompanies.map((company) => (
                <CompanyRow
                  key={company.id}
                  company={company}
                  isActive={company.id === state.activeCompanyId && !state.activeGroupId}
                  onSelect={() => handleAccess(company.id)}
                />
              ))}
            </section>
          )
        ) : (
          <section className="divide-y divide-line overflow-hidden rounded-xl bg-surface-card shadow-sm">
            {visibleGroups.length === 0 && (
              <p className="py-12 text-center text-[13px] text-ink-400">Nenhum grupo bate com essa busca.</p>
            )}
            {visibleGroups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                members={groupCompanies(group)}
                isActive={group.id === state.activeGroupId}
                onSelect={() => handleAccessGroup(group.id)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
