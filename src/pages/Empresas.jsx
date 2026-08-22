import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Settings, Building2, Network, Layers, TriangleAlert } from "lucide-react";
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

  const totalLancamentos = state.companies.reduce((sum, company) => sum + (company.journal || []).length, 0);

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
            <button
              type="button"
              onClick={() => navigate("/parametros")}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-white/80 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white"
            >
              <Settings size={15} />
              Cadastrar / editar empresas
            </button>
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

      <div className="mx-auto -mt-4 flex max-w-[1100px] flex-col gap-8 px-6">
        <section className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {state.companies.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-card px-6 py-16 text-center shadow-sm">
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
            const contas = (company.accounts || []).length;
            const lancamentos = (company.journal || []).length;
            return (
              <button
                type="button"
                key={company.id}
                onClick={() => handleAccess(company.id)}
                className={`group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border bg-surface-card p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
                  isActive ? "border-accent-500 ring-1 ring-accent-100" : "border-line hover:border-accent-400"
                }`}
              >
                <span
                  className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-accent-500 transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                  }`}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={company.name} size={40} />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[14px] font-medium leading-tight text-ink-900">
                        {company.codigo && <span className="mr-1.5 text-ink-400">{company.codigo}</span>}
                        {company.name}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-ink-400">{company.cnpj || "CNPJ não informado"}</p>
                    </div>
                  </div>
                  {isActive && <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-600">ativa</span>}
                </div>
                {company.atividade && <p className="line-clamp-1 text-[12px] text-ink-400">{company.atividade}</p>}
                <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
                  {company.journalLoadFailed ? (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-warning-600">
                      <TriangleAlert size={12} strokeWidth={2} />
                      não consegui carregar — recarregue a página
                    </p>
                  ) : (
                    <div className="flex items-center gap-2.5 text-[11px] text-ink-400">
                      <span>{contas.toLocaleString("pt-BR")} contas</span>
                      <span className="h-0.5 w-0.5 rounded-full bg-ink-300" />
                      <span>{lancamentos.toLocaleString("pt-BR")} lançamentos</span>
                    </div>
                  )}
                  <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-accent-600 transition-transform group-hover:translate-x-0.5">
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
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-50 text-accent-500">
                <Layers size={14} strokeWidth={2} />
              </span>
              <div>
                <span className="text-[11.5px] font-medium uppercase tracking-wide text-accent-600">Consolidado</span>
                <h2 className="text-[16px] font-medium leading-tight text-ink-900">Grupos</h2>
              </div>
            </div>
            <p className="mb-3 text-[13px] text-ink-400">Veja o relatório de várias empresas somado num só lugar.</p>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {state.groups.map((group) => {
                const members = groupCompanies(group);
                const isActive = group.id === state.activeGroupId;
                return (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() => handleAccessGroup(group.id)}
                    className={`group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border bg-gradient-to-br from-surface-card to-accent-50/40 p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${
                      isActive ? "border-accent-500 ring-1 ring-accent-100" : "border-line hover:border-accent-400"
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-accent-500 transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                      }`}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
                          <Network size={17} strokeWidth={1.9} />
                        </span>
                        <div>
                          <p className="text-[14px] font-medium leading-tight text-ink-900">{group.name}</p>
                          <p className="mt-0.5 text-[11.5px] text-ink-400">{members.length} empresas</p>
                        </div>
                      </div>
                      {isActive && <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-600">ativo</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {members.slice(0, 4).map((company) => (
                        <Avatar key={company.id} name={company.name} size={22} className="ring-2 ring-white -ml-1.5 first:ml-0" />
                      ))}
                      {members.length > 4 && (
                        <span className="ml-0.5 text-[11px] text-ink-400">+{members.length - 4}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-line/70 pt-2.5">
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
