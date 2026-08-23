import { useEffect, useState } from "react";
import { ArrowLeft, Building2, TriangleAlert, UserCheck } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { updateCompany } from "../../lib/companies.js";
import { companiesResponsavel, listAdmins, listColaboradores } from "../../lib/colaboradores.js";
import PageHeader from "../../components/PageHeader.jsx";
import Avatar from "../../components/Avatar.jsx";
import SelectField from "../../components/SelectField.jsx";
import { RESET_SECTION_EVENT } from "../../components/ParametrosSidebar.jsx";

// Quem pode ser marcado responsável por uma empresa — antes escolhido
// dentro do próprio cadastro da empresa (CompanyModal.jsx), agora mora
// aqui, separado, porque "quem edita essa empresa no portal" é uma
// pergunta de outra natureza que Dados gerais/Assinaturas (contador,
// representante) — ver correção do usuário sobre isso.
export default function ResponsaveisAdmin() {
  const state = useAppState();
  const [selectedId, setSelectedId] = useState("");
  const [pessoas, setPessoas] = useState([]);
  const [notice, setNotice] = useState("");
  // Mesma trava de sempre: admin vê a carteira inteira, colaborador
  // Restrito só as empresas onde já é responsável — pra tirar/adicionar
  // responsável de uma empresa é preciso já responder por ela (ou ser
  // admin), senão qualquer um poderia se auto-nomear responsável de
  // qualquer empresa da carteira.
  const companyOptions = state.isAdmin ? state.companies : companiesResponsavel(state);

  useEffect(() => {
    Promise.all([listAdmins(), listColaboradores()])
      .then(([admins, colaboradores]) => {
        setPessoas([
          ...admins.map((item) => ({ ...item, categoria: "Total" })),
          ...colaboradores.map((item) => ({ ...item, categoria: "Restrito" })),
        ]);
      })
      .catch((err) => console.error("Falha ao carregar colaboradores:", err));
  }, []);

  useEffect(() => {
    function handleReset(event) {
      if (event.detail?.path === "/parametros/responsaveis") setSelectedId("");
    }
    window.addEventListener(RESET_SECTION_EVENT, handleReset);
    return () => window.removeEventListener(RESET_SECTION_EVENT, handleReset);
  }, []);

  const selectedCompany = selectedId ? companyOptions.find((company) => company.id === selectedId) : null;

  function persist(company, next) {
    // updateCompany substitui o registro inteiro — precisa mandar os
    // outros campos junto (do jeito que já estão), senão eles voltam pro
    // valor padrão (vazio) só por causa dessa troca de responsáveis.
    updateCompany(company.id, {
      name: company.name,
      cnpj: company.cnpj,
      codigo: company.codigo,
      atividade: company.atividade,
      municipio: company.municipio,
      uf: company.uf,
      representanteIds: company.representanteIds,
      natureRules: company.natureRules,
      planoPadraoId: company.planoPadraoId,
      responsaveis: next,
    });
    setNotice("Salvo.");
    setTimeout(() => setNotice(""), 2000);
  }

  function toggleResponsavel(company, email) {
    const current = company.responsaveis || [];
    const next = current.includes(email) ? current.filter((item) => item !== email) : current.concat(email);
    if (next.length === 0 && !confirm(`"${company.name}" vai ficar sem nenhum responsável — só admin vai conseguir editá-la depois disso. Continuar?`)) {
      return;
    }
    persist(company, next);
  }

  if (selectedCompany) {
    const responsaveis = selectedCompany.responsaveis || [];
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelectedId("")}
          className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={15} />
          Responsáveis
        </button>

        <PageHeader eyebrow="Responsáveis" title={selectedCompany.name} icon={UserCheck} />

        <div className="rounded-2xl bg-surface-card p-4 shadow-sm">
          <p className="text-[13px] text-ink-600">Quem pode editar esta empresa</p>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            Só quem estiver marcado aqui edita essa empresa — De/Para, dados, plano, tudo. Os demais colaboradores só visualizam, como um cliente. Admin sempre pode editar, marcado ou não.
          </p>
          <div className="mt-2">
            <SelectField
              placeholder="Selecione os responsáveis"
              options={pessoas.map((pessoa) => ({ value: pessoa.email, label: pessoa.nome || pessoa.email, hint: pessoa.categoria }))}
              values={responsaveis}
              onToggle={(email) => toggleResponsavel(selectedCompany, email)}
              emptyText="Nenhum colaborador cadastrado ainda. Cadastre em Parâmetros → Colaborar."
            />
          </div>
          {notice && <p className="mt-2 text-[12px] text-accent-600">{notice}</p>}
          {responsaveis.length === 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-warning-600">
              <TriangleAlert size={13} strokeWidth={2} />
              Sem responsável — só admin edita essa empresa agora.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Parâmetros gerais" title="Responsáveis" icon={UserCheck} />

      {companyOptions.length > 0 && (
        <p className="mb-3 text-[13px] font-medium text-ink-900">
          {companyOptions.length} empresa{companyOptions.length === 1 ? "" : "s"}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {companyOptions.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <Building2 size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">
              {state.isAdmin ? "Nenhuma empresa cadastrada ainda" : "Você não é responsável por nenhuma empresa ainda"}
            </p>
          </div>
        )}
        {companyOptions.map((company) => {
          const count = (company.responsaveis || []).length;
          return (
            <button
              key={company.id}
              type="button"
              onClick={() => setSelectedId(company.id)}
              className="flex items-center gap-2.5 rounded-lg bg-surface-card px-3 py-2 text-left shadow-sm transition-shadow hover:shadow-md"
            >
              <Avatar name={company.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink-900">{company.name}</p>
                {company.codigo && <p className="truncate text-[11px] text-ink-400">Código {company.codigo}</p>}
              </div>
              {count === 0 ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                  <TriangleAlert size={11} strokeWidth={2} />
                  sem responsável
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-600">
                  {count} responsável{count === 1 ? "" : "eis"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
