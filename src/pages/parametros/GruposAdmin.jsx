import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Network, Pencil, Trash2, Building2, ArrowRight, Layers } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { createGroup, updateGroup, deleteGroup, groupCompanies } from "../../lib/groups.js";
import GroupModal from "../../components/GroupModal.jsx";
import Avatar from "../../components/Avatar.jsx";
import PageHeader from "../../components/PageHeader.jsx";

export default function GruposAdmin() {
  const state = useAppState();
  const navigate = useNavigate();
  const [modalGroup, setModalGroup] = useState(undefined); // undefined = fechado, null = criar, objeto = editar

  function handleSubmit(fields) {
    if (modalGroup) updateGroup(modalGroup.id, fields);
    else createGroup(fields);
    setModalGroup(undefined);
  }

  const totalGroupedCompanies = new Set(state.groups.flatMap((group) => group.companyIds || [])).size;

  return (
    <div>
      <PageHeader
        eyebrow="Carteira"
        title="Grupos"
        description="Junte empresas do mesmo grupo econômico pra ver os relatórios consolidados, somando os CNPJs de uma vez."
        icon={Network}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-5 max-lg:grid-cols-1">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-ink-900">
              {state.groups.length} grupo{state.groups.length === 1 ? "" : "s"} criado{state.groups.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={() => setModalGroup(null)}
              disabled={state.companies.length < 2}
              className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
            >
              + Novo grupo
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {state.companies.length < 2 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                  <Building2 size={22} strokeWidth={1.6} />
                </span>
                <p className="text-[13px] font-medium text-ink-900">Cadastre pelo menos 2 empresas primeiro</p>
                <p className="text-[12px] text-ink-400">Um grupo só faz sentido juntando duas ou mais empresas da carteira.</p>
                <button
                  type="button"
                  onClick={() => navigate("/parametros/empresas")}
                  className="mt-1 rounded-full bg-accent-500 px-4 py-1.5 text-[12.5px] font-medium text-white shadow-sm hover:bg-accent-600"
                >
                  Ir pra Empresas
                </button>
              </div>
            )}

            {state.companies.length >= 2 && state.groups.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                  <Network size={22} strokeWidth={1.6} />
                </span>
                <p className="text-[13px] font-medium text-ink-900">Nenhum grupo criado ainda</p>
                <p className="text-[12px] text-ink-400">Clique em "+ Novo grupo" acima para começar.</p>
              </div>
            )}

            {state.groups.map((group) => {
              const members = groupCompanies(group);
              const totalLancamentos = members.reduce((sum, company) => sum + (company.journal || []).length, 0);
              const isActive = group.id === state.activeGroupId;
              return (
                <div
                  key={group.id}
                  className={`rounded-xl bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md ${isActive ? "ring-1 ring-accent-300" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                        <Network size={17} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                          <span className="truncate">{group.name}</span>
                          {isActive && (
                            <span className="shrink-0 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-600">
                              ativo
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] text-ink-400">
                          {members.length} empresa{members.length === 1 ? "" : "s"} · {totalLancamentos.toLocaleString("pt-BR")} lançamentos
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setModalGroup(group)}
                        aria-label={`Editar ${group.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-600 hover:bg-surface-muted"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover o grupo "${group.name}"? As empresas continuam na carteira.`)) deleteGroup(group.id);
                        }}
                        aria-label={`Remover ${group.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-danger-600 hover:bg-danger-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {members.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                      {members.map((company) => (
                        <span
                          key={company.id}
                          className="flex items-center gap-1.5 rounded-full bg-surface-muted py-1 pl-1 pr-2.5 text-[11.5px] text-ink-700"
                        >
                          <Avatar name={company.name} size={18} />
                          {company.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-white p-3.5 shadow-sm">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Visão geral</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-ink-500">
                  <Network size={14} strokeWidth={1.8} className="text-accent-500" />
                  Grupos
                </span>
                <span className="font-medium text-ink-900">{state.groups.length}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-ink-500">
                  <Layers size={14} strokeWidth={1.8} className="text-accent-500" />
                  Empresas agrupadas
                </span>
                <span className="font-medium text-ink-900">{totalGroupedCompanies}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-3.5 shadow-sm">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Como funciona</p>
            <p className="text-[12.5px] leading-relaxed text-ink-500">
              O relatório consolidado soma os lançamentos de todas as empresas do grupo pela conta gerencial — cada
              uma continua com seu próprio De/Para. Pra acessar, vá em "Empresas" e escolha o grupo em vez de uma
              empresa.
            </p>
            <button
              type="button"
              onClick={() => navigate("/empresas")}
              className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-accent-600 hover:text-accent-700"
            >
              Ir escolher
              <ArrowRight size={12} />
            </button>
          </div>

          <div className="rounded-xl bg-white p-3.5 shadow-sm">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Atalhos</p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => navigate("/parametros/empresas")}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2">
                  <Building2 size={14} strokeWidth={1.8} className="text-ink-400" />
                  Empresas
                </span>
                <ArrowRight size={12} className="text-ink-300" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalGroup !== undefined && (
        <GroupModal group={modalGroup} onClose={() => setModalGroup(undefined)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
