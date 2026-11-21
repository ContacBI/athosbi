import { useState } from "react";
import { X, Building2, Network, LayoutGrid, Lock } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { companiesResponsavel, groupsResponsavel } from "../lib/colaboradores.js";
import SelectField from "./SelectField.jsx";
import { MODULOS_COMPLEMENTARES } from "../lib/modulos.js";
import { MODELOS_TIPO, tipoAtual, tiposDoAlvo } from "../lib/tiposDeAcesso.js";

// Cadastro de uma pessoa de fora (cliente) em Acessos: a ficha (nome,
// e-mail, telefone, observação) e o que ela enxerga — empresas E grupos ao
// mesmo tempo, já que um convite normalmente cobre "essa pessoa vê tal
// carteira". Serve pra criar (`person` vazio) e pra editar (`person` com o
// que já existe — o e-mail não muda, é a identidade da pessoa). onSubmit
// recebe { email, nome, telefone, observacao, modulos, companyIds,
// groupIds, tipos, convidar } — quem chama decide o que criar/revogar (ver
// AcessosAdmin.jsx). `modulos`: quais módulos além do B.I. a pessoa vê
// (Orçamento, Carga tributária…); nenhum = só o B.I., sem menu lateral.

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const campo = "mt-1 w-full rounded-md border border-line-strong bg-surface-card px-3 py-2 text-sm text-ink-900 outline-none focus:border-accent-500";

export default function AccessModal({ person = null, onClose, onSubmit, saving }) {
  const state = useAppState();
  const editando = Boolean(person);
  const [nome, setNome] = useState(person?.nome || "");
  const [email, setEmail] = useState(person?.email || "");
  const [telefone, setTelefone] = useState(person?.telefone || "");
  const [observacao, setObservacao] = useState(person?.observacao || "");
  const [companyIds, setCompanyIds] = useState(person?.companyIds || []);
  const [groupIds, setGroupIds] = useState(person?.groupIds || []);
  const [modulos, setModulos] = useState(person?.modulos || []);
  // Tipo de acesso (Financeiro, Comercial…) em cada empresa/grupo escolhido: { "company:ID" | "group:ID": tipoId } — "" = padrão. Começa pelo que a pessoa já tem.
  const [tipos, setTipos] = useState(() => {
    const inicial = {};
    if (person?.email) {
      (person.companyIds || []).forEach((id) => { inicial[`company:${id}`] = tipoAtual(state.companies.find((c) => c.id === id), false, person.email, state.groups); });
      (person.groupIds || []).forEach((id) => { inicial[`group:${id}`] = tipoAtual(state.groups.find((g) => g.id === id), true, person.email, state.groups); });
    }
    return inicial;
  });
  // Pessoa nova recebe o convite; editando, só se pedir (ex.: perdeu o e-mail).
  const [convidar, setConvidar] = useState(!editando);
  const [error, setError] = useState("");

  // Admin escolhe de toda a carteira; colaborador Restrito só das
  // empresas/grupos onde ele mesmo é responsável — é só isso que a RLS
  // (access_grants_colaborador_scoped) deixaria criar mesmo, então nem
  // oferece o resto pra não dar erro confuso na hora de salvar.
  const companyOptions = state.isAdmin ? state.companies : companiesResponsavel(state);
  const groupOptions = state.isAdmin ? state.groups : groupsResponsavel(state);

  function toggleCompany(id) {
    setCompanyIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }
  function toggleModulo(id) {
    setModulos((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }
  function toggleGroup(id) {
    setGroupIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_VALIDO.test(cleanEmail)) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (companyIds.length === 0 && groupIds.length === 0) {
      setError(editando ? "Deixe pelo menos uma empresa ou grupo — pra tirar tudo, use Excluir na lista." : "Marque pelo menos uma empresa ou grupo.");
      return;
    }
    setError("");
    onSubmit({ email: cleanEmail, nome: nome.trim(), telefone: telefone.trim(), observacao: observacao.trim(), modulos, companyIds, groupIds, tipos, convidar });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Acessos</span>
            <h2 className="mt-1 text-lg font-medium text-ink-900">{editando ? "Editar acesso" : "Novo acesso"}</h2>
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

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Pessoa</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-[13px] text-ink-600 sm:col-span-2">
            Nome
            <input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome e sobrenome" autoFocus={!editando} maxLength={120} className={`acesso-nome ${campo}`} />
          </label>
          <label className="block text-[13px] text-ink-600">
            E-mail *
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="pessoa@email.com"
              readOnly={editando}
              title={editando ? "O e-mail é o login da pessoa — pra trocar, exclua e cadastre de novo." : undefined}
              className={`acesso-email ${campo} ${editando ? "cursor-not-allowed bg-surface-muted text-ink-500" : ""}`}
            />
          </label>
          <label className="block text-[13px] text-ink-600">
            Telefone / WhatsApp
            <input value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="(11) 99999-9999" maxLength={40} className={`acesso-telefone ${campo}`} />
          </label>
          <label className="block text-[13px] text-ink-600 sm:col-span-2">
            Observação
            <input value={observacao} onChange={(event) => setObservacao(event.target.value)} placeholder="Ex.: financeiro da empresa, sócia, contador interno…" maxLength={300} className={`acesso-observacao ${campo}`} />
          </label>
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">O que a pessoa enxerga (somente leitura)</p>
        <div className="mt-2">
          <p className="flex items-center gap-1.5 text-[13px] text-ink-600">
            <Building2 size={14} strokeWidth={1.8} className="text-ink-400" />
            Empresas
          </p>
          {companyOptions.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-ink-400">
              {state.isAdmin ? "Nenhuma empresa cadastrada ainda." : "Você não é responsável por nenhuma empresa ainda."}
            </p>
          ) : (
            <div className="mt-1.5">
              <SelectField
                placeholder="Selecione as empresas"
                options={companyOptions.map((company) => ({ value: company.id, label: company.name }))}
                values={companyIds}
                onToggle={toggleCompany}
              />
            </div>
          )}
        </div>

        {groupOptions.length > 0 && (
          <div className="mt-4">
            <p className="flex items-center gap-1.5 text-[13px] text-ink-600">
              <Network size={14} strokeWidth={1.8} className="text-ink-400" />
              Grupos
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">Libera automaticamente todas as empresas do grupo.</p>
            <div className="mt-1.5">
              <SelectField
                placeholder="Selecione os grupos"
                options={groupOptions.map((group) => ({ value: group.id, label: group.name }))}
                values={groupIds}
                onToggle={toggleGroup}
              />
            </div>
          </div>
        )}

        {(companyIds.length > 0 || groupIds.length > 0) && (
          <>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Tipo de acesso em cada empresa/grupo</p>
            <p className="mt-0.5 text-[11.5px] text-ink-400">O que a pessoa vê é definido dentro de cada empresa ou grupo (Acesso dos clientes). Aqui você só escolhe o tipo dela em cada uma: “Padrão” ou, por exemplo, Financeiro, Comercial e Marketing. Escolher um modelo que a empresa ainda não tem cria o tipo já pré-preenchido.</p>
            <div className="mt-2 divide-y divide-line rounded-md border border-line">
              {[...companyIds.map((id) => ({ chave: `company:${id}`, item: state.companies.find((c) => c.id === id), ehGrupo: false })), ...groupIds.map((id) => ({ chave: `group:${id}`, item: state.groups.find((g) => g.id === id), ehGrupo: true }))]
                .filter((linha) => linha.item)
                .map(({ chave, item, ehGrupo }) => {
                  const criados = tiposDoAlvo(item, ehGrupo, state.groups);
                  const faltam = MODELOS_TIPO.filter((m) => !criados.some((t) => t.id === m.id));
                  return (
                    <div key={chave} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[12.5px] text-ink-700">
                        {ehGrupo ? <Network size={13} className="shrink-0 text-ink-400" /> : <Building2 size={13} className="shrink-0 text-ink-400" />}
                        <span className="truncate">{item.name}</span>
                      </span>
                      <select value={tipos[chave] || ""} onChange={(event) => setTipos((atual) => ({ ...atual, [chave]: event.target.value }))} aria-label={`Tipo de acesso em ${item.name}`} className="rounded-md border border-line-strong bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-accent-500">
                        <option value="">Padrão</option>
                        {criados.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        {tipos[chave] && !criados.some((t) => t.id === tipos[chave]) && !faltam.some((m) => m.id === tipos[chave]) && <option value={tipos[chave]}>{tipos[chave]}</option>}
                        {faltam.length > 0 && (
                          <optgroup label="Criar e usar">
                            {faltam.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        <details className="mt-4 rounded-md border border-line px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-medium text-ink-500">Módulos da ficha da pessoa (só valem onde a empresa/grupo ainda não tem configuração própria)</summary>
          <p className="mt-1.5 text-[11.5px] text-ink-400">Sem nenhum extra marcado, ela fica só no B.I. e o menu lateral de módulos não aparece.</p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <span className="flex items-center gap-2 rounded-md border border-line bg-surface-muted px-3 py-2 text-[12.5px] text-ink-500" title="O B.I. Contábil é sempre liberado">
              <LayoutGrid size={14} strokeWidth={1.8} className="text-ink-400" />
              B.I Contábil
              <Lock size={11} className="ml-auto text-ink-300" />
            </span>
            {MODULOS_COMPLEMENTARES.map((modulo) => (
              <label key={modulo.id} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[12.5px] transition-colors ${modulos.includes(modulo.id) ? "border-accent-400 bg-accent-50 text-accent-700" : "border-line-strong text-ink-700 hover:bg-surface-muted"}`}>
                <input type="checkbox" checked={modulos.includes(modulo.id)} onChange={() => toggleModulo(modulo.id)} className={`acesso-modulo-${modulo.id} accent-[var(--color-accent-500)]`} />
                {modulo.nome}
              </label>
            ))}
          </div>
        </details>

        <label className="mt-4 flex items-start gap-2 text-[12.5px] text-ink-600">
          <input type="checkbox" checked={convidar} onChange={(event) => setConvidar(event.target.checked)} className="acesso-convidar mt-0.5 accent-[var(--color-accent-500)]" />
          <span>
            Enviar convite por e-mail
            <span className="block text-[11.5px] text-ink-400">Quem ainda não tem conta recebe o link pra criar a senha. Quem já tem não recebe nada de novo.</span>
          </span>
        </label>

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
            className="acesso-salvar rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando…" : editando ? "Salvar alterações" : convidar ? "Liberar acesso e convidar" : "Liberar acesso"}
          </button>
        </div>
      </form>
    </div>
  );
}
