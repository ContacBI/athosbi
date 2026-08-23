import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { listAccessGrants, grantAccess, revokeAccess, inviteUser } from "../../lib/access.js";
import PageHeader from "../../components/PageHeader.jsx";
import AccessModal from "../../components/AccessModal.jsx";

// Quem loga aqui e não está em portal_admins (ver supabase/schema.sql) só
// enxerga, em modo leitura, as empresas/grupos liberados abaixo — direto ou
// porque fazem parte de um grupo liberado. A aplicação de verdade é a RLS do
// banco; esta tela só é a UI pra criar/apagar linhas em access_grants.
export default function AcessosAdmin() {
  const state = useAppState();
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setGrants(await listAccessGrants());
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

  // Um envio do modal pode trazer várias empresas/grupos de uma vez pro
  // mesmo e-mail — cria uma concessão por item, e só UM convite no final
  // (não faz sentido mandar vários e-mails pra mesma pessoa de uma vez só).
  async function handleCreate({ email, items }) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await Promise.all(items.map((item) => grantAccess({ email, scopeType: item.scopeType, scopeId: item.scopeId })));
      try {
        const result = await inviteUser(email);
        setNotice(result?.alreadyExists ? "Acesso liberado — esse e-mail já tinha conta." : "Acesso liberado e convite enviado por e-mail.");
      } catch (inviteErr) {
        setNotice("Acesso liberado, mas não consegui enviar o e-mail de convite agora.");
        console.error("Falha ao convidar:", inviteErr);
      }
      setModalOpen(false);
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

  // Um cartão por e-mail, com todas as concessões dele juntas — fica mais
  // fácil de auditar "quem vê o quê" do que uma lista solta linha a linha.
  const byEmail = useMemo(() => {
    const map = new Map();
    grants.forEach((grant) => {
      if (!map.has(grant.email)) map.set(grant.email, []);
      map.get(grant.email).push(grant);
    });
    return Array.from(map.entries());
  }, [grants]);

  return (
    <div>
      <PageHeader
        eyebrow="Segurança"
        title="Acessos"
        description="Libere e-mails específicos para ver (somente leitura) determinadas empresas ou grupos. Quem ainda não tem conta recebe um convite por e-mail pra criar a senha."
        icon={ShieldCheck}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-900">
          {byEmail.length} pessoa{byEmail.length === 1 ? "" : "s"} com acesso liberado
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
        >
          + Novo acesso
        </button>
      </div>

      {error && <p className="mt-3 text-[12.5px] text-danger-600">{error}</p>}
      {notice && <p className="mt-3 text-[12.5px] text-accent-600">{notice}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {loading && <p className="text-[13px] text-ink-400">Carregando…</p>}
        {!loading && byEmail.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <ShieldCheck size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">Nenhum acesso liberado ainda</p>
            <p className="text-[12px] text-ink-400">Só você (admin) enxerga a carteira até liberar algum e-mail em "+ Novo acesso".</p>
          </div>
        )}
        {byEmail.map(([personEmail, personGrants]) => (
          <div key={personEmail} className="rounded-xl bg-surface-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-ink-900">{personEmail}</p>
              <button
                type="button"
                onClick={() => handleReinvite(personEmail)}
                className="shrink-0 text-[12px] text-accent-600 hover:underline"
              >
                Reenviar convite
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {personGrants.map((grant) => (
                <span
                  key={grant.id}
                  className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-page px-3 py-1 text-[12px] text-ink-700"
                >
                  {grant.scope_type === "company" ? "Empresa" : "Grupo"}: {grant.scope_type === "company" ? companyName(grant.scope_id) : groupName(grant.scope_id)}
                  <button
                    type="button"
                    onClick={() => handleRevoke(grant.id)}
                    aria-label="Remover acesso"
                    className="text-ink-400 hover:text-danger-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modalOpen && <AccessModal onClose={() => setModalOpen(false)} onSubmit={handleCreate} saving={saving} />}
    </div>
  );
}
