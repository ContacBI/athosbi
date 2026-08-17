import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Settings, Building2, Network } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { selectCompany } from "../lib/companies.js";
import { selectGroup, groupCompanies } from "../lib/groups.js";
import Avatar from "../components/Avatar.jsx";

export default function Empresas() {
  const state = useAppState();
  const navigate = useNavigate();

  function handleAccess(id) {
    selectCompany(id);
    navigate("/empresa");
  }

  function handleAccessGroup(id) {
    selectGroup(id);
    navigate("/empresa");
  }

  return (
    <div className="min-h-screen bg-surface-page px-6 py-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900"
        >
          <ArrowLeft size={15} />
          Início
        </button>
        <button
          type="button"
          onClick={() => navigate("/parametros")}
          className="flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900"
        >
          <Settings size={15} />
          Cadastrar / editar empresas
        </button>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1000px] flex-col gap-6">
        <section>
          <span className="text-[12px] font-medium uppercase tracking-wide text-accent-600">Carteira</span>
          <h1 className="mt-1 text-[28px] font-medium leading-tight text-ink-900">Escolha uma empresa</h1>
          <p className="mt-1.5 text-[14px] text-ink-400">Selecione um cliente para acessar os relatórios dele.</p>
        </section>

        <section className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {state.companies.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                <Building2 size={26} strokeWidth={1.6} />
              </span>
              <p className="text-[15px] font-medium text-ink-900">Nenhuma empresa cadastrada</p>
              <p className="max-w-xs text-[13px] text-ink-400">
                Vá em Parâmetros para cadastrar a primeira empresa da sua carteira.
              </p>
              <button
                type="button"
                onClick={() => navigate("/parametros")}
                className="mt-1 rounded-full bg-accent-500 px-5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
              >
                Cadastrar / editar empresas
              </button>
            </div>
          )}
          {state.companies.map((company) => {
            const isActive = company.id === state.activeCompanyId && !state.activeGroupId;
            return (
              <button
                type="button"
                key={company.id}
                onClick={() => handleAccess(company.id)}
                className={`group flex flex-col gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  isActive ? "border-accent-500 ring-1 ring-accent-100" : "border-line hover:border-accent-400"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={company.name} size={38} />
                    <div>
                      <p className="text-[14px] font-medium leading-tight text-ink-900">
                        {company.codigo && <span className="mr-1.5 text-ink-400">{company.codigo}</span>}
                        {company.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-400">{company.cnpj || "CNPJ não informado"}</p>
                    </div>
                  </div>
                  {isActive && <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-600">ativa</span>}
                </div>
                {company.atividade && <p className="line-clamp-1 text-[12px] text-ink-400">{company.atividade}</p>}
                <div className="flex items-center justify-between border-t border-line pt-2.5">
                  <p className="text-[11px] text-ink-400">
                    {(company.accounts || []).length} contas · {(company.journal || []).length} lançamentos
                  </p>
                  <span className="flex items-center gap-1 text-[12px] font-medium text-accent-600 transition-transform group-hover:translate-x-0.5">
                    Acessar
                    <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            );
          })}
        </section>

        {state.groups.length > 0 && (
          <section>
            <span className="text-[12px] font-medium uppercase tracking-wide text-accent-600">Consolidado</span>
            <h2 className="mt-1 text-[18px] font-medium leading-tight text-ink-900">Grupos</h2>
            <p className="mt-1 text-[13px] text-ink-400">Veja o relatório de várias empresas somado num só lugar.</p>

            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
              {state.groups.map((group) => {
                const members = groupCompanies(group);
                const isActive = group.id === state.activeGroupId;
                return (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => handleAccessGroup(group.id)}
                    className={`group flex flex-col gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                      isActive ? "border-accent-500 ring-1 ring-accent-100" : "border-line hover:border-accent-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
                          <Network size={17} strokeWidth={1.9} />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium leading-tight text-ink-900">{group.name}</p>
                          <p className="mt-0.5 text-[12px] text-ink-400">{members.length} empresas</p>
                        </div>
                      </div>
                      {isActive && <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-600">ativo</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {members.slice(0, 4).map((company) => (
                        <Avatar key={company.id} name={company.name} size={22} className="ring-2 ring-white -ml-1.5 first:ml-0" />
                      ))}
                      {members.length > 4 && (
                        <span className="ml-0.5 text-[11px] text-ink-400">+{members.length - 4}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-2.5">
                      <p className="text-[11px] text-ink-400">
                        {members.reduce((sum, company) => sum + (company.journal || []).length, 0).toLocaleString("pt-BR")} lançamentos
                      </p>
                      <span className="flex items-center gap-1 text-[12px] font-medium text-accent-600 transition-transform group-hover:translate-x-0.5">
                        Acessar
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
