import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Users, Trash2, ShieldCheck, Shield } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { listAdmins, addAdmin, removeAdmin, listColaboradores, addColaborador, removeColaborador } from "../../lib/colaboradores.js";
import { inviteUser } from "../../lib/access.js";
import PageHeader from "../../components/PageHeader.jsx";

// Admin-only mesmo pra colaborador Restrito — essa é uma das 3 telas
// (Sistema, Colaborar, B.I.) que só o Total vê, ver ParametrosLayout.jsx.
//
// Duas categorias, ver supabase/schema.sql:
//   Total    — portal_admins. Acesso e edição de tudo, sem crivo nenhum,
//              independente de estar marcado responsável em alguma
//              empresa ou não.
//   Restrito — colaboradores. Enxerga a carteira inteira, mas só edita
//              as empresas onde está marcado em "Responsáveis" (ver
//              CompanyModal.jsx) — nas demais, é só leitura.
function PeopleSection({ title, description, icon: Icon, people, onAdd, onRemove, onInvited, categoryLabel }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function handleAdd(event) {
    event.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onAdd({ nome, email });
      try {
        const result = await inviteUser(email);
        setNotice(result?.alreadyExists ? `${email} já tinha conta — acesso liberado.` : `Convite enviado pra ${email}.`);
      } catch (inviteErr) {
        setNotice(`Cadastrado, mas não consegui enviar o convite agora.`);
        console.error("Falha ao convidar:", inviteErr);
      }
      setNome("");
      setEmail("");
      onInvited();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(personEmail) {
    if (!confirm(`Remover ${personEmail} de ${title}?`)) return;
    try {
      await onRemove(personEmail);
      onInvited();
    } catch (err) {
      setError(String(err?.message || err));
    }
  }

  async function handleReinvite(personEmail) {
    setError("");
    setNotice("");
    try {
      const result = await inviteUser(personEmail);
      setNotice(result?.alreadyExists ? `${personEmail} já tem conta.` : `Convite reenviado pra ${personEmail}.`);
    } catch (err) {
      setError(String(err?.message || err));
    }
  }

  return (
    <div className="rounded-2xl bg-surface-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={16} strokeWidth={1.8} className="text-accent-500" />
        <p className="text-[13px] font-medium text-ink-900">{title}</p>
      </div>
      <p className="mt-0.5 text-[11.5px] text-ink-400">{description}</p>

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1">
          <span className="text-[11.5px] text-ink-500">Nome</span>
          <input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Nome da pessoa"
            className="rounded-md border border-line-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-accent-500"
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[11.5px] text-ink-500">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@email.com"
            className="rounded-md border border-line-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-accent-500"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent-500 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Adicionando…" : "Adicionar e convidar"}
        </button>
      </form>

      {error && <p className="mt-2 text-[12px] text-danger-600">{error}</p>}
      {notice && <p className="mt-2 text-[12px] text-accent-600">{notice}</p>}

      <div className="mt-3 flex flex-col gap-1.5">
        {people.length === 0 && <p className="text-[12px] text-ink-400">Ninguém cadastrado ainda.</p>}
        {people.map((person) => (
          <div key={person.email} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] text-ink-800">{person.nome || person.email}</p>
              {person.nome && <p className="truncate text-[11px] text-ink-400">{person.email}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => handleReinvite(person.email)} className="rounded-md px-2 py-1 text-[11px] text-accent-600 hover:underline">
                Reenviar convite
              </button>
              <button
                type="button"
                onClick={() => handleRemove(person.email)}
                aria-label={`Remover ${person.email}`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ColaborarAdmin() {
  const state = useAppState();
  const [admins, setAdmins] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const [adminList, colaboradorList] = await Promise.all([listAdmins(), listColaboradores()]);
      setAdmins(adminList);
      setColaboradores(colaboradorList);
    } catch (err) {
      console.error("Falha ao carregar colaboradores:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  // Admin-only mesmo pra colaborador Restrito, que entra no resto de
  // Parâmetros — ver ParametrosLayout.jsx.
  if (!state.isAdmin) return <Navigate to="/parametros/empresas" replace />;

  return (
    <div>
      <PageHeader
        eyebrow="Segurança"
        title="Colaborar"
        description="Cadastre quem da equipe pode acessar o portal. Total tem acesso e edição de tudo; Restrito enxerga a carteira inteira, mas só edita as empresas onde está marcado como responsável."
        icon={Users}
      />

      {loading ? (
        <p className="text-[13px] text-ink-400">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <PeopleSection
            title="Total"
            description="Acesso e edição de tudo — inclusive Sistema, Colaborar e B.I. — sem restrição nenhuma."
            icon={ShieldCheck}
            people={admins}
            onAdd={addAdmin}
            onRemove={removeAdmin}
            onInvited={reload}
          />
          <PeopleSection
            title="Restrito"
            description="Enxerga toda a carteira e a maioria das telas de Parâmetros, mas só edita as empresas onde está marcado como responsável (ver campo 'Responsáveis pela empresa' no cadastro). Nunca vê Sistema, Colaborar ou B.I."
            icon={Shield}
            people={colaboradores}
            onAdd={addColaborador}
            onRemove={removeColaborador}
            onInvited={reload}
          />
        </div>
      )}
    </div>
  );
}
