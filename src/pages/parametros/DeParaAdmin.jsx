import { useEffect, useState } from "react";
import { ArrowLeft, Building2, CircleCheck, Repeat } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { selectCompany } from "../../lib/companies.js";
import { companiesResponsavel } from "../../lib/colaboradores.js";
import PageHeader from "../../components/PageHeader.jsx";
import Avatar from "../../components/Avatar.jsx";
import { RESET_SECTION_EVENT } from "../../components/ParametrosSidebar.jsx";
import Depara from "../Depara.jsx";

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
  // Admin escolhe de toda a carteira; colaborador Restrito só das empresas
  // onde ele é responsável — é a mesma trava que já existe pra entrar em
  // /empresa/de-para de dentro da empresa (ver CompanyLayout.jsx); essa
  // tela só tinha ficado de fora por engano, já que é um caminho separado
  // que reaproveita o mesmo editor sem passar por lá.
  const companyOptions = state.isAdmin ? state.companies : companiesResponsavel(state);

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

  function handleSelect(id) {
    if (id !== state.activeCompanyId) selectCompany(id);
    setSelectedId(id);
  }

  const selectedCompany = selectedId ? companyOptions.find((company) => company.id === selectedId) : null;

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

        <PageHeader eyebrow="De/Para" title={selectedCompany.name} description={selectedCompany.codigo ? `Código ${selectedCompany.codigo}` : undefined} icon={Repeat} />

        <Depara />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Parâmetros gerais"
        title="De/Para"
        description="Veja e edite o de/para de qualquer empresa da carteira direto por aqui, sem precisar entrar nela."
        icon={Repeat}
      />

      {companyOptions.length > 0 && (() => {
        const totalPending = companyOptions.reduce((sum, company) => sum + pendingCount(company), 0);
        return (
          <p className="mb-3 text-[13px] font-medium text-ink-900">
            {companyOptions.length} empresa{companyOptions.length === 1 ? "" : "s"}
            {" · "}
            {totalPending ? (
              <span className="font-medium text-warning-600">{totalPending} conta{totalPending === 1 ? "" : "s"} sem de/para na carteira</span>
            ) : (
              <span className="font-medium text-success-600">tudo vinculado na carteira</span>
            )}
          </p>
        );
      })()}

      <div className="flex flex-col gap-1.5">
        {companyOptions.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <Building2 size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">
              {state.isAdmin ? "Nenhuma empresa cadastrada ainda" : "Você não é responsável por nenhuma empresa ainda"}
            </p>
            <p className="text-[12px] text-ink-400">
              {state.isAdmin ? "Cadastre uma empresa em \"Empresas\" pra poder editar o de/para dela." : "Fale com o admin pra ser marcado como responsável nas empresas que você cuida."}
            </p>
          </div>
        )}
        {companyOptions.map((company) => {
          const pending = pendingCount(company);
          return (
            <button
              key={company.id}
              type="button"
              onClick={() => handleSelect(company.id)}
              className="flex items-center gap-2.5 rounded-lg bg-surface-card px-3 py-2 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <Avatar name={company.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink-900">{company.name}</p>
                {company.codigo && <p className="truncate text-[11px] text-ink-400">Código {company.codigo}</p>}
              </div>
              {pending ? (
                <span className="shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                  {pending} pendente{pending === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-600">
                  <CircleCheck size={11} strokeWidth={2} />
                  vinculado
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
