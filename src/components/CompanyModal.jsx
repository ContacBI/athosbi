import { useEffect, useState } from "react";
import { X, Loader2, Plus, IdCard, PenTool } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { formatCnpj, cnpjDigits, lookupCnpj } from "../lib/cnpj.js";
import { DEFAULT_NATURE_RULES, NATURE_LABELS, NATURE_ORDER, formatPrefixList, parsePrefixList } from "../lib/accountNature.js";
import { createPlanoPadrao } from "../lib/planosPadrao.js";
import { listAdmins, listColaboradores } from "../lib/colaboradores.js";
import SelectField from "./SelectField.jsx";

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
  const [tab, setTab] = useState("dados");
  const [natureText, setNatureText] = useState(() => {
    const rules = company?.natureRules || DEFAULT_NATURE_RULES;
    return Object.fromEntries(NATURE_ORDER.map((nature) => [nature, formatPrefixList(rules[nature])]));
  });
  // Empresa nova já vem com quem está criando pré-marcado — sem isso a
  // pessoa ficaria trancada pra fora da própria empresa que acabou de
  // cadastrar (RLS só deixa editar quem já está em `responsaveis`), mas
  // dá pra desmarcar e escolher outra gente antes de salvar.
  const [responsaveis, setResponsaveis] = useState(() => company?.responsaveis || [state.userEmail]);
  const [pessoas, setPessoas] = useState([]); // Total + Restrito, pra escolher responsável

  useEffect(() => {
    Promise.all([listAdmins(), listColaboradores()])
      .then(([admins, colaboradores]) => {
        setPessoas([
          ...admins.map((item) => ({ ...item, categoria: "Total" })),
          ...colaboradores.map((item) => ({ ...item, categoria: "Restrito" })),
        ]);
      })
      .catch((err) => console.error("Falha ao carregar colaboradores pro seletor de responsáveis:", err));
  }, []);

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

  function toggleResponsavel(email) {
    setResponsaveis((current) => (current.includes(email) ? current.filter((item) => item !== email) : current.concat(email)));
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
      setTab("dados");
      return;
    }
    // Só obrigatório pra empresa NOVA — as já existentes ainda não têm
    // plano padrão nenhum (ver lib/companies.js createCompany/updateCompany)
    // e isso não pode travar quem só quer editar outro campo delas.
    if (!isEditing && !planoPadraoId) {
      setError("Escolha um plano de contas pra essa empresa.");
      setTab("dados");
      return;
    }
    // Sem pelo menos um responsável, ninguém Restrito jamais conseguiria
    // editar essa empresa (ver is_responsavel em supabase/schema.sql) —
    // sempre obrigatório, criando ou editando. O campo em si mora também
    // em Parâmetros → Responsáveis (ResponsaveisAdmin.jsx), pra dar uma
    // visão geral da carteira inteira, mas editar aqui direto no cadastro
    // é mais rápido no dia a dia.
    if (!responsaveis.length) {
      setError("Marque pelo menos um responsável pela empresa.");
      setTab("dados");
      return;
    }
    const natureRules = Object.fromEntries(NATURE_ORDER.map((nature) => [nature, parsePrefixList(natureText[nature])]));
    onSubmit({ codigo, cnpj, name, atividade, municipio, uf, representanteIds, natureRules, planoPadraoId: planoPadraoId || null, responsaveis });
  }

  const socios = state.representantes.filter((representante) => representante.tipo !== "contador");
  const contadores = state.representantes.filter((representante) => representante.tipo === "contador");
  const planoOptions = state.planosPadrao.map((plano) => ({ value: plano.id, label: plano.nome }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface-card shadow-xl">
        <div className="flex items-start justify-between px-8 pt-7">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">
              {isEditing ? "Editar cadastro" : "Novo cadastro"}
            </span>
            <h2 className="mt-1 text-[22px] font-medium leading-tight text-ink-900">{isEditing ? name || "Editar empresa" : "Cadastrar empresa"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-900"
          >
            <X size={20} />
          </button>
        </div>

        {/* Duas abas em vez de tudo empilhado numa tela só: Dados gerais é
            o que qualquer colaborador cadastra rápido (código, CNPJ, plano
            de contas); Assinaturas é quem assina/responde tecnicamente pela
            empresa — contador e representante/sócio são papéis diferentes,
            por isso dois seletores separados em vez de um só misturando os
            dois (ver lib/representantes.js `tipo`). */}
        <div className="mt-5 flex gap-1 border-b border-line px-8">
          {[
            { id: "dados", label: "Dados gerais", icon: IdCard },
            { id: "assinaturas", label: "Assinaturas", icon: PenTool },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-[13px] font-medium transition-colors ${
                tab === item.id ? "border-accent-500 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-700"
              }`}
            >
              <item.icon size={14} strokeWidth={1.8} />
              {item.label}
            </button>
          ))}
        </div>

        {/* min-h fixo — sem isso o modal encolhia pela metade ao trocar
            pra Assinaturas (menos campos ali do que em Dados gerais), o
            que ficava estranho abrindo/fechando de tamanho a cada clique
            de aba. Com isso as duas abas ocupam a mesma altura sempre. */}
        <div className="min-h-[440px] flex-1 overflow-y-auto px-8 py-6">
        {tab === "dados" ? (
        <>
        <div className="grid grid-cols-3 gap-3">
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
          <label className="text-[13px] text-ink-600">
            Nome da empresa *
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Preenche a partir do CNPJ"
              className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
            />
          </label>
        </div>

        {lookupState === "done" && (
          <div className="mt-3 rounded-lg bg-surface-muted p-3 text-[12px] text-ink-600">
            <p className="font-medium text-ink-900">{atividade || "Atividade não informada"}</p>
            {(municipio || uf) && <p className="mt-0.5 text-ink-400">{[municipio, uf].filter(Boolean).join(" / ")}</p>}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-5">
          <div>
            <p className="text-[13px] text-ink-600">Plano de contas {!isEditing && "*"}</p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">
              Empresas no mesmo plano compartilham as contas extras dele e o De/Para se propaga entre elas.
            </p>
            <div className="mt-1.5">
              <SelectField
                placeholder="Selecione o plano de contas"
                options={planoOptions}
                value={planoPadraoId}
                onChange={setPlanoPadraoId}
                emptyText="Nenhum plano padrão criado ainda."
              />
            </div>
            {novoPlanoOpen ? (
              <div className="mt-1.5 flex items-center gap-1.5">
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
                className="mt-1.5 flex items-center gap-1.5 text-left text-[12.5px] font-medium text-accent-600 hover:text-accent-700"
              >
                <Plus size={13} strokeWidth={2.2} />
                Criar plano padrão
              </button>
            )}
          </div>

          <div>
            <p className="text-[13px] text-ink-600">Responsáveis *</p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">
              Só quem estiver marcado aqui (além de você) edita essa empresa — os demais só visualizam, como um cliente.
            </p>
            <div className="mt-1.5">
              <SelectField
                placeholder="Selecione os responsáveis"
                options={pessoas.map((pessoa) => ({ value: pessoa.email, label: pessoa.nome || pessoa.email }))}
                values={responsaveis}
                onToggle={toggleResponsavel}
                emptyText="Nenhum colaborador cadastrado ainda. Cadastre em Parâmetros → Colaborar."
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[13px] text-ink-600">Faixas de classificação do De/Para</p>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            Prefixos da classificação contábil pra cada natureza — separe vários por vírgula.
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2.5">
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
        </>
        ) : (
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-[13px] text-ink-600">Contador</p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">Responsável contábil da empresa.</p>
            <div className="mt-1.5">
              <SelectField
                placeholder="Selecione o(s) contador(es)"
                options={contadores.map((representante) => ({ value: representante.id, label: representante.nome, hint: representante.email }))}
                values={representanteIds.filter((id) => contadores.some((representante) => representante.id === id))}
                onToggle={toggleRepresentante}
                emptyText="Nenhum contador cadastrado ainda em Parâmetros → Representantes."
              />
            </div>
          </div>

          <div>
            <p className="text-[13px] text-ink-600">Representante (sócio)</p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">Sócio(s) da empresa.</p>
            <div className="mt-1.5">
              <SelectField
                placeholder="Selecione o(s) sócio(s)"
                options={socios.map((representante) => ({ value: representante.id, label: representante.nome, hint: representante.email }))}
                values={representanteIds.filter((id) => socios.some((representante) => representante.id === id))}
                onToggle={toggleRepresentante}
                emptyText="Nenhum sócio cadastrado ainda em Parâmetros → Representantes."
              />
            </div>
          </div>
        </div>
        )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-8 py-4">
          <p className="min-h-[1em] text-[12px] text-danger-600">{error}</p>
          <div className="flex shrink-0 gap-2">
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
        </div>
      </form>
    </div>
  );
}
