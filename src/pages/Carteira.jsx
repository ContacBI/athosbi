import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Info, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { selectCompany } from "../lib/companies.js";
import { listAdmins, listColaboradores } from "../lib/colaboradores.js";
import { analyzeCompanyJournal, cachedJournalStats, companyHealth, monthLabel } from "../lib/carteira.js";
import Avatar from "../components/Avatar.jsx";

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const STATUS = {
  critico: { label: "Crítica", dot: "bg-danger-500", text: "text-danger-600", soft: "bg-danger-50", ring: "ring-danger-200" },
  atencao: { label: "Atenção", dot: "bg-warning-500", text: "text-warning-700", soft: "bg-warning-50", ring: "ring-warning-500/30" },
  ok: { label: "Em dia", dot: "bg-success-500", text: "text-success-600", soft: "bg-success-50", ring: "ring-success-500/30" },
};

const LEVEL_ICON = {
  critico: <CircleAlert size={15} className="shrink-0 text-danger-500" />,
  atencao: <TriangleAlert size={15} className="shrink-0 text-warning-500" />,
  info: <Info size={15} className="shrink-0 text-ink-400" />,
  ok: <CheckCircle2 size={15} className="shrink-0 text-success-500" />,
};

// Atalhos de filtro por tipo de problema (os ids vêm de lib/carteira.js).
const ISSUES = [
  { id: "balanco", label: "Balanço não fecha", match: (h) => h.checks.some((c) => c.id === "balanco" && c.level === "critico") },
  { id: "depara", label: "Contas sem De/Para", match: (h) => h.checks.some((c) => (c.id === "depara" || c.id === "razao_depara") && c.level !== "ok") },
  { id: "atraso", label: "Dados desatualizados", match: (h) => h.checks.some((c) => (c.id === "balancete" || c.id === "meses" || c.id === "razao_atrasado") && (c.level === "atencao" || c.level === "critico")) },
  { id: "responsavel", label: "Sem responsável", match: (h) => h.checks.some((c) => c.id === "responsavel") },
];

function pessoaLabel(email, names) {
  return names[email] || String(email || "").split("@")[0];
}

function SummaryCard({ active, onClick, tone, value, label, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center gap-3 rounded-xl bg-surface-card px-4 py-3 text-left shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? "ring-2 ring-accent-500" : "ring-line"}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <span>
        <span className="block font-mono text-[20px] font-semibold leading-none tabular-nums text-ink-900">{value}</span>
        <span className="mt-1 block text-[12px] text-ink-500">{label}</span>
      </span>
    </button>
  );
}

function CompanyHealthRow({ company, health, names, expanded, onToggle, onAction }) {
  const status = STATUS[health?.status || "ok"];
  const m = health?.metrics || {};
  const problems = (health?.checks || []).filter((check) => check.level === "critico" || check.level === "atencao");
  const stats = m.journalStats;
  const gaps = (health?.checks || []).find((check) => check.id === "meses");
  return (
    <div className={`border-l-2 ${expanded ? "border-accent-500 bg-surface-muted/40" : "border-transparent"}`}>
      <button type="button" onClick={onToggle} className="carteira-row grid w-full grid-cols-[14px_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted md:grid-cols-[14px_minmax(0,1fr)_96px_110px_96px_120px_92px_16px]">
        <span className={`h-2.5 w-2.5 rounded-full ${health ? status.dot : "animate-pulse bg-line-strong"}`} title={health ? status.label : "Calculando…"} />
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-ink-900">
            {company.codigo && <span className="mr-1.5 font-mono text-[11.5px] font-normal text-ink-400">{company.codigo}</span>}
            {company.name}
          </span>
          <span className="block truncate text-[11.5px] text-ink-400">
            {health ? (problems.length ? problems.map((check) => check.title).join(" · ") : "Tudo certo") : "Calculando…"}
          </span>
        </span>
        <span className="hidden text-[12px] md:block">
          {m.dataAte ? <span className="font-medium text-ink-700">{monthLabel(m.dataAte)}</span> : <span className="text-ink-400">{m.origem || "—"}</span>}
          {m.updatedDays != null && <span className="block text-[10.5px] text-ink-400">{m.origem === "Domínio" ? "Domínio" : "planilha"}</span>}
        </span>
        <span className="hidden text-[12px] md:block">
          {!health ? "" : Math.abs(m.dif) >= 1 ? <span className="font-medium text-danger-600">≠ {Math.abs(m.dif).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</span> : (company.accounts || []).length ? <span className="text-success-600">Fecha</span> : <span className="text-ink-400">—</span>}
        </span>
        <span className="hidden text-[12px] md:block">
          {!health ? "" : m.missing ? <span className="font-medium text-warning-700">{m.missing} sem De/Para</span> : (company.accounts || []).length ? <span className="text-success-600">Completo</span> : <span className="text-ink-400">—</span>}
        </span>
        <span className="hidden text-[12px] md:block">
          <span className="font-mono tabular-nums text-ink-700">{m.count != null ? Number(m.count).toLocaleString("pt-BR") : "—"}</span>
          {stats && <span className={`block text-[10.5px] ${gaps && gaps.level !== "ok" ? "text-warning-700" : "text-ink-400"}`}>{gaps && gaps.level !== "ok" ? gaps.title : "meses completos"}</span>}
        </span>
        <span className="hidden items-center md:flex">
          {(m.responsaveis || []).slice(0, 3).map((email) => (
            <span key={email} title={pessoaLabel(email, names)} className="-ml-1.5 first:ml-0">
              <Avatar name={pessoaLabel(email, names)} size={22} className="ring-2 ring-surface-card" />
            </span>
          ))}
          {(m.responsaveis || []).length > 3 && <span className="ml-1 text-[11px] text-ink-400">+{m.responsaveis.length - 3}</span>}
          {health && !(m.responsaveis || []).length && <span className="text-[11.5px] text-warning-700">ninguém</span>}
        </span>
        {expanded ? <ChevronDown size={16} className="text-ink-400" /> : <ChevronRight size={16} className="text-ink-300" />}
      </button>
      {expanded && health && (
        <div className="grid gap-1.5 px-4 pb-4 pl-11">
          {health.checks.map((check) => (
            <div key={check.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg bg-surface-card px-3 py-2 ring-1 ring-line">
              <span className="mt-px">{LEVEL_ICON[check.level]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink-900">{check.title}</span>
                {check.detail && <span className="block text-[12px] leading-snug text-ink-500">{check.detail}</span>}
              </span>
              {check.action && (
                <button type="button" onClick={() => onAction(company, check.action)} className="shrink-0 rounded-lg bg-accent-50 px-2.5 py-1 text-[12px] font-semibold text-accent-700 hover:bg-accent-100">
                  {check.action.label}
                </button>
              )}
            </div>
          ))}
          {stats && <p className="pt-1 text-[11px] text-ink-400">Lançamentos analisados em {new Date(stats.analyzedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.</p>}
        </div>
      )}
    </div>
  );
}

export default function Carteira() {
  const state = useAppState();
  const navigate = useNavigate();
  const staff = state.isAdmin || state.isColaborador;
  const [healths, setHealths] = useState({});
  const [statsById, setStatsById] = useState({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [issueFilter, setIssueFilter] = useState("");
  const [owner, setOwner] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [names, setNames] = useState({});
  const [analysis, setAnalysis] = useState(null); // { done, total, current, errors }
  const cancelRef = useRef(false);

  // Nomes de quem é do escritório (o cadastro guarda só o e-mail na empresa).
  useEffect(() => {
    if (!staff) return;
    Promise.all([listAdmins().catch(() => []), listColaboradores().catch(() => [])]).then(([admins, colaboradores]) => {
      const map = {};
      [...(admins || []), ...(colaboradores || [])].forEach((pessoa) => {
        if (pessoa?.email && pessoa.nome) map[pessoa.email] = pessoa.nome;
      });
      setNames(map);
    });
  }, [staff]);

  // Resumos do razão que já existem (análise anterior neste navegador ou a
  // empresa aberta agora).
  useEffect(() => {
    const found = {};
    state.companies.forEach((company) => {
      const stats = cachedJournalStats(company);
      if (stats) found[company.id] = stats;
    });
    setStatsById((current) => ({ ...found, ...current }));
  }, [state.companies]);

  // Uma empresa por vez, fora do clique: com a carteira inteira são alguns
  // centésimos de segundo cada, e a tela não pode travar enquanto isso.
  useEffect(() => {
    let cancelled = false;
    const queue = [...state.companies];
    const today = new Date();
    function next() {
      if (cancelled || !queue.length) return;
      const company = queue.shift();
      const health = companyHealth(company, { today, journalStats: statsById[company.id] || null });
      setHealths((current) => ({ ...current, [company.id]: health }));
      setTimeout(next, 0);
    }
    const handle = setTimeout(next, 30);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [state.companies, statsById]);

  async function analyzeAll() {
    cancelRef.current = false;
    const targets = state.companies.filter((company) => (company.journalCount ?? 1) > 0);
    setAnalysis({ done: 0, total: targets.length, current: "", errors: 0 });
    for (let i = 0; i < targets.length; i += 1) {
      if (cancelRef.current) break;
      const company = targets[i];
      setAnalysis((current) => ({ ...current, current: company.name, part: 0 }));
      try {
        const stats = await analyzeCompanyJournal(company, { onProgress: (fraction) => setAnalysis((current) => ({ ...current, part: fraction })) });
        setStatsById((current) => ({ ...current, [company.id]: stats }));
      } catch (error) {
        console.error(`Carteira: não consegui ler o razão de ${company.name}`, error);
        setAnalysis((current) => ({ ...current, errors: current.errors + 1 }));
      }
      setAnalysis((current) => ({ ...current, done: i + 1 }));
    }
    setAnalysis((current) => ({ ...current, current: "", finished: true }));
  }

  function openAction(company, action) {
    if (action.path.startsWith("/parametros")) {
      navigate(action.path);
      return;
    }
    selectCompany(company.id);
    navigate(action.path);
  }

  const owners = useMemo(() => [...new Set(state.companies.flatMap((company) => company.responsaveis || []))].sort((a, b) => pessoaLabel(a, names).localeCompare(pessoaLabel(b, names), "pt-BR")), [state.companies, names]);

  const rows = useMemo(() => {
    const term = norm(search);
    const issue = ISSUES.find((item) => item.id === issueFilter);
    return state.companies
      .filter((company) => !term || norm(`${company.name} ${company.codigo || ""} ${company.cnpj || ""}`).includes(term))
      .filter((company) => !owner || (owner === "__mine" ? (company.responsaveis || []).includes(state.userEmail) : owner === "__none" ? !(company.responsaveis || []).length : (company.responsaveis || []).includes(owner)))
      .filter((company) => !statusFilter || healths[company.id]?.status === statusFilter)
      .filter((company) => !issue || (healths[company.id] && issue.match(healths[company.id])))
      .sort((a, b) => {
        const order = { critico: 0, atencao: 1, ok: 2 };
        const sa = order[healths[a.id]?.status] ?? 3;
        const sb = order[healths[b.id]?.status] ?? 3;
        return sa - sb || (healths[b.id]?.problems || 0) - (healths[a.id]?.problems || 0) || String(a.name).localeCompare(String(b.name), "pt-BR");
      });
  }, [state.companies, healths, search, owner, statusFilter, issueFilter, state.userEmail]);

  const all = Object.values(healths);
  const count = (status) => all.filter((health) => health.status === status).length;
  const issueCount = (issue) => all.filter((health) => issue.match(health)).length;
  const calculating = all.length < state.companies.length;
  const analyzedCount = Object.keys(statsById).length;

  if (!staff) return <Navigate to="/empresas" replace />;

  return (
    <div className="bi-pagina min-h-screen bg-surface-page pb-16">
      <div className="bi-cabecalho relative overflow-hidden bg-navy-950 px-6 pb-6 pt-5 text-white">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(560px circle at 12% 0%, rgba(232,105,31,0.22), transparent 62%)" }} />
        <div className="relative mx-auto flex max-w-[1200px] flex-col gap-4">
          <button type="button" onClick={() => navigate("/empresas")} className="flex w-fit items-center gap-1.5 text-[13px] text-white/60 transition-colors hover:text-white">
            <ArrowLeft size={15} /> Empresas
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-[12px] font-medium uppercase tracking-wide text-accent-400">Carteira</span>
              <h1 className="mt-1 flex items-center gap-2 text-[26px] font-medium leading-tight">
                <Activity size={24} className="text-accent-400" /> Saúde da carteira
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] text-white/60">O estado dos dados de cada empresa: balancete em dia, balanço fechando, De/Para completo, lançamentos e responsável — antes de apresentar um número, confira aqui.</p>
            </div>
            <p className="font-mono text-[12.5px] tabular-nums text-white/55">
              <strong className="font-semibold text-white">{state.companies.length}</strong> empresas{calculating ? " · calculando…" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-5 flex max-w-[1200px] flex-col gap-4 px-6">
        <div className="flex flex-wrap gap-3">
          <SummaryCard active={statusFilter === "critico"} onClick={() => setStatusFilter((v) => (v === "critico" ? "" : "critico"))} tone="bg-danger-50 text-danger-600" icon={<CircleAlert size={18} />} value={count("critico")} label="Críticas" />
          <SummaryCard active={statusFilter === "atencao"} onClick={() => setStatusFilter((v) => (v === "atencao" ? "" : "atencao"))} tone="bg-warning-50 text-warning-600" icon={<TriangleAlert size={18} />} value={count("atencao")} label="Pedem atenção" />
          <SummaryCard active={statusFilter === "ok"} onClick={() => setStatusFilter((v) => (v === "ok" ? "" : "ok"))} tone="bg-success-50 text-success-600" icon={<CheckCircle2 size={18} />} value={count("ok")} label="Em dia" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ISSUES.map((issue) => {
            const n = issueCount(issue);
            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => setIssueFilter((v) => (v === issue.id ? "" : issue.id))}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${issueFilter === issue.id ? "border-accent-500 bg-accent-50 text-accent-700" : "border-line bg-surface-card text-ink-600 hover:border-accent-300"}`}
              >
                {issue.label}
                <span className={`rounded-full px-1.5 font-mono text-[11px] ${n ? "bg-surface-muted text-ink-800" : "text-ink-300"}`}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empresa…" className="h-10 w-full rounded-lg border border-line bg-surface-card pl-10 pr-3 text-[13.5px] outline-none focus:border-accent-400" />
          </div>
          <select value={owner} onChange={(event) => setOwner(event.target.value)} className="h-10 rounded-lg border border-line bg-surface-card px-3 text-[13px] text-ink-700 outline-none focus:border-accent-400">
            <option value="">Todos os responsáveis</option>
            {state.userEmail && <option value="__mine">Só as minhas</option>}
            <option value="__none">Sem responsável</option>
            {owners.map((email) => (
              <option key={email} value={email}>
                {pessoaLabel(email, names)}
              </option>
            ))}
          </select>
          {analysis && !analysis.finished ? (
            <button type="button" onClick={() => (cancelRef.current = true)} className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-card px-3.5 text-[12.5px] text-ink-600 hover:bg-surface-muted" title="Parar a análise">
              <RefreshCw size={14} className="animate-spin text-accent-500" />
              Analisando {analysis.done + 1}/{analysis.total}
              <span className="max-w-[160px] truncate text-ink-400">{analysis.current}</span>
            </button>
          ) : (
            <button type="button" onClick={analyzeAll} className="carteira-analisar flex h-10 items-center gap-2 rounded-lg bg-accent-500 px-3.5 text-[12.5px] font-semibold text-white hover:bg-accent-600" title="Lê os lançamentos de cada empresa (uma por vez) para achar meses sem movimento e lançamentos em contas sem De/Para">
              <RefreshCw size={14} />
              {analyzedCount ? "Analisar lançamentos de novo" : "Analisar lançamentos"}
            </button>
          )}
        </div>
        {analysis?.finished && (
          <p className="text-[12px] text-ink-500">
            Análise dos lançamentos concluída: {analysis.done} empresa{analysis.done === 1 ? "" : "s"}
            {analysis.errors ? ` (${analysis.errors} não carregaram — tente de novo)` : ""}. O resumo fica guardado neste navegador até os lançamentos mudarem.
          </p>
        )}
        {!analyzedCount && !analysis && <p className="text-[12px] text-ink-400">Balanço, De/Para e atualização já aparecem. Para conferir meses sem lançamento e lançamentos em contas sem De/Para, use "Analisar lançamentos".</p>}

        <section className="overflow-hidden rounded-xl bg-surface-card shadow-sm">
          <div className="hidden items-center gap-3 border-b border-line bg-surface-muted/60 px-4 py-1.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-400 md:grid md:grid-cols-[14px_minmax(0,1fr)_96px_110px_96px_120px_92px_16px]">
            <span />
            <span>Empresa</span>
            <span>Dados até</span>
            <span>Balanço</span>
            <span>De/Para</span>
            <span>Lançamentos</span>
            <span>Responsáveis</span>
            <span />
          </div>
          <div className="divide-y divide-line">
            {rows.length === 0 && <p className="py-12 text-center text-[13px] text-ink-400">{calculating ? "Calculando…" : "Nenhuma empresa com esse filtro."}</p>}
            {rows.map((company) => (
              <CompanyHealthRow
                key={company.id}
                company={company}
                health={healths[company.id]}
                names={names}
                expanded={expanded === company.id}
                onToggle={() => setExpanded((current) => (current === company.id ? null : company.id))}
                onAction={openAction}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
