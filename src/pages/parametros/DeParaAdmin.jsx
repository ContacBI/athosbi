import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CircleCheck, Lock, Repeat, Search } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { selectCompany } from "../../lib/companies.js";
import { listAdmins, listColaboradores } from "../../lib/colaboradores.js";
import PageHeader from "../../components/PageHeader.jsx";
import Avatar from "../../components/Avatar.jsx";
import { RESET_SECTION_EVENT } from "../../components/ParametrosSidebar.jsx";
import Depara from "../Depara.jsx";

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// `accounts` e `mappings` (diferente de `journal`) já vêm inteiros no
// registro leve de cada empresa (ver loadCompanies em lib/companies.js) —
// então dá pra contar pendências de TODAS as empresas aqui na lista, sem
// precisar entrar em cada uma pra saber. Mesma regra do Depara.jsx: só
// conta analítica (sintética não recebe vínculo).
function pendingCount(company) {
  const analytic = (company.accounts || []).filter((account) => account.tipo_sintetica === "nao");
  const linked = new Set((company.mappings || []).map((mapping) => mapping.classificacao));
  return analytic.filter((account) => !linked.has(account.classificacao)).length;
}

const SORTS = [
  { id: "nome", label: "Nome" },
  { id: "codigo", label: "Código" },
  { id: "pendencias", label: "Pendências" },
];

function sortCompanies(companies, sort) {
  const sorted = [...companies];
  if (sort === "codigo") {
    sorted.sort((a, b) => {
      const code = String(a.codigo || "").localeCompare(String(b.codigo || ""), "pt-BR", { numeric: true });
      return code || String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    });
  } else if (sort === "pendencias") {
    sorted.sort((a, b) => pendingCount(b) - pendingCount(a));
  } else {
    sorted.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
  }
  return sorted;
}

// Reuses the exact same editor as /empresa/de-para — it only ever reads and
// writes through the global store (no route params, no navigation of its
// own), so picking a company here and calling the same selectCompany()
// every other "enter this company" action in the app already uses is
// enough to make it work standalone, without a separate company-scoped
// data path just for this screen.
export default function DeParaAdmin() {
  const state = useAppState();
  // Deliberately does NOT default to whichever company happens to already
  // be active — landing on this screen should always show just the picker
  // first, even if a company was left active from browsing elsewhere.
  const [selectedId, setSelectedId] = useState("");
  const [pessoasByEmail, setPessoasByEmail] = useState({}); // email -> nome, pra "Solicite acesso a:"
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("nome");

  // Todo mundo vê a carteira inteira aqui (já era assim em quase toda tela
  // de Parâmetros) — só quem NÃO é responsável não consegue clicar pra
  // abrir o de/para daquela empresa, ver `canOpen` abaixo. Antes essa tela
  // escondia de vez as empresas onde a pessoa não era responsável; ficou
  // mais claro mostrar todas com quem procurar em vez de simplesmente
  // sumir com elas.
  const allCompanies = state.companies;

  const companyOptions = useMemo(() => {
    const term = norm(search);
    const filtered = term ? allCompanies.filter((company) => norm(`${company.name} ${company.codigo || ""}`).includes(term)) : allCompanies;
    return sortCompanies(filtered, sort);
  }, [allCompanies, search, sort]);

  useEffect(() => {
    Promise.all([listAdmins(), listColaboradores()])
      .then(([admins, colaboradores]) => {
        const map = {};
        [...admins, ...colaboradores].forEach((pessoa) => { map[pessoa.email] = pessoa.nome || pessoa.email; });
        setPessoasByEmail(map);
      })
      .catch((err) => console.error("Falha ao carregar colaboradores:", err));
  }, []);

  // Clicar de novo em "De/Para" na barra lateral enquanto já se está dentro
  // de uma empresa volta pro picker, sem precisar do botão de voltar (que
  // essa tela nem tem — o picker some assim que uma empresa é escolhida).
  useEffect(() => {
    function handleReset(event) {
      if (event.detail?.path === "/parametros/de-para") setSelectedId("");
    }
    window.addEventListener(RESET_SECTION_EVENT, handleReset);
    return () => window.removeEventListener(RESET_SECTION_EVENT, handleReset);
  }, []);

  function canOpen(company) {
    return state.isAdmin || (company.responsaveis || []).includes(state.userEmail);
  }

  function handleSelect(id) {
    if (id !== state.activeCompanyId) selectCompany(id);
    setSelectedId(id);
  }

  const selectedCompany = selectedId ? allCompanies.find((company) => company.id === selectedId) : null;

  // Mesmo padrão de Planos padrão: lista cheia primeiro, e ao escolher um
  // item a lista some de vez, dando lugar à tela de detalhe com um "<
  // Voltar" no topo (além do próprio clique de novo em "De/Para" na barra
  // lateral, que faz a mesma coisa — ver o listener acima).
  if (selectedCompany) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedId("")}
          className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={15} />
          De/Para
        </button>

        <PageHeader eyebrow="De/Para" title={selectedCompany.name} icon={Repeat} />

        <Depara />
      </div>
    );
  }

  // Só conta pendência do que a pessoa consegue de fato abrir e corrigir
  // — somar a carteira inteira (inclusive empresas trancadas pra ela) só
  // deixava o número maior sem servir pra nada prático. Admin continua
  // vendo a carteira toda de qualquer forma (canOpen sempre true).
  const editableCompanies = allCompanies.filter(canOpen);
  const totalPending = editableCompanies.reduce((sum, company) => sum + pendingCount(company), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Parâmetros gerais"
        title="De/Para"
        description="Veja e edite o de/para de qualquer empresa da carteira direto por aqui, sem precisar entrar nela."
        icon={Repeat}
      />

      {allCompanies.length > 0 && (
        <p className="mb-3 text-[13px] font-medium text-ink-900">
          {allCompanies.length} empresa{allCompanies.length === 1 ? "" : "s"}
          {editableCompanies.length > 0 && (
            <>
              {" · "}
              {totalPending ? (
                <span className="font-medium text-warning-600">
                  {totalPending} conta{totalPending === 1 ? "" : "s"} sem de/para {state.isAdmin ? "na carteira" : "nas suas"}
                </span>
              ) : (
                <span className="font-medium text-success-600">tudo vinculado {state.isAdmin ? "na carteira" : "nas suas"}</span>
              )}
            </>
          )}
        </p>
      )}

      {allCompanies.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou código..."
              className="w-full rounded-md border border-line-strong bg-surface-card py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-accent-400"
            />
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-full bg-surface-muted p-1">
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSort(option.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  sort === option.id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {allCompanies.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <Building2 size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">Nenhuma empresa cadastrada ainda</p>
            {state.isAdmin && <p className="text-[12px] text-ink-400">Cadastre uma empresa em "Empresas" pra poder editar o de/para dela.</p>}
          </div>
        )}
        {allCompanies.length > 0 && companyOptions.length === 0 && (
          <p className="py-8 text-center text-[13px] text-ink-400">Nenhuma empresa bate com essa busca.</p>
        )}
        {companyOptions.map((company) => {
          const pending = pendingCount(company);
          const editable = canOpen(company);
          const responsavelNames = (company.responsaveis || []).map((email) => pessoasByEmail[email] || email);
          const Row = editable ? "button" : "div";
          return (
            <Row
              key={company.id}
              type={editable ? "button" : undefined}
              onClick={editable ? () => handleSelect(company.id) : undefined}
              className={`flex items-center gap-2.5 rounded-lg bg-surface-card px-3 py-2 shadow-sm transition-shadow ${
                editable ? "text-left hover:shadow-md" : "cursor-default opacity-70"
              }`}
            >
              <Avatar name={company.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink-900">{company.name}</p>
                {editable ? (
                  company.codigo && <p className="truncate text-[11px] text-ink-400">Código {company.codigo}</p>
                ) : (
                  <p className="truncate text-[11px] text-ink-400">
                    {responsavelNames.length ? `Solicite acesso a: ${responsavelNames.join(", ")}` : "Sem responsável definido"}
                  </p>
                )}
              </div>
              {!editable ? (
                <Lock size={13} strokeWidth={1.8} className="shrink-0 text-ink-300" />
              ) : pending ? (
                <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                  {pending} pendente{pending === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-600">
                  <CircleCheck size={11} strokeWidth={2} />
                  vinculado
                </span>
              )}
            </Row>
          );
        })}
      </div>
    </div>
  );
}
