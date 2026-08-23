import { useState } from "react";
import { X, Loader2, Plus } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { formatCnpj, cnpjDigits, lookupCnpj } from "../lib/cnpj.js";
import { DEFAULT_NATURE_RULES, NATURE_LABELS, NATURE_ORDER, formatPrefixList, parsePrefixList } from "../lib/accountNature.js";
import { createPlanoPadrao } from "../lib/planosPadrao.js";

export default function CompanyModal({ onClose, onSubmit, company = null }) {
  const state = useAppState();
  const isEditing = Boolean(company);
  const [codigo, setCodigo] = useState(company?.codigo || "");
  const [cnpj, setCnpj] = useState(company?.cnpj || "");
  const [name, setName] = useState(company?.name || "");
  const [atividade, setAtividade] = useState(company?.atividade || "");
  const [municipio, setMunicipio] = useState(company?.municipio || "");
  const [uf, setUf] = useState(company?.uf || "");
  const [representanteIds, setRepresentanteIds] = useState(company?.representanteIds || []);
  const [planoPadraoId, setPlanoPadraoId] = useState(company?.planoPadraoId || "");
  const [novoPlanoOpen, setNovoPlanoOpen] = useState(false);
  const [novoPlanoNome, setNovoPlanoNome] = useState("");
  const [lookupState, setLookupState] = useState(company?.atividade ? "done" : "idle");
  const [error, setError] = useState("");
  const [natureText, setNatureText] = useState(() => {
    const rules = company?.natureRules || DEFAULT_NATURE_RULES;
    return Object.fromEntries(NATURE_ORDER.map((nature) => [nature, formatPrefixList(rules[nature])]));
  });

  async function handleCnpjChange(event) {
    const formatted = formatCnpj(event.target.value);
    setCnpj(formatted);
    setError("");
    if (cnpjDigits(formatted).length !== 14) {
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    try {
      const data = await lookupCnpj(formatted);
      setName(data.name);
      setAtividade(data.atividade);
      setMunicipio(data.municipio);
      setUf(data.uf);
      setLookupState("done");
    } catch {
      setLookupState("error");
      setError("Não encontrei esse CNPJ. Preencha o nome manualmente.");
    }
  }

  function toggleRepresentante(id) {
    setRepresentanteIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }

  function handleCreatePlano() {
    const created = createPlanoPadrao(novoPlanoNome);
    if (!created) return;
    setPlanoPadraoId(created.id);
    setNovoPlanoNome("");
    setNovoPlanoOpen(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }
    // Só obrigatório pra empresa NOVA — as já existentes ainda não têm
    // plano padrão nenhum (ver lib/companies.js createCompany/updateCompany)
    // e isso não pode travar quem só quer editar outro campo delas.
    if (!isEditing && !planoPadraoId) {
      setError("Escolha um plano de contas pra essa empresa.");
      return;
    }
    const natureRules = Object.fromEntries(NATURE_ORDER.map((nature) => [nature, parsePrefixList(natureText[nature])]));
    onSubmit({ codigo, cnpj, name, atividade, municipio, uf, representanteIds, natureRules, planoPadraoId: planoPadraoId || null });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">
              {isEditing ? "Editar cadastro" : "Novo cadastro"}
            </span>
            <h2 className="mt-1 text-lg font-medium text-ink-900">{isEditing ? "Editar empresa" : "Cadastrar empresa"}</h2>
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

        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="text-[13px] text-ink-600">
            Código
            <input
              value={codigo}
              onChange={(event) => setCodigo(event.target.value)}
              placeholder="Ex.: 001"
              className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
            />
          </label>
          <label className="text-[13px] text-ink-600">
            CNPJ
            <div className="relative">
              <input
                value={cnpj}
                onChange={handleCnpjChange}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
                className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
              />
              {lookupState === "loading" && (
                <Loader2 size={14} className="absolute right-2.5 top-[15px] animate-spin text-accent-500" />
              )}
            </div>
          </label>
        </div>

        <label className="mt-3 block text-[13px] text-ink-600">
          Nome da empresa *
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Preenche sozinho a partir do CNPJ"
            className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        {lookupState === "done" && (
          <div className="mt-3 rounded-lg bg-surface-muted p-3 text-[12px] text-ink-600">
            <p className="font-medium text-ink-900">{atividade || "Atividade não informada"}</p>
            {(municipio || uf) && <p className="mt-0.5 text-ink-400">{[municipio, uf].filter(Boolean).join(" / ")}</p>}
          </div>
        )}

        <div className="mt-4">
          <p className="text-[13px] text-ink-600">Representantes vinculados</p>
          {state.representantes.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-ink-400">
              Nenhum representante cadastrado ainda. Cadastre em Parâmetros → Representantes.
            </p>
          ) : (
            <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border border-line-strong p-2">
              {state.representantes.map((representante) => (
                <label key={representante.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-ink-900 hover:bg-surface-muted">
                  <input
                    type="checkbox"
                    checked={representanteIds.includes(representante.id)}
                    onChange={() => toggleRepresentante(representante.id)}
                  />
                  {representante.nome}
                  <span className="text-[11px] text-ink-400">{representante.email}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="text-[13px] text-ink-600">
            Plano de contas {!isEditing && "*"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            Empresas no mesmo plano padrão compartilham as contas extras dele e o De/Para se propaga automaticamente
            entre elas.
          </p>
          <div className="mt-1.5 flex max-h-40 flex-col gap-0.5 overflow-y-auto rounded-lg border border-line-strong p-2">
            {state.planosPadrao.length === 0 && !novoPlanoOpen && (
              <p className="px-1.5 py-1 text-[12px] text-ink-400">Nenhum plano padrão criado ainda.</p>
            )}
            {state.planosPadrao.map((plano) => (
              <label key={plano.id} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[13px] text-ink-900 hover:bg-surface-muted">
                <input
                  type="radio"
                  name="planoPadraoId"
                  checked={planoPadraoId === plano.id}
                  onChange={() => setPlanoPadraoId(plano.id)}
                />
                {plano.nome}
              </label>
            ))}
            {novoPlanoOpen ? (
              <div className="mt-1 flex items-center gap-1.5 border-t border-line pt-1.5">
                <input
                  autoFocus
                  value={novoPlanoNome}
                  onChange={(event) => setNovoPlanoNome(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreatePlano();
                    }
                  }}
                  placeholder="Nome do plano padrão"
                  className="flex-1 rounded-md border border-line-strong px-2 py-1.5 text-[12.5px] outline-none focus:border-accent-500"
                />
                <button type="button" onClick={handleCreatePlano} className="rounded-md bg-accent-500 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-accent-600">
                  Criar
                </button>
                <button type="button" onClick={() => setNovoPlanoOpen(false)} className="rounded-md px-2 py-1.5 text-[12px] text-ink-500 hover:bg-surface-muted">
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNovoPlanoOpen(true)}
                className="mt-1 flex items-center gap-1.5 rounded-md border-t border-line px-1.5 pt-2 text-left text-[12.5px] font-medium text-accent-600 hover:text-accent-700"
              >
                <Plus size={13} strokeWidth={2.2} />
                Criar plano padrão
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[13px] text-ink-600">Faixas de classificação do De/Para</p>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            Prefixos da classificação contábil desta empresa pra cada natureza — o De/Para só deixa vincular uma
            conta a uma linha gerencial da mesma natureza. Separe vários prefixos por vírgula.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {NATURE_ORDER.map((nature) => (
              <label key={nature} className="text-[12.5px] text-ink-600">
                {NATURE_LABELS[nature]}
                <input
                  value={natureText[nature]}
                  onChange={(event) => setNatureText((prev) => ({ ...prev, [nature]: event.target.value }))}
                  placeholder={formatPrefixList(DEFAULT_NATURE_RULES[nature])}
                  className="mt-1 w-full rounded-md border border-line-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-accent-500"
                />
              </label>
            ))}
          </div>
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
            {isEditing ? "Salvar alterações" : "Cadastrar empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}
