import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { listAccessGrants, grantAccess, revokeAccess } from "../../lib/access.js";
import PageHeader from "../../components/PageHeader.jsx";

// Quem loga aqui e não está em portal_admins (ver supabase/schema.sql) só
// enxerga, em modo leitura, as empresas/grupos liberados abaixo — direto ou
// porque fazem parte de um grupo liberado. A aplicação de verdade é a RLS do
// banco; esta tela só é a UI pra criar/apagar linhas em access_grants.
export default function AcessosAdmin() {
  const state = useAppState();
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [scopeType, setScopeType] = useState("company");
  const [scopeId, setScopeId] = useState("");

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

  const options = scopeType === "company" ? state.companies : state.groups;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !scopeId) return;
    setSaving(true);
    setError("");
    try {
      await grantAccess({ email, scopeType, scopeId });
      setScopeId("");
      await reload();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setSaving(false);
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
        description="Libere e-mails específicos para ver (somente leitura) determinadas empresas ou grupos. Quem não estiver aqui e não for admin não enxerga a carteira."
        icon={ShieldCheck}
      />

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-surface-card p-4 shadow-sm">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-500">E-mail da pessoa</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pessoa@email.com"
            className="rounded-md border border-line-strong bg-surface-page px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-accent-400"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-500">Tipo</span>
          <select
            value={scopeType}
            onChange={(event) => {
              setScopeType(event.target.value);
              setScopeId("");
            }}
            className="rounded-md border border-line-strong bg-surface-page px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-accent-400"
          >
            <option value="company">Empresa</option>
            <option value="group">Grupo</option>
          </select>
        </label>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-500">{scopeType === "company" ? "Empresa" : "Grupo"}</span>
          <select
            required
            value={scopeId}
            onChange={(event) => setScopeId(event.target.value)}
            className="rounded-md border border-line-strong bg-surface-page px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-accent-400"
          >
            <option value="" disabled>
              Selecione…
            </option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Liberando…" : "Liberar acesso"}
        </button>
      </form>

      {error && <p className="mt-3 text-[12.5px] text-danger-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-3">
        {loading && <p className="text-[13px] text-ink-400">Carregando…</p>}
        {!loading && byEmail.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <ShieldCheck size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">Nenhum acesso liberado ainda</p>
            <p className="text-[12px] text-ink-400">Só você (admin) enxerga a carteira até liberar algum e-mail acima.</p>
          </div>
        )}
        {byEmail.map(([personEmail, personGrants]) => (
          <div key={personEmail} className="rounded-xl bg-surface-card p-4 shadow-sm">
            <p className="text-[13px] font-medium text-ink-900">{personEmail}</p>
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
    </div>
  );
}
