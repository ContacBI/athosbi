import { useState } from "react";
import { Users, Pencil, Trash2 } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { createRepresentante, updateRepresentante, deleteRepresentante, companiesForRepresentante } from "../../lib/representantes.js";
import RepresentanteModal from "../../components/RepresentanteModal.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Avatar from "../../components/Avatar.jsx";

export default function Representantes() {
  const state = useAppState();
  const [modalRepresentante, setModalRepresentante] = useState(undefined); // undefined = fechado, null = criar, objeto = editar

  function handleSubmit(fields) {
    if (modalRepresentante) updateRepresentante(modalRepresentante.id, fields);
    else createRepresentante(fields);
    setModalRepresentante(undefined);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pessoas"
        title="Representantes"
        description="Sócios e contadores que podem ser vinculados às empresas — útil quando o balanço ou os demonstrativos precisam sair assinados."
        icon={Users}
      />

      <button
        type="button"
        onClick={() => setModalRepresentante(null)}
        className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
      >
        + Novo representante
      </button>

      <div className="mt-4 flex flex-col gap-2">
        {state.representantes.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <Users size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">Nenhum representante cadastrado ainda</p>
            <p className="text-[12px] text-ink-400">Clique em "+ Novo representante" acima para começar.</p>
          </div>
        )}
        {state.representantes.map((representante) => {
          const empresas = companiesForRepresentante(representante.id);
          return (
            <div key={representante.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <Avatar name={representante.nome} size={36} />
                <div>
                  <p className="text-[13px] font-medium text-ink-900">{representante.nome}</p>
                  <p className="text-[12px] text-ink-400">
                    {[representante.email, representante.cpf].filter(Boolean).join(" · ") || "Sem email ou CPF informado"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {empresas.length > 0 ? `Vinculado a: ${empresas.map((company) => company.name).join(", ")}` : "Ainda não vinculado a nenhuma empresa"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setModalRepresentante(representante)}
                  aria-label={`Editar ${representante.nome}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-600 hover:bg-surface-muted"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remover ${representante.nome}?`)) deleteRepresentante(representante.id);
                  }}
                  aria-label={`Remover ${representante.nome}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-danger-600 hover:bg-danger-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalRepresentante !== undefined && (
        <RepresentanteModal representante={modalRepresentante} onClose={() => setModalRepresentante(undefined)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
