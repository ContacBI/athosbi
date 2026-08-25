import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, ChevronRight, Layers, Network, Search, Settings, SlashSquare, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { selectCompany } from "../lib/companies.js";
import { selectGroup, groupCompanies } from "../lib/groups.js";
import Avatar from "../components/Avatar.jsx";

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// journalCount (não company.journal.length) — o razão de cada empresa só
// carrega de verdade quando ela é aberta (ver ensureCompanyJournalLoaded em
// lib/companies.js); essa contagem vem do registro leve, sem baixar nada,
// o que é exatamente o que essa tela precisa mostrar (nunca o razão
// inteiro).
function journalCountOf(company) {
  return company.journalCount ?? (company.journal || []).length;
}

const SORTS = [
  { id: "nome", label: "Nome" },
  { id: "codigo", label: "Código" },
  { id: "lancamentos", label: "Volume" },
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

// A barra por trás do número não é decoração — é a única coisa nessa linha
// que responde à pergunta "quem, nessa carteira, pesa mais?" sem precisar
// comparar número por número subindo e descendo a lista. Escala relativa ao
// maior valor VISÍVEL no momento (não um máximo histórico fixo), então
// filtrar/buscar sempre recalibra a régua pro que sobrou na tela.
function VolumeCell({ value, max, width = "w-28" }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`relative hidden shrink-0 overflow-hidden rounded-md sm:block ${width}`}>
      <div className="absolute inset-y-0 left-0 rounded-md bg-accent-50" style={{ width: `${pct}%` }} aria-hidden="true" />
      <span className="relative block px-2 py-1 text-right font-mono text-[11.5px] tabular-nums text-ink-600">
        {value.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

function SortButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
      }`}
    >
      {children}
    </button>
  );
}

function CompanyRow({ company, isActive, isPending, disabled, onSelect, maxLancamentos }) {
  const contas = (company.accounts || []).length;
  const lancamentos = journalCountOf(company);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors sm:grid-cols-[auto_1fr_auto_auto_auto] sm:gap-4 ${
        isActive ? "border-accent-500 bg-accent-50/50" : "border-transparent hover:bg-surface-muted"
      } ${disabled && !isPending ? "opacity-40" : ""} ${disabled ? "cursor-wait" : ""}`}
    >
      <Avatar name={company.name} size={34} />
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium leading-tight text-ink-900">
          {company.codigo && <span className="mr-1.5 font-mono text-[11.5px] font-normal text-ink-400">{company.codigo}</span>}
          {company.name}
          {isActive && !isPending && <span className="ml-2 rounded-full bg-accent-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-accent-700">ativa</span>}
        </p>
        <p className="truncate text-[11.5px] text-ink-400">{company.cnpj || "CNPJ não informado"}{company.atividade ? ` · ${company.atividade}` : ""}</p>
      </div>
      {isPending ? (
        <p className="col-span-2 hidden shrink-0 items-center gap-1.5 text-[11px] font-medium text-accent-600 sm:flex">
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-accent-300 border-t-accent-600" />
          carregando…
        </p>
      ) : company.journalLoadFailed ? (
        <p className="col-span-2 hidden shrink-0 items-center gap-1 text-[11px] font-medium text-warning-600 sm:flex">
          <TriangleAlert size={12} strokeWidth={2} />
          não carregou
        </p>
      ) : (
        <>
          <span className="hidden w-14 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-ink-400 sm:block">{contas.toLocaleString("pt-BR")}</span>
          <VolumeCell value={lancamentos} max={maxLancamentos} />
        </>
      )}
      <ChevronRight size={16} className="shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-accent-500" />
    </button>
  );
}

function GroupRow({ group, members, isActive, isPending, disabled, onSelect, maxLancamentos }) {
  const lancamentos = members.reduce((sum, company) => sum + journalCountOf(company), 0);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors sm:grid-cols-[auto_1fr_auto_auto_auto] sm:gap-4 ${
        isActive ? "border-accent-500 bg-accent-50/50" : "border-transparent hover:bg-surface-muted"
      } ${disabled && !isPending ? "opacity-40" : ""} ${disabled ? "cursor-wait" : ""}`}
    >
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
        <Network size={14} strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium leading-tight text-ink-900">
          {group.name}
          {isActive && !isPending && <span className="ml-2 rounded-full bg-accent-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-accent-700">ativo</span>}
        </p>
        <p className="truncate text-[11.5px] text-ink-400">
          {isPending ? (
            <span className="inline-flex items-center gap-1.5 text-accent-600">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-accent-300 border-t-accent-600" />
              carregando o razão de {members.length} empresa{members.length === 1 ? "" : "s"}…
            </span>
          ) : (
            `${members.length} empresa${members.length === 1 ? "" : "s"}`
          )}
        </p>
      </div>
      <div className="hidden w-24 shrink-0 items-center sm:flex">
        {members.slice(0, 4).map((company) => (
          <Avatar key={company.id} name={company.name} size={22} className="ring-2 ring-surface-card -ml-1.5 first:ml-0" />
        ))}
        {members.length > 4 && <span className="ml-1 text-[11px] text-ink-400">+{members.length - 4}</span>}
      </div>
      <VolumeCell value={lancamentos} max={maxLancamentos} width="w-24" />
      <ChevronRight size={16} className="shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-accent-500" />
    </button>
  );
}

export default function Empresas() {
  const state = useAppState();
  const navigate = useNavigate();
  const [tab, setTab] = useState("empresas");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("nome");
  const searchRef = useRef(null);

  // Atalho "/" pra ir direto pra busca sem precisar do mouse — carteiras
  // grandes se navegam mais rápido digitando do que rolando.
  useEffect(() => {
    function handleKey(event) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // selectCompany/selectGroup são assíncronas (buscam o razão antes de
  // atualizar o estado ativo) — navegar ANTES delas terminarem fazia a tela
  // renderizar com o activeCompanyId/activeGroupId ainda antigo (a última
  // empresa aberta), então clicar num grupo podia abrir a empresa anterior
  // em vez do grupo. `pendingId` trava o card clicado num estado de
  // carregando pra ficar claro que algo está acontecendo enquanto espera.
  const [pendingId, setPendingId] = useState(null);

  async function handleAccess(id) {
    setPendingId(id);
    try {
      await selectCompany(id);
      navigate("/empresa");
    } finally {
      setPendingId(null);
    }
  }

  async function handleAccessGroup(id) {
    setPendingId(id);
    try {
      await selectGroup(id);
      navigate("/empresa");
    } finally {
      setPendingId(null);
    }
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

  const maxCompanyLancamentos = Math.max(1, ...visibleCompanies.map(journalCountOf));
  const maxGroupLancamentos = Math.max(1, ...visibleGroups.map((group) => groupCompanies(group).reduce((sum, c) => sum + journalCountOf(c), 0)));

  const showTabs = state.groups.length > 0;
  const effectiveTab = showTabs ? tab : "empresas";

  return (
    <div className="min-h-screen bg-surface-page pb-16">
      {/* Faixa de identidade — bem mais enxuta que uma "hero" de marketing:
          o trabalho de verdade é a busca+lista logo abaixo, então isso aqui
          só precisa situar "você está na carteira" e mostrar os totais de
          relance, não ocupar a metade da tela. */}
      <div className="relative overflow-hidden bg-navy-950 px-6 pb-6 pt-5 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(560px circle at 12% 0%, rgba(232,105,31,0.22), transparent 62%)" }}
        />
        <div className="relative mx-auto flex max-w-[1100px] flex-col gap-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 text-[13px] text-white/60 transition-colors hover:text-white"
            >
              <ArrowLeft size={15} />
              Início
            </button>
            {(state.isAdmin || state.isColaborador) && (
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

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-[12px] font-medium uppercase tracking-wide text-accent-400">Carteira</span>
              <h1 className="mt-1 text-[26px] font-medium leading-tight">Escolha uma empresa</h1>
            </div>
            {state.companies.length > 0 && (
              <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-[12.5px] tabular-nums text-white/55">
                <span><strong className="font-mono font-semibold text-white">{state.companies.length}</strong> empresas</span>
                <span className="text-white/25">·</span>
                <span><strong className="font-mono font-semibold text-white">{totalLancamentos.toLocaleString("pt-BR")}</strong> lançamentos</span>
                {state.groups.length > 0 && (
                  <>
                    <span className="text-white/25">·</span>
                    <span><strong className="font-mono font-semibold text-white">{state.groups.length}</strong> grupos</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-3 flex max-w-[1100px] flex-col gap-4 px-6">
        {/* Busca em primeiro plano — é ela quem faz o trabalho pesado numa
            carteira grande, então ganha o espaço e o peso visual que antes
            iam pro hero. Abas e ordenação encostam nela, não competem. */}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={effectiveTab === "grupos" ? "Buscar grupo..." : "Buscar por nome, código ou CNPJ..."}
            className="w-full rounded-xl border border-line bg-surface-card py-3 pl-11 pr-16 text-[14px] text-ink-900 shadow-sm outline-none placeholder:text-ink-300 focus:border-accent-400"
          />
          {!search && (
            <span className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] text-ink-300">
              <SlashSquare size={13} />
              busca rápida
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {showTabs ? (
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
          ) : (
            <span />
          )}
          {effectiveTab === "empresas" && (
            <div className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted p-1">
              {SORTS.map((option) => (
                <SortButton key={option.id} active={sort === option.id} onClick={() => setSort(option.id)}>
                  {option.label}
                </SortButton>
              ))}
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
                {(state.isAdmin || state.isColaborador) ? "Nenhuma empresa cadastrada" : "Nenhum acesso liberado pra você ainda"}
              </p>
              <p className="max-w-xs text-[13px] text-ink-400">
                {(state.isAdmin || state.isColaborador)
                  ? "Vá em Parâmetros para cadastrar a primeira empresa da sua carteira."
                  : "Fale com quem administra o portal pra liberar as empresas ou grupos que você precisa ver."}
              </p>
              {(state.isAdmin || state.isColaborador) && (
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
            <section className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
              {/* Cabeçalho de tabela de verdade — rotula as colunas que a
                  VolumeCell/contas só mostravam sem legenda antes. Some no
                  celular junto com as próprias colunas (ver sm:hidden). */}
              <div className="hidden items-center gap-4 border-b border-line bg-surface-muted/60 px-4 py-1.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-400 sm:grid sm:grid-cols-[34px_1fr_56px_112px_16px]">
                <span />
                <span>Empresa</span>
                <span className="text-right">Contas</span>
                <span className="text-right">Lançamentos</span>
                <span />
              </div>
              <div className="divide-y divide-line">
                {visibleCompanies.length === 0 && (
                  <p className="py-12 text-center text-[13px] text-ink-400">Nenhuma empresa bate com essa busca.</p>
                )}
                {visibleCompanies.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    isActive={company.id === state.activeCompanyId && !state.activeGroupId}
                    isPending={pendingId === company.id}
                    disabled={pendingId !== null}
                    onSelect={() => handleAccess(company.id)}
                    maxLancamentos={maxCompanyLancamentos}
                  />
                ))}
              </div>
            </section>
          )
        ) : (
          <section className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
            <div className="hidden items-center gap-4 border-b border-line bg-surface-muted/60 px-4 py-1.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-400 sm:grid sm:grid-cols-[34px_1fr_96px_96px_16px]">
              <span />
              <span>Grupo</span>
              <span>Empresas</span>
              <span className="text-right">Lançamentos</span>
              <span />
            </div>
            <div className="divide-y divide-line">
              {visibleGroups.length === 0 && (
                <p className="py-12 text-center text-[13px] text-ink-400">Nenhum grupo bate com essa busca.</p>
              )}
              {visibleGroups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  members={groupCompanies(group)}
                  isActive={group.id === state.activeGroupId}
                  isPending={pendingId === group.id}
                  disabled={pendingId !== null}
                  onSelect={() => handleAccessGroup(group.id)}
                  maxLancamentos={maxGroupLancamentos}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
