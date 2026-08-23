import { useState } from "react";
import { X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import SelectField from "./SelectField.jsx";

export default function GroupModal({ onClose, onSubmit, group = null }) {
  const state = useAppState();
  const isEditing = Boolean(group);
  const [name, setName] = useState(group?.name || "");
  const [companyIds, setCompanyIds] = useState(group?.companyIds || []);
  const [error, setError] = useState("");

  function toggleCompany(id) {
    setCompanyIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Dê um nome pro grupo.");
      return;
    }
    if (companyIds.length < 2) {
      setError("Escolha pelo menos 2 empresas — com 1 só não tem o que consolidar.");
      return;
    }
    // Empresas de planos padrão diferentes podem ter o MESMO código
    // gerencial significando coisas diferentes (ou o De/Para de uma
    // acabar propagando pra outra sem fazer sentido, ver
    // applySiblingMappings em lib/companies.js) — exigir o mesmo plano
    // evita esse tipo de conflito silencioso no consolidado.
    const selectedCompanies = companyIds.map((id) => state.companies.find((company) => company.id === id)).filter(Boolean);
    const semPlano = selectedCompanies.find((company) => !company.planoPadraoId);
    if (semPlano) {
      setError(`"${semPlano.name}" ainda não tem um Plano padrão definido — edite o cadastro dela em Empresas primeiro.`);
      return;
    }
    const planos = new Set(selectedCompanies.map((company) => company.planoPadraoId));
    if (planos.size > 1) {
      setError("Todas as empresas do grupo precisam usar o mesmo Plano padrão.");
      return;
    }
    onSubmit({ name, companyIds });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">
              {isEditing ? "Editar grupo" : "Novo grupo"}
            </span>
            <h2 className="mt-1 text-lg font-medium text-ink-900">{isEditing ? "Editar grupo" : "Criar grupo"}</h2>
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
          Nome do grupo *
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Holding ABC"
            autoFocus
            className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        <div className="mt-4">
          <p className="text-[13px] text-ink-600">Empresas do grupo</p>
          {state.companies.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-ink-400">Nenhuma empresa cadastrada ainda.</p>
          ) : (
            <div className="mt-1.5">
              <SelectField
                placeholder="Selecione as empresas do grupo"
                options={state.companies.map((company) => ({ value: company.id, label: company.name, hint: company.cnpj }))}
                values={companyIds}
                onToggle={toggleCompany}
              />
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted"
          >
            Cancelar
          </button>
          <button type="submit" className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
            {isEditing ? "Salvar alterações" : "Criar grupo"}
          </button>
        </div>
      </form>
    </div>
  );
}
