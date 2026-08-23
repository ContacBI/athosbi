import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Layers, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import {
  createPlanoPadrao,
  deletePlanoPadrao,
  companiesUsingPlano,
  effectivePlano,
  previewNewExtraAccount,
  addExtraAccount,
  removeExtraAccount,
  hasExtraChildren,
} from "../../lib/planosPadrao.js";
import PageHeader from "../../components/PageHeader.jsx";

function buildTree(rows) {
  const byCode = new Map(rows.map((row) => [row.codigo_gerencial, { ...row, children: [] }]));
  const roots = [];
  byCode.forEach((node) => {
    const parts = node.codigo_gerencial.split(".");
    const parentCode = parts.slice(0, -1).join(".");
    const parent = parts.length > 1 ? byCode.get(parentCode) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

// Nome novo pra tela nova: "adicionada" (badge do Plano gerencial) fica
// "extra deste plano" aqui — deixa claro que essa conta só existe pra quem
// usa ESTE plano padrão, não é uma conta nova no plano gerencial global.
function TreeNode({ node, depth, expanded, toggle, onAddChild, onDeleteExtra }) {
  const isOpen = expanded.has(node.codigo_gerencial);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div className="group flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-[13px] transition-colors hover:bg-surface-muted">
        <button
          type="button"
          onClick={() => hasChildren && toggle(node.codigo_gerencial)}
          style={{ paddingLeft: 12 + depth * 18 }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center text-ink-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>
            {hasChildren && <ChevronRight size={13} />}
          </span>
          <span className="w-[110px] shrink-0 font-mono text-[11px] text-ink-400">{node.codigo_gerencial}</span>
          <span className={`flex-1 truncate ${node.natureza === "Sintetica" ? "font-medium text-ink-900" : "text-ink-600"}`}>{node.nome}</span>
          {node.extra && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] text-accent-600">
              <Sparkles size={10} strokeWidth={2} />
              extra deste plano
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onAddChild(node)}
            title="Adicionar conta extra aqui dentro"
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-accent-50 hover:text-accent-600"
          >
            <Plus size={13} strokeWidth={2} />
          </button>
          {node.extra && (
            <button
              type="button"
              onClick={() => onDeleteExtra(node)}
              title="Excluir esta conta extra"
              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      {hasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.codigo_gerencial} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} onAddChild={onAddChild} onDeleteExtra={onDeleteExtra} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewPlanoModal({ onClose, onCreated }) {
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  function handleSubmit(event) {
    event.preventDefault();
    const created = createPlanoPadrao(nome);
    if (!created) {
      setError("Dê um nome pro plano.");
      return;
    }
    onCreated(created);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Novo plano padrão</p>
            <h2 className="mt-0.5 text-[16px] font-medium text-ink-900">Como chamar?</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
            <X size={16} />
          </button>
        </div>
        <input
          autoFocus
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          placeholder="Ex.: Plano padrão - Grupo Concent"
          className="mt-4 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
        />
        {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
            Cancelar
          </button>
          <button type="submit" className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
            Criar
          </button>
        </div>
      </form>
    </div>
  );
}

function AddExtraAccountModal({ planoPadraoId, parent, onClose, onCreated }) {
  const [nome, setNome] = useState("");
  const [natureza, setNatureza] = useState("Analitica");
  const [error, setError] = useState("");
  const preview = useMemo(() => previewNewExtraAccount(planoPadraoId, parent.codigo_gerencial, natureza), [planoPadraoId, parent.codigo_gerencial, natureza]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!nome.trim()) {
      setError("Dê um nome pra conta.");
      return;
    }
    const row = addExtraAccount(planoPadraoId, { parentCode: parent.codigo_gerencial, nome, natureza });
    if (!row) {
      setError("Não consegui criar essa conta.");
      return;
    }
    onCreated(row);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Conta extra</p>
            <h2 className="mt-0.5 text-[16px] font-medium text-ink-900">Dentro de "{parent.nome}"</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
            <X size={16} />
          </button>
        </div>

        <label className="mt-4 block text-[13px] text-ink-600">
          Nome da conta
          <input
            autoFocus
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Ex.: Adiantamento a fornecedores diversos"
            className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        <div className="mt-4 text-[13px] text-ink-600">
          Tipo
          <div className="mt-1 flex rounded-md border border-line-strong p-0.5">
            {[
              { value: "Analitica", label: "Analítica", hint: "Uma conta-folha — essa que aceita De/Para" },
              { value: "Sintetica", label: "Sintética", hint: "Uma subcategoria nova, pode ter contas dentro dela" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setNatureza(option.value)}
                title={option.hint}
                className={`flex-1 rounded px-3 py-1.5 text-[12.5px] transition-colors ${
                  natureza === option.value ? "bg-accent-500 text-white" : "text-ink-600 hover:bg-surface-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {preview && (
          <div className="mt-4 rounded-lg bg-surface-muted p-3 text-[12px] text-ink-500">
            <p>
              Código: <span className="font-mono text-ink-800">{preview.codigo_gerencial}</span> · Nível {preview.nivel} · {preview.demonstrativo} · {preview.grupo_macro}
            </p>
            <p className="mt-1">Fica disponível só pra quem usa este plano padrão — não entra no Plano gerencial global.</p>
          </div>
        )}

        {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
            Cancelar
          </button>
          <button type="submit" className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
            Criar conta extra
          </button>
        </div>
      </form>
    </div>
  );
}

function PlanoEditor({ plano, onBack }) {
  const state = useAppState();
  const [tab, setTab] = useState("DRE");
  const [expanded, setExpanded] = useState(() => new Set());
  const [addingUnder, setAddingUnder] = useState(null);
  const companies = companiesUsingPlano(plano.id);

  const effective = useMemo(() => {
    const base = effectivePlano(plano.id);
    const extraCodes = new Set(plano.extraAccounts.map((row) => row.codigo_gerencial));
    return base.map((row) => (extraCodes.has(row.codigo_gerencial) ? { ...row, extra: true } : row));
  }, [plano]);
  const demonstrativos = useMemo(() => [...new Set(effective.map((row) => row.demonstrativo))].sort(), [effective]);
  const rows = useMemo(() => effective.filter((row) => row.demonstrativo === tab), [effective, tab]);
  const tree = useMemo(() => buildTree(rows), [rows]);

  function toggle(code) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleCreated(row) {
    setExpanded((current) => new Set(current).add(row.codigo_gerencial.split(".").slice(0, -1).join(".")));
    setAddingUnder(null);
  }

  function handleDeleteExtra(node) {
    if (hasExtraChildren(plano.id, node.codigo_gerencial)) {
      alert("Essa conta tem contas dentro dela — remova as de dentro primeiro.");
      return;
    }
    if (!confirm(`Excluir "${node.nome}"? Vínculos de De/Para pra ela nas empresas deste plano param de valer.`)) return;
    removeExtraAccount(plano.id, node.codigo_gerencial);
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900">
        <ArrowLeft size={15} />
        Planos padrão
      </button>

      <PageHeader eyebrow="Plano padrão" title={plano.nome} description={`${plano.extraAccounts.length} conta${plano.extraAccounts.length === 1 ? "" : "s"} extra · usado por ${companies.length} empresa${companies.length === 1 ? "" : "s"}`} icon={Layers} />

      {companies.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl bg-surface-card p-3 shadow-sm">
          {companies.map((company) => (
            <span key={company.id} className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] text-ink-700">
              {company.name}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-surface-card p-4 shadow-sm">
        <div className="flex gap-1.5">
          {demonstrativos.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${tab === item ? "bg-accent-500 font-medium text-white" : "text-ink-600 hover:bg-surface-muted"}`}
            >
              {item}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[12px] text-ink-400">
          {rows.length} códigos no demonstrativo {tab} (global + extras deste plano)
          <span className="ml-2 text-ink-300">— passe o mouse numa linha pra adicionar uma conta extra ali dentro</span>
        </p>

        <div className="mt-2 max-h-[560px] overflow-y-auto scrollbar-thin">
          {tree.map((node) => (
            <TreeNode key={node.codigo_gerencial} node={node} depth={0} expanded={expanded} toggle={toggle} onAddChild={setAddingUnder} onDeleteExtra={handleDeleteExtra} />
          ))}
          {tree.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-ink-400">Nenhum código carregado.</p>}
        </div>
      </div>

      {addingUnder && <AddExtraAccountModal planoPadraoId={plano.id} parent={addingUnder} onClose={() => setAddingUnder(null)} onCreated={handleCreated} />}
    </div>
  );
}

export default function PlanoPadraoAdmin() {
  const state = useAppState();
  const [openId, setOpenId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openPlano = openId ? state.planosPadrao.find((plano) => plano.id === openId) : null;
  if (openPlano) return <PlanoEditor plano={openPlano} onBack={() => setOpenId(null)} />;

  return (
    <div>
      <PageHeader
        eyebrow="Parâmetros gerais"
        title="Planos padrão"
        description="Cada empresa (ou grupo de empresas parecidas) pode ter contas extras próprias, por cima do Plano gerencial global — sem afetar as demais."
        icon={Layers}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-900">
          {state.planosPadrao.length} plano{state.planosPadrao.length === 1 ? "" : "s"} criado{state.planosPadrao.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
        >
          + Novo plano padrão
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {state.planosPadrao.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
              <Layers size={22} strokeWidth={1.6} />
            </span>
            <p className="text-[13px] font-medium text-ink-900">Nenhum plano padrão criado ainda</p>
            <p className="text-[12px] text-ink-400">Enquanto isso, toda empresa usa só o Plano gerencial global.</p>
          </div>
        )}
        {state.planosPadrao.map((plano) => {
          const companies = companiesUsingPlano(plano.id);
          return (
            <div key={plano.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
              <button type="button" onClick={() => setOpenId(plano.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                  <Layers size={16} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink-900">{plano.nome}</p>
                  <p className="text-[12px] text-ink-400">
                    {plano.extraAccounts.length} conta{plano.extraAccounts.length === 1 ? "" : "s"} extra · {companies.length} empresa{companies.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (companies.length > 0) {
                    alert(`Esse plano está em uso por ${companies.length} empresa${companies.length === 1 ? "" : "s"} — troque o plano delas primeiro.`);
                    return;
                  }
                  if (confirm(`Apagar "${plano.nome}"?`)) deletePlanoPadrao(plano.id);
                }}
                aria-label={`Apagar ${plano.nome}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line-strong text-danger-600 hover:bg-danger-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {modalOpen && <NewPlanoModal onClose={() => setModalOpen(false)} onCreated={(plano) => { setModalOpen(false); setOpenId(plano.id); }} />}
    </div>
  );
}
