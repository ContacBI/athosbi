import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronRight, Download, Layers, ListTree, Pencil, Plus, RotateCcw, Search, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useAppState } from "../../data/useStore.js";
import { addPlanoAccount, hasChildren, previewNewAccount, removePlanoAccount } from "../../lib/planoOverrides.js";
import { exportPlanoExcel, parsePlanoExcelFile } from "../../lib/planoExcel.js";
import { savePlanoSnapshot, restorePreviousPlano } from "../../lib/planoStore.js";
import { invalidateMappingsForPlanoCodes } from "../../lib/companies.js";
import { extraAccountsSummary, moveGlobalAccountToPlanos, pruneUnusedExtraAccounts } from "../../lib/planosPadrao.js";
import PageHeader from "../../components/PageHeader.jsx";

// Resumo de tudo que foi criado nos Planos padrão (ver
// lib/planosPadrao.js) — pensado pro admin bater o olho de vez em quando e
// decidir se alguma conta "pegou" o suficiente pra merecer virar conta do
// Plano gerencial global de verdade (nesse caso, é só recriar ela aqui e
// apagar a extra de lá — não existe um botão de "promover" automático de
// propósito, essa é uma decisão que vale olhar caso a caso).
function NewAccountsSummary() {
  const state = useAppState();
  const [notice, setNotice] = useState("");
  const summary = useMemo(() => extraAccountsSummary(), [state.planosPadrao, state.companies]);

  function handlePrune() {
    if (!confirm("Remover, de cada plano padrão, as contas extras que NENHUMA empresa daquele plano usa no De/Para? Nunca desfaz um vínculo — só limpa quem pode usar cada conta.")) return;
    const removed = pruneUnusedExtraAccounts();
    setNotice(removed ? `${removed} conta${removed === 1 ? "" : "s"} sem uso removida${removed === 1 ? "" : "s"} dos planos.` : "Nada pra limpar — toda conta extra já tem uso no plano onde está.");
  }

  if (!summary.length) return null;
  return (
    <div className="mb-4 rounded-2xl bg-surface-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers size={15} strokeWidth={1.8} className="text-accent-500" />
          <p className="text-[13px] font-medium text-ink-900">Contas novas nos planos padrão</p>
        </div>
        <button type="button" onClick={handlePrune} className="rounded-md border border-line-strong px-2.5 py-1.5 text-[11.5px] text-ink-600 hover:bg-surface-muted">
          Limpar contas sem uso
        </button>
      </div>
      <p className="mt-0.5 text-[11.5px] text-ink-400">
        Criadas fora daqui, dentro de um plano padrão específico — não afetam o plano gerencial global até você decidir trazer alguma pra cá.
      </p>
      {notice && <p className="mt-2 text-[11.5px] text-accent-600">{notice}</p>}
      <div className="mt-3 flex flex-col gap-2.5">
        {summary.map(({ plano, companies }) => (
          <div key={plano.id} className="rounded-xl border border-line p-3">
            <p className="text-[12.5px] font-medium text-ink-800">
              {plano.nome} <span className="font-normal text-ink-400">· {companies.map((c) => c.name).join(", ") || "nenhuma empresa usando ainda"}</span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {plano.extraAccounts.map((row) => (
                <span key={row.codigo_gerencial} className="rounded-full bg-accent-50 px-2.5 py-1 text-[11px] text-accent-700">
                  {row.codigo_gerencial} · {row.nome}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Todo código ANALÍTICO que hoje é `custom: true` no global — inclusive os
// de antes dessa funcionalidade existir, sem nenhuma pista de qual empresa
// pediu — mais quem, na carteira de hoje, tem De/Para apontando pra cada
// um. Só analíticas: uma sintética nunca recebe vínculo de De/Para direto
// (só serve de categoria-mãe), então listá-la aqui seria só ruído — mover
// a folha já leva a cadeia de sintéticas-mãe custom dela junto (ver
// moveGlobalAccountToPlanos em lib/planosPadrao.js). Aceita mover pra MAIS
// DE UM plano padrão de uma vez, porque a mesma conta pode já estar em uso
// por empresas de grupos diferentes — mover pra só um quebraria a
// visibilidade dela nos relatórios de quem ficasse de fora. Mover NUNCA
// desfaz um vínculo de De/Para que já existe.
function CustomAccountsAudit() {
  const state = useAppState();
  const [movingCode, setMovingCode] = useState(null);
  const [selectedPlanoIds, setSelectedPlanoIds] = useState([]);

  const customRows = useMemo(
    () => state.planoGlobal.filter((row) => row.custom && row.natureza === "Analitica"),
    [state.planoGlobal]
  );
  const usageByCode = useMemo(() => {
    const map = new Map(customRows.map((row) => [row.codigo_gerencial, []]));
    state.companies.forEach((company) => {
      (company.mappings || []).forEach((mapping) => {
        if (map.has(mapping.codigo_gerencial)) map.get(mapping.codigo_gerencial).push(company);
      });
    });
    return map;
  }, [customRows, state.companies]);

  if (!customRows.length) return null;

  function openMove(code) {
    setMovingCode(code);
    setSelectedPlanoIds([]);
  }

  function togglePlano(id) {
    setSelectedPlanoIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.concat(id)));
  }

  function confirmMove(code) {
    if (!selectedPlanoIds.length) return;
    const names = state.planosPadrao.filter((plano) => selectedPlanoIds.includes(plano.id)).map((plano) => plano.nome).join(", ");
    if (!confirm(`Mover "${code}" (e as sintéticas-mãe dela criadas manualmente) pra: ${names}? Sai do plano gerencial global; os vínculos de De/Para que já existem continuam funcionando.`)) return;
    moveGlobalAccountToPlanos(code, selectedPlanoIds);
    setMovingCode(null);
  }

  return (
    <div className="mb-4 rounded-2xl bg-surface-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles size={15} strokeWidth={1.8} className="text-accent-500" />
        <p className="text-[13px] font-medium text-ink-900">Contas adicionadas manualmente no global</p>
      </div>
      <p className="mt-0.5 text-[11.5px] text-ink-400">
        {customRows.length} conta{customRows.length === 1 ? "" : "s"} analítica{customRows.length === 1 ? "" : "s"} · veja quais empresas já têm De/Para vinculado a cada uma e, se fizer mais sentido, mova pra um ou mais planos padrão — o código não muda, os vínculos existentes não quebram.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {customRows.map((row) => {
          const companies = usageByCode.get(row.codigo_gerencial) || [];
          const isMoving = movingCode === row.codigo_gerencial;
          return (
            <div key={row.codigo_gerencial} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-ink-800">
                    <span className="font-mono">{row.codigo_gerencial}</span> <span className="font-normal">· {row.nome}</span>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-400">
                    {companies.length ? `Usada por: ${companies.map((c) => c.name).join(", ")}` : "Nenhuma empresa com De/Para vinculado a ela ainda"}
                  </p>
                </div>
                {state.planosPadrao.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => (isMoving ? setMovingCode(null) : openMove(row.codigo_gerencial))}
                    className="shrink-0 rounded-md border border-line-strong px-2.5 py-1.5 text-[12px] text-ink-600 hover:bg-surface-muted"
                  >
                    {isMoving ? "Cancelar" : "Mover pra plano(s) padrão…"}
                  </button>
                ) : (
                  <span className="shrink-0 text-[11px] text-ink-300">Crie um plano padrão pra poder mover</span>
                )}
              </div>
              {isMoving && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                  {state.planosPadrao.map((plano) => (
                    <label key={plano.id} className="flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-[11.5px] text-ink-700">
                      <input type="checkbox" checked={selectedPlanoIds.includes(plano.id)} onChange={() => togglePlano(plano.id)} />
                      {plano.nome}
                    </label>
                  ))}
                  <button
                    type="button"
                    disabled={!selectedPlanoIds.length}
                    onClick={() => confirmMove(row.codigo_gerencial)}
                    className="rounded-md bg-accent-500 px-3 py-1.5 text-[11.5px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

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

function matchingCodes(rows, query) {
  if (!query) return null;
  const normalized = normalize(query);
  const matches = new Set();
  rows.forEach((row) => {
    if (normalize(row.codigo_gerencial).includes(normalized) || normalize(row.nome).includes(normalized)) {
      const parts = row.codigo_gerencial.split(".");
      parts.forEach((_, index) => matches.add(parts.slice(0, index + 1).join(".")));
    }
  });
  return matches;
}

function TreeNode({ node, depth, expanded, toggle, visibleCodes, highlight, onAddChild, onEdit, onDeleteCustom }) {
  if (visibleCodes && !visibleCodes.has(node.codigo_gerencial)) return null;
  const isOpen = visibleCodes ? true : expanded.has(node.codigo_gerencial);
  const nodeHasChildren = node.children.length > 0;
  const isMatch = highlight && normalize(`${node.codigo_gerencial} ${node.nome}`).includes(normalize(highlight));

  return (
    <div>
      <div
        className={`group flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-[13px] transition-colors hover:bg-surface-muted ${
          isMatch ? "bg-accent-50" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => nodeHasChildren && toggle(node.codigo_gerencial)}
          style={{ paddingLeft: 12 + depth * 18 }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center text-ink-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>
            {nodeHasChildren && <ChevronRight size={13} />}
          </span>
          <span className="w-[110px] shrink-0 font-mono text-[11px] text-ink-400">{node.codigo_gerencial}</span>
          <span className={`flex-1 truncate ${node.natureza === "Sintetica" ? "font-medium text-ink-900" : "text-ink-600"}`}>{node.nome}</span>
          {node.natureza === "Analitica" && (
            <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-ink-400">analítica</span>
          )}
          {node.aceita_depara === "sim" && (
            <span className="shrink-0 rounded-full bg-success-50 px-2 py-0.5 text-[10px] text-success-600">de/para</span>
          )}
          {node.custom && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] text-accent-600">
              <Sparkles size={10} strokeWidth={2} />
              adicionada
            </span>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(node)}
            title="Editar esta conta"
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-accent-50 hover:text-accent-600"
          >
            <Pencil size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onAddChild(node)}
            title="Adicionar conta aqui dentro"
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-accent-50 hover:text-accent-600"
          >
            <Plus size={13} strokeWidth={2} />
          </button>
          {node.custom && (
            <button
              type="button"
              onClick={() => onDeleteCustom(node)}
              title="Excluir esta conta"
              className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      {nodeHasChildren && isOpen && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.codigo_gerencial}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              visibleCodes={visibleCodes}
              highlight={highlight}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDeleteCustom={onDeleteCustom}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddAccountModal({ parent, onClose, onCreated }) {
  const [nome, setNome] = useState("");
  const [natureza, setNatureza] = useState("Analitica");
  const [error, setError] = useState("");

  const preview = useMemo(() => previewNewAccount(parent.codigo_gerencial, natureza), [parent.codigo_gerencial, natureza]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!nome.trim()) {
      setError("Dê um nome pra conta.");
      return;
    }
    const row = addPlanoAccount({ parentCode: parent.codigo_gerencial, nome, natureza });
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
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Nova conta</p>
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
            placeholder="Ex.: Adiantamentos de fornecedores diversos"
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
              Código: <span className="font-mono text-ink-800">{preview.codigo_gerencial}</span> · Nível {preview.nivel} ·{" "}
              {preview.demonstrativo} · {preview.grupo_macro}
            </p>
            <p className="mt-1">{natureza === "Analitica" ? "Vai aceitar De/Para (é uma conta-folha)." : "Não aceita De/Para direto (é uma subcategoria)."}</p>
          </div>
        )}

        {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
            Cancelar
          </button>
          <button type="submit" className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
            Criar conta
          </button>
        </div>
      </form>
    </div>
  );
}

function EditAccountModal({ row, demonstrativos, hasChildren, onClose, onSave }) {
  const [form, setForm] = useState({
    codigo_gerencial: row.codigo_gerencial,
    nome: row.nome,
    demonstrativo: row.demonstrativo,
    grupo_macro: row.grupo_macro || "",
    nivel: row.nivel || "",
    natureza: row.natureza || "Analitica",
    aceita_depara: row.aceita_depara === "sim",
  });
  const [error, setError] = useState("");
  const changed = Object.entries(form).some(([key, value]) => String(value) !== String(key === "aceita_depara" ? row.aceita_depara === "sim" : row[key] ?? ""));
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  function submit(event) {
    event.preventDefault();
    if (!form.codigo_gerencial.trim() || !form.nome.trim()) return setError("Informe o código e o nome da conta.");
    if (hasChildren && form.codigo_gerencial.trim() !== row.codigo_gerencial) return setError("Essa conta possui subtítulos. Edite os códigos das contas-filhas antes de alterar este código.");
    onSave({ ...form, codigo_gerencial: form.codigo_gerencial.trim(), nome: form.nome.trim(), nivel: String(form.nivel || 1), aceita_depara: form.aceita_depara ? "sim" : "nao" });
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 px-4 backdrop-blur-sm" onClick={onClose}>
    <form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-surface-card p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between"><div><p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">Editar conta</p><h2 className="mt-0.5 text-[16px] font-medium text-ink-900">{row.nome}</h2></div><button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button></div>
      <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-[11.5px] text-warning-700">Ao salvar qualquer alteração, os vínculos desta conta serão desfeitos em todas as empresas para que sejam cadastrados novamente.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Código gerencial"><input value={form.codigo_gerencial} onChange={(event) => update("codigo_gerencial", event.target.value)} className="input" /></Field><Field label="Nome"><input value={form.nome} onChange={(event) => update("nome", event.target.value)} className="input" /></Field><Field label="Demonstrativo"><select value={form.demonstrativo} onChange={(event) => update("demonstrativo", event.target.value)} className="input">{demonstrativos.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Grupo macro"><input value={form.grupo_macro} onChange={(event) => update("grupo_macro", event.target.value)} className="input" /></Field><Field label="Nível"><input type="number" min="1" value={form.nivel} onChange={(event) => update("nivel", event.target.value)} className="input" /></Field><Field label="Natureza"><select value={form.natureza} onChange={(event) => update("natureza", event.target.value)} className="input"><option value="Sintetica">Sintética</option><option value="Analitica">Analítica</option></select></Field></div>
      <label className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-700"><input type="checkbox" checked={form.aceita_depara} onChange={(event) => update("aceita_depara", event.target.checked)} />Aceita vínculo de De/Para</label>
      {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600">Cancelar</button><button type="submit" disabled={!changed} className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50">Salvar alteração</button></div>
    </form>
  </div>;
}

function Field({ label, children }) { return <label className="block text-[12px] text-ink-600">{label}<span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-line-strong [&_input]:px-2.5 [&_input]:py-1.5 [&_input]:text-[13px] [&_input]:outline-none [&_input:focus]:border-accent-500 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-line-strong [&_select]:px-2.5 [&_select]:py-1.5 [&_select]:text-[13px] [&_select]:outline-none [&_select:focus]:border-accent-500">{children}</span></label>; }

// Shows validation problems (nothing gets applied until the sheet is
// clean) or, once it parses cleanly, a summary + explicit confirm before
// replacing the whole plano — this is the bulk path, so it backs up
// whatever was live first (see planoStore.js), unlike the one-at-a-time
// tree "+" which doesn't need to.
function ImportPlanoModal({ result, onClose, onConfirm }) {
  const hasErrors = result.errors && result.errors.length > 0;
  const newCount = hasErrors ? 0 : result.rows.filter((row) => row.custom).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-surface-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[16px] font-medium text-ink-900">{hasErrors ? "A planilha tem problemas" : "Confirmar importação"}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {hasErrors ? (
            <>
              <p className="mb-3 flex items-center gap-2 text-[13px] text-danger-600">
                <AlertTriangle size={15} strokeWidth={1.8} />
                Corrija e envie de novo — nada foi alterado ainda.
              </p>
              <ul className="flex flex-col gap-1.5 text-[12.5px] text-ink-600">
                {result.errors.map((message, index) => (
                  <li key={index} className="rounded-lg bg-danger-50 px-3 py-2 text-danger-700">
                    {message}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="rounded-xl bg-surface-muted p-4 text-[13px] text-ink-700">
              <p>
                <span className="font-medium text-ink-900">{result.rows.length}</span> contas no total
                {newCount > 0 && (
                  <>
                    {" "}
                    · <span className="font-medium text-accent-600">{newCount} novas</span>
                  </>
                )}
              </p>
              <p className="mt-2 text-ink-500">
                Isso substitui o plano gerencial inteiro por essa planilha. A versão atual fica guardada — dá pra
                restaurar depois se algo sair errado.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">
            {hasErrors ? "Fechar" : "Cancelar"}
          </button>
          {!hasErrors && (
            <button type="button" onClick={onConfirm} className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
              Confirmar importação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanoGerencial() {
  const state = useAppState();
  const navigate = useNavigate();
  // Admin-only mesmo pra colaborador Restrito, que entra no resto de
  // Parâmetros — ver ParametrosLayout.jsx.
  if (!state.isAdmin) return <Navigate to="/parametros/empresas" replace />;
  const [tab, setTab] = useState("DRE");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  const [activeLevel, setActiveLevel] = useState(null);
  const [addingUnder, setAddingUnder] = useState(null);
  const [editing, setEditing] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [busy, setBusy] = useState("");
  const importInputRef = useRef(null);

  const demonstrativos = useMemo(() => [...new Set(state.planoGlobal.map((row) => row.demonstrativo))].sort(), [state.planoGlobal]);
  const rows = useMemo(() => state.planoGlobal.filter((row) => row.demonstrativo === tab), [state.planoGlobal, tab]);
  const tree = useMemo(() => buildTree(rows), [rows]);
  const visibleCodes = useMemo(() => matchingCodes(rows, search), [rows, search]);
  const levels = useMemo(() => [...new Set(rows.map((row) => Number(row.nivel) || 1))].sort((a, b) => a - b), [rows]);
  const customCount = useMemo(() => state.planoGlobal.filter((row) => row.custom).length, [state.planoGlobal]);

  function toggle(code) {
    setActiveLevel(null);
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function expandToLevel(level) {
    setSearch("");
    setActiveLevel(level);
    setExpanded(new Set(rows.filter((row) => Number(row.nivel) < level).map((row) => row.codigo_gerencial)));
  }

  function handleCreated(row) {
    setExpanded((current) => new Set(current).add(row.codigo_gerencial.split(".").slice(0, -1).join(".")));
    setAddingUnder(null);
  }

  function handleDeleteCustom(node) {
    if (hasChildren(node.codigo_gerencial)) {
      alert("Essa conta tem contas dentro dela — remova as de dentro primeiro.");
      return;
    }
    if (!confirm(`Excluir "${node.nome}"? Os vínculos dela serão desfeitos em todas as empresas.`)) return;
    removePlanoAccount(node.codigo_gerencial);
    const count = invalidateMappingsForPlanoCodes(node.codigo_gerencial);
    flashBusy(count ? `${count} vínculo${count === 1 ? "" : "s"} desfeito${count === 1 ? "" : "s"}.` : "Conta removida.");
  }

  function handleSaveEdit(nextValues) {
    if (state.planoGlobal.some((row) => row.codigo_gerencial === nextValues.codigo_gerencial && row.codigo_gerencial !== editing.codigo_gerencial)) {
      alert("Já existe uma conta com este código gerencial.");
      return;
    }
    const nextPlano = state.planoGlobal.map((row) => row.codigo_gerencial === editing.codigo_gerencial ? { ...row, ...nextValues } : row);
    savePlanoSnapshot(nextPlano);
    const count = invalidateMappingsForPlanoCodes(editing.codigo_gerencial);
    setEditing(null);
    flashBusy(count ? `Conta atualizada e ${count} vínculo${count === 1 ? "" : "s"} desfeito${count === 1 ? "" : "s"}.` : "Conta atualizada. Não havia vínculos para desfazer.");
  }

  function flashBusy(message) {
    setBusy(message);
    setTimeout(() => setBusy(""), 3500);
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    flashBusy("Lendo planilha...");
    try {
      const result = await parsePlanoExcelFile(file);
      setBusy("");
      setImportResult(result);
    } catch {
      setBusy("");
      flashBusy("Não consegui ler esse arquivo — confirme que é o .xlsx exportado daqui.");
    }
  }

  function handleConfirmImport() {
    const incomingByCode = new Map(importResult.rows.map((row) => [row.codigo_gerencial, row]));
    const changedCodes = state.planoGlobal.filter((oldRow) => {
      const incoming = incomingByCode.get(oldRow.codigo_gerencial);
      return !incoming || ["nome", "demonstrativo", "grupo_macro", "nivel", "natureza", "aceita_depara"].some((key) => String(oldRow[key] ?? "") !== String(incoming[key] ?? ""));
    }).map((row) => row.codigo_gerencial);
    savePlanoSnapshot(importResult.rows, { backupCurrent: true });
    const count = invalidateMappingsForPlanoCodes(changedCodes);
    setImportResult(null);
    flashBusy(count ? `Plano atualizado e ${count} vínculo${count === 1 ? "" : "s"} desfeito${count === 1 ? "" : "s"}.` : "Plano gerencial atualizado.");
  }

  async function handleRestore() {
    if (!confirm("Voltar pro plano gerencial de antes da última importação?")) return;
    const restored = await restorePreviousPlano();
    flashBusy(restored ? "Versão anterior restaurada." : "Não achei uma versão anterior salva.");
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate("/parametros/sistema")}
        className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={15} />
        Sistema
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Parâmetros gerais"
          title="Plano gerencial"
          description="Estrutura de códigos, contas e demonstrativos usada por todas as empresas do portal."
          icon={ListTree}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          {busy && <span className="mr-1 text-[12px] text-ink-400">{busy}</span>}
          {state.planoBackupAvailable && (
            <button
              type="button"
              onClick={handleRestore}
              title="Desfazer a última importação de Excel"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-line-strong text-ink-500 transition-colors hover:bg-surface-muted"
            >
              <RotateCcw size={14} strokeWidth={1.8} />
            </button>
          )}
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-[12px] font-medium text-ink-700 transition-colors hover:bg-surface-muted"
          >
            <Upload size={14} strokeWidth={1.8} />
            Importar Excel
          </button>
          <button
            type="button"
            onClick={exportPlanoExcel}
            className="flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-600"
          >
            <Download size={14} strokeWidth={1.8} />
            Baixar Excel
          </button>
          <input ref={importInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      <CustomAccountsAudit />
      <NewAccountsSummary />

      <div className="rounded-2xl bg-surface-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {demonstrativos.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setTab(item);
                  setActiveLevel(null);
                }}
                className={`rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${
                  tab === item ? "bg-accent-500 font-medium text-white" : "text-ink-600 hover:bg-surface-muted"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar código ou nome"
              className="w-56 rounded-md border border-line-strong py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-accent-500"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <span className="text-[12px] text-ink-400">Nível:</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => expandToLevel(level)}
                title={level === 5 ? "Abrir tudo até o nível analítico" : `Abrir até o nível ${level}`}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-medium transition-colors ${
                  activeLevel === level
                    ? "bg-accent-500 text-white"
                    : "bg-surface-muted text-ink-600 hover:bg-accent-50 hover:text-accent-600"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[12px] text-ink-400">
          {rows.length} códigos no demonstrativo {tab}
          {customCount > 0 && <> · {customCount} adicionada{customCount === 1 ? "" : "s"} por vocês</>}
          <span className="ml-2 text-ink-300">— passe o mouse numa linha pra adicionar uma conta dentro dela</span>
        </p>

        <div className="mt-2 max-h-[560px] overflow-y-auto scrollbar-thin">
          {tree.map((node) => (
            <TreeNode
              key={node.codigo_gerencial}
              node={node}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              visibleCodes={visibleCodes}
              highlight={search}
              onAddChild={setAddingUnder}
              onEdit={setEditing}
              onDeleteCustom={handleDeleteCustom}
            />
          ))}
          {tree.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-ink-400">Nenhum código carregado.</p>}
        </div>
      </div>

      {addingUnder && <AddAccountModal parent={addingUnder} onClose={() => setAddingUnder(null)} onCreated={handleCreated} />}
      {editing && <EditAccountModal row={editing} demonstrativos={demonstrativos} hasChildren={hasChildren(editing.codigo_gerencial)} onClose={() => setEditing(null)} onSave={handleSaveEdit} />}
      {importResult && <ImportPlanoModal result={importResult} onClose={() => setImportResult(null)} onConfirm={handleConfirmImport} />}
    </div>
  );
}
