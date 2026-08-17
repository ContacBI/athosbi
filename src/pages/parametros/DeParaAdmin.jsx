import { useState } from "react";
import { Building2, Repeat } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { selectCompany } from "../../lib/companies.js";
import PageHeader from "../../components/PageHeader.jsx";
import Avatar from "../../components/Avatar.jsx";
import Depara from "../Depara.jsx";

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

  function handleSelect(id) {
    if (id !== state.activeCompanyId) selectCompany(id);
    setSelectedId(id);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Parâmetros gerais"
        title="De/Para"
        description="Veja e edite o de/para de qualquer empresa da carteira direto por aqui, sem precisar entrar nela."
        icon={Repeat}
      />

      {state.companies.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
            <Building2 size={22} strokeWidth={1.6} />
          </span>
          <p className="text-[13px] font-medium text-ink-900">Nenhuma empresa cadastrada ainda</p>
          <p className="text-[12px] text-ink-400">Cadastre uma empresa em "Empresas" pra poder editar o de/para dela.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {state.companies.map((company) => {
              const active = selectedId === company.id;
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleSelect(company.id)}
                  className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] transition-colors ${
                    active ? "border-accent-500 bg-accent-50 font-medium text-accent-700" : "border-line-strong bg-surface-card text-ink-700 hover:border-accent-400"
                  }`}
                >
                  <Avatar name={company.name} size={24} />
                  {company.codigo && <span className="text-ink-400">{company.codigo}</span>}
                  {company.name}
                </button>
              );
            })}
          </div>

          {selectedId ? (
            <Depara />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                <Repeat size={22} strokeWidth={1.6} />
              </span>
              <p className="text-[13px] font-medium text-ink-900">Escolha uma empresa acima</p>
              <p className="text-[12px] text-ink-400">O de/para dela aparece aqui, editável na hora.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
