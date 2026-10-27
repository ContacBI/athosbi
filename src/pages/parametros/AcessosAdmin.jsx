import { useEffect, useMemo, useState } from "react";
import { Mail, Pencil, Phone, Search, ShieldCheck, Trash2, UserX } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { listAccessGrants, grantAccess, revokeAccess, inviteUser, listAccessPeople, saveAccessPerson, deleteAccessPerson } from "../../lib/access.js";
import { hasAnyResponsibility } from "../../lib/colaboradores.js";
import PageHeader from "../../components/PageHeader.jsx";
import AccessModal from "../../components/AccessModal.jsx";
import Avatar from "../../components/Avatar.jsx";
import Carregando from "../../components/Carregando.jsx";

// Quem loga aqui e não está em portal_admins (ver supabase/schema.sql) só
// enxerga, em modo leitura, as empresas/grupos liberados abaixo — direto ou
// porque fazem parte de um grupo liberado. A aplicação de verdade é a RLS do
// banco; esta tela cria/apaga linhas em access_grants e mantém a ficha de
// cada pessoa (nome, telefone, observação) em acesso_pessoas.

const norm = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function AcessosAdmin() {
  const state = useAppState();
  const [grants, setGrants] = useState([]);
  const [people, setPeople] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  // null = fechado; { person: null } = novo; { person: {...} } = editando.
  const [editor, setEditor] = useState(null);
  const [busca, setBusca] = useState("");
  // Acessos (empresa/grupo de cliente externo) segue a mesma regra de
  // Planos padrão/Representantes: quem é responsável por ALGUMA empresa já
  // pode mexer aqui — a RLS (access_grants_colaborador_scoped) que de fato
  // só deixa criar/revogar nas empresas/grupos onde a pessoa é responsável.
  const canEdit = state.isAdmin || (state.isColaborador && hasAnyResponsibility(state));

  async function reload() {
    setLoading(true);
    setError("");
    try {
      // A ficha (nome) é complemento: se não carregar, a lista de acessos
      // continua aparecendo, só sem os nomes.
      const [lista, fichas] = await Promise.all([listAccessGrants(), listAccessPeople().catch(() => new Map())]);
      setGrants(lista);
      setPeople(fichas);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const companyName = (id) => state.companies.find((company) => company.id === id)?.name || "(empresa removida)";
  const groupName = (id) => state.groups.find((group) => group.id === id)?.name || "(grupo removido)";

  // Um cartão por e-mail, com todas as concessões dele juntas e a ficha da
  // pessoa — por nome (quem não tem nome vai pro fim, pelo e-mail).
  const pessoas = useMemo(() => {
    const map = new Map();
    grants.forEach((grant) => {
      if (!map.has(grant.email)) map.set(grant.email, []);
      map.get(grant.email).push(grant);
    });
    const lista = Array.from(map.entries()).map(([email, personGrants]) => ({ email, grants: personGrants, ficha: people.get(email) || null }));
    return lista.sort((a, b) => {
      const na = a.ficha?.nome || "";
      const nb = b.ficha?.nome || "";
      if (na && !nb) return -1;
      if (!na && nb) return 1;
      return (na || a.email).localeCompare(nb || b.email, "pt-BR");
    });
  }, [grants, people]);

  const termo = norm(busca.trim());
  const visiveis = termo
    ? pessoas.filter(({ email, grants: personGrants, ficha }) =>
        norm(
          [email, ficha?.nome, ficha?.telefone, ficha?.observacao, ...personGrants.map((grant) => (grant.scope_type === "company" ? companyName(grant.scope_id) : groupName(grant.scope_id)))].join(" ")
        ).includes(termo)
      )
    : pessoas;

  function abrirEdicao(pessoa) {
    setEditor({
      person: {
        email: pessoa.email,
        nome: pessoa.ficha?.nome || "",
        telefone: pessoa.ficha?.telefone || "",
        observacao: pessoa.ficha?.observacao || "",
        companyIds: pessoa.grants.filter((grant) => grant.scope_type === "company").map((grant) => grant.scope_id),
        groupIds: pessoa.grants.filter((grant) => grant.scope_type === "group").map((grant) => grant.scope_id),
      },
    });
  }

  // Criar ou editar: grava a ficha, cria as concessões novas, tira as que
  // foram desmarcadas (só editando) e, se pedido, manda o convite — um só,
  // mesmo com várias empresas/grupos.
  async function handleSave({ email, nome, telefone, observacao, companyIds, groupIds, convidar }) {
    setSaving(true);
    setError("");
    setNotice("");
    const atuais = grants.filter((grant) => grant.email === email);
    const querido = [...companyIds.map((scopeId) => ({ scopeType: "company", scopeId })), ...groupIds.map((scopeId) => ({ scopeType: "group", scopeId }))];
    const temAgora = (item) => atuais.some((grant) => grant.scope_type === item.scopeType && grant.scope_id === item.scopeId);
    const novos = querido.filter((item) => !temAgora(item));
    const tirar = editor?.person ? atuais.filter((grant) => !querido.some((item) => item.scopeType === grant.scope_type && item.scopeId === grant.scope_id)) : [];
    const avisos = [];
    try {
      await Promise.all(novos.map((item) => grantAccess({ email, scopeType: item.scopeType, scopeId: item.scopeId })));
      await Promise.all(tirar.map((grant) => revokeAccess(grant.id)));
      try {
        await saveAccessPerson({ email, nome, telefone, observacao });
      } catch (fichaErr) {
        console.error("Falha ao salvar a ficha da pessoa:", fichaErr);
        avisos.push("o nome/contato não foi salvo agora (tente editar de novo)");
      }
      if (convidar) {
        try {
          const result = await inviteUser(email);
          avisos.unshift(result?.alreadyExists ? "esse e-mail já tinha conta" : "convite enviado por e-mail");
        } catch (inviteErr) {
          console.error("Falha ao convidar:", inviteErr);
          avisos.push("não consegui enviar o e-mail de convite agora");
        }
      }
      setNotice(`${editor?.person ? "Acesso atualizado" : "Acesso liberado"}${avisos.length ? ` — ${avisos.join("; ")}` : ""}.`);
      setEditor(null);
      await reload();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReinvite(personEmail) {
    setError("");
    setNotice("");
    try {
      const result = await inviteUser(personEmail);
      setNotice(result?.alreadyExists ? `${personEmail} já tem conta — não precisa de convite novo.` : `Convite reenviado pra ${personEmail}.`);
    } catch (err) {
      setError(String(err?.message || err));
    }
  }

  async function handleRevoke(id) {
    if (!confirm("Remover esse acesso? A pessoa deixa de enxergar essa empresa/grupo imediatamente.")) return;
    try {
      await revokeAccess(id);
      await reload();
    } catch (err) {
      setError(String(err?.message || err));
    }
  }

  // Excluir a pessoa = tirar TODOS os acessos dela de uma vez (e a ficha,
  // quando quem exclui é o admin). A conta de login continua existindo, mas
  // sem enxergar empresa nenhuma.
  async function handleDeletePerson(pessoa) {
    const quem = pessoa.ficha?.nome ? `${pessoa.ficha.nome} (${pessoa.email})` : pessoa.email;
    const n = pessoa.grants.length;
    if (!confirm(`Excluir ${quem}?\n\nA pessoa perde na hora o acesso ${n === 1 ? "à empresa/grupo liberado" : `às ${n} empresas/grupos liberados`}. O login dela continua existindo, mas sem enxergar nada.`)) return;
    setError("");
    setNotice("");
    try {
      await Promise.all(pessoa.grants.map((grant) => revokeAccess(grant.id)));
      if (state.isAdmin) await deleteAccessPerson(pessoa.email).catch((err) => console.warn("Ficha não apagada:", err?.message || err));
      setNotice(`${quem} excluído(a) dos acessos.`);
      await reload();
    } catch (err) {
      setError(String(err?.message || err));
      await reload();
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Segurança"
        title="Acessos"
        description="Libere pessoas de fora (clientes) para ver, somente leitura, determinadas empresas ou grupos. Quem ainda não tem conta recebe um convite por e-mail pra criar a senha."
        icon={ShieldCheck}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-900">
          {pessoas.length} pessoa{pessoas.length === 1 ? "" : "s"} com acesso liberado
        </p>
        <div className="flex flex-1 items-center justify-end gap-2">
          {pessoas.length > 3 && (
            <label className="relative flex w-full max-w-[280px] items-center">
              <Search size={14} className="pointer-events-none absolute left-2.5 text-ink-300" />
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar nome, e-mail ou empresa" className="acessos-busca h-9 w-full rounded-md border border-line bg-surface-card pl-8 pr-3 text-[13px] outline-none focus:border-accent-400" />
            </label>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditor({ person: null })}
              className="acessos-novo shrink-0 rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
            >
              + Novo acesso
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-[12.5px] text-danger-600">{error}</p>}
      {notice && <p className="mt-3 text-[12.5px] text-accent-600">{notice}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {loading && <Carregando compacto />}
        {!loading && pessoas.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <ShieldCheck size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">Nenhum acesso liberado ainda</p>
            <p className="text-[12px] text-ink-400">Só você (admin) enxerga a carteira até liberar alguém em "+ Novo acesso".</p>
          </div>
        )}
        {!loading && pessoas.length > 0 && visiveis.length === 0 && <p className="py-6 text-center text-[13px] text-ink-400">Ninguém encontrado para "{busca}".</p>}
        {visiveis.map((pessoa) => (
          <div key={pessoa.email} className="acessos-pessoa rounded-xl bg-surface-card px-4 py-3 shadow-sm ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={pessoa.ficha?.nome || pessoa.email} size={36} />
                <div className="min-w-0">
                  {pessoa.ficha?.nome ? (
                    <p className="truncate text-[14px] font-semibold text-ink-900">{pessoa.ficha.nome}</p>
                  ) : (
                    <p className="text-[13px] italic text-ink-400">
                      Sem nome
                      {canEdit && (
                        <button type="button" onClick={() => abrirEdicao(pessoa)} className="ml-2 not-italic text-accent-600 hover:underline">
                          adicionar
                        </button>
                      )}
                    </p>
                  )}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-500">
                    <span className="flex items-center gap-1">
                      <Mail size={12} className="text-ink-300" />
                      {pessoa.email}
                    </span>
                    {pessoa.ficha?.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} className="text-ink-300" />
                        {pessoa.ficha.telefone}
                      </span>
                    )}
                  </p>
                  {pessoa.ficha?.observacao && <p className="mt-0.5 text-[12px] text-ink-400">{pessoa.ficha.observacao}</p>}
                </div>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => handleReinvite(pessoa.email)} className="rounded-md px-2 py-1 text-[11.5px] text-accent-600 hover:bg-accent-50">
                    Reenviar convite
                  </button>
                  <button type="button" onClick={() => abrirEdicao(pessoa)} title="Editar" className="acessos-editar flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-surface-muted hover:text-ink-900">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => handleDeletePerson(pessoa)} title="Excluir pessoa (tira todos os acessos)" className="acessos-excluir flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600">
                    <UserX size={15} />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {pessoa.grants.map((grant) => (
                <span
                  key={grant.id}
                  className="flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-page px-2.5 py-0.5 text-[11.5px] text-ink-700"
                >
                  {grant.scope_type === "company" ? "Empresa" : "Grupo"}: {grant.scope_type === "company" ? companyName(grant.scope_id) : groupName(grant.scope_id)}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(grant.id)}
                      aria-label="Remover acesso"
                      className="text-ink-400 hover:text-danger-600"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editor && <AccessModal person={editor.person} onClose={() => setEditor(null)} onSubmit={handleSave} saving={saving} />}
    </div>
  );
}
