import { useState } from "react";
import { X, Building2, Network } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import Avatar from "./Avatar.jsx";

// Mesma linguagem visual do GroupModal (checkboxes numa lista rolável) —
// só que aqui a pessoa pode marcar empresas E grupos ao mesmo tempo, já
// que um convite normalmente cobre "essa pessoa vê tal carteira", não uma
// coisa só. onSubmit recebe { email, items: [{scopeType, scopeId}, ...] }
// — quem chama decide o que fazer com cada item (grantAccess de cada um +
// o convite por e-mail, ver AcessosAdmin.jsx).
export default function AccessModal({ onClose, onSubmit, saving }) {
  const state = useAppState();
  const [email, setEmail] = useState("");
  const [companyIds, setCompanyIds] = useState([]);
  const [groupIds, setGroupIds] = useState([]);
  const [error, setError] = useState("");

  function toggleCompany(id) {
    setCompanyIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }
  function toggleGroup(id) {
    setGroupIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Informe o e-mail da pessoa.");
      return;
    }
    if (companyIds.length === 0 && groupIds.length === 0) {
      setError("Marque pelo menos uma empresa ou grupo.");
      return;
    }
    setError("");
    const items = [
      ...companyIds.map((scopeId) => ({ scopeType: "company", scopeId })),
      ...groupIds.map((scopeId) => ({ scopeType: "group", scopeId })),
    ];
    onSubmit({ email: cleanEmail, items });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Acessos</span>
            <h2 className="mt-1 text-lg font-medium text-ink-900">Novo acesso</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-900"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mt-5 block text-[13px] text-ink-600">
          E-mail da pessoa *
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@email.com"
            autoFocus
            className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>
        <p className="mt-1.5 text-[11.5px] text-ink-400">
          Se ela ainda não tiver conta, chega um convite por e-mail pra criar a senha.
        </p>

        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[13px] text-ink-600">
            <Building2 size={14} strokeWidth={1.8} className="text-ink-400" />
            Empresas
          </p>
          {state.companies.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-ink-400">Nenhuma empresa cadastrada ainda.</p>
          ) : (
            <div className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-line-strong p-2">
              {state.companies.map((company) => (
                <label
                  key={company.id}
                  className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] text-ink-900 hover:bg-surface-muted"
                >
                  <input type="checkbox" checked={companyIds.includes(company.id)} onChange={() => toggleCompany(company.id)} />
                  <Avatar name={company.name} size={22} />
                  <span className="min-w-0 flex-1 truncate">{company.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {state.groups.length > 0 && (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-[13px] text-ink-600">
              <Network size={14} strokeWidth={1.8} className="text-ink-400" />
              Grupos
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">Libera automaticamente todas as empresas do grupo.</p>
            <div className="mt-1.5 flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-line-strong p-2">
              {state.groups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] text-ink-900 hover:bg-surface-muted"
                >
                  <input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => toggleGroup(group.id)} />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Liberando…" : "Liberar acesso e convidar"}
          </button>
        </div>
      </form>
    </div>
  );
}
