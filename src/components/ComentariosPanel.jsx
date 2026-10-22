import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, Trash2, X } from "lucide-react";
import { useAppState } from "../data/useStore.js";
import { addComment, allComments, monthNamePt, removeComment } from "../lib/comentarios.js";
import { planNameCase } from "../lib/planCase.js";

// Painel "Comentários" dos Demonstrativos (ver lib/comentarios.js): os
// comentários do período, mês a mês, e o formulário para comentar uma linha
// num mês. Quem não edita a empresa só lê.

export default function ComentariosPanel({ tab, months, canEdit, initial = null, onClose }) {
  const app = useAppState();
  const company = app.activeGroupId ? null : app.companies.find((item) => item.id === app.activeCompanyId);
  const list = allComments(company);
  const lines = useMemo(
    () =>
      (app.plano || [])
        .filter((row) => row.demonstrativo === (tab === "BP" ? "BP" : "DRE") && Number(row.nivel || 0) >= 2)
        .map((row) => ({ code: row.codigo_gerencial, name: planNameCase(row.nome || row.codigo_gerencial), nivel: Number(row.nivel || 0) }))
        .sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true })),
    [app.plano, tab]
  );
  const names = useMemo(() => new Map((app.plano || []).map((row) => [row.codigo_gerencial, planNameCase(row.nome || row.codigo_gerencial)])), [app.plano]);
  const [code, setCode] = useState(initial?.code || "");
  const [month, setMonth] = useState(initial?.month || months[months.length - 1] || "");
  const [text, setText] = useState("");
  const [search, setSearch] = useState(initial?.code ? names.get(initial.code) || "" : "");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monthSet = new Set(months);
  const inPeriod = list.filter((comment) => monthSet.has(comment.month)).sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt));
  const term = search.trim().toLowerCase();
  const options = term && !code ? lines.filter((line) => `${line.code} ${line.name}`.toLowerCase().includes(term)).slice(0, 8) : [];

  function submit(event) {
    event.preventDefault();
    if (!code) return setMessage("Escolha a linha do demonstrativo.");
    if (!text.trim()) return setMessage("Escreva o comentário.");
    const saved = addComment({ code, month, text });
    if (!saved) return setMessage("Não consegui salvar o comentário.");
    setText("");
    setMessage(`Comentário salvo em ${names.get(code) || code}, ${monthNamePt(month)}.`);
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-navy-950/30 backdrop-blur-[2px]" onPointerDown={onClose}>
      <div className="comentarios-painel flex h-full w-full max-w-[460px] flex-col bg-surface-card shadow-2xl" onPointerDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <MessageSquare size={18} />
            </span>
            <div>
              <h3 className="text-[16px] font-semibold text-ink-900">Comentários nos números</h3>
              <p className="mt-0.5 text-[12.5px] text-ink-500">O contexto de cada mês — aparece no demonstrativo, nos cards do B.I. e nos slides do assistente.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-surface-muted hover:text-ink-700" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {!company ? (
          <p className="px-5 py-8 text-[13px] text-ink-500">Os comentários são feitos empresa por empresa. Abra uma das empresas do grupo para comentar.</p>
        ) : (
          <>
            {canEdit && (
              <form onSubmit={submit} className="flex flex-col gap-2 border-b border-line bg-surface-muted/50 px-5 py-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">Novo comentário</p>
                <div className="relative">
                  {code ? (
                    <div className="flex h-9 items-center justify-between rounded-lg border border-accent-300 bg-surface-card px-3 text-[13px]">
                      <span className="truncate text-ink-800">
                        {names.get(code) || code} <span className="text-[11px] text-ink-400">{code}</span>
                      </span>
                      <button type="button" onClick={() => { setCode(""); setSearch(""); }} className="text-[11.5px] font-medium text-accent-700 hover:underline">
                        trocar
                      </button>
                    </div>
                  ) : (
                    <label className="relative flex items-center">
                      <Search size={14} className="pointer-events-none absolute left-2.5 text-ink-300" />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Linha ${tab === "BP" ? "do Balanço" : "da DRE"} (ex.: aluguel, receita…)`} className="comentario-linha h-9 w-full rounded-lg border border-line bg-surface-card pl-8 pr-3 text-[13px] outline-none focus:border-accent-400" />
                    </label>
                  )}
                  {options.length > 0 && (
                    <div className="absolute left-0 right-0 top-10 z-10 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface-card py-1 shadow-lg">
                      {options.map((line) => (
                        <button key={line.code} type="button" onClick={() => { setCode(line.code); setSearch(line.name); }} className="comentario-opcao flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-surface-muted" style={{ paddingLeft: 12 + (line.nivel - 2) * 10 }}>
                          <span className="truncate text-ink-800">{line.name}</span>
                          <span className="shrink-0 text-[10.5px] text-ink-400">{line.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <select value={month} onChange={(event) => setMonth(event.target.value)} className="comentario-mes h-9 rounded-lg border border-line bg-surface-card px-2.5 text-[13px] outline-none focus:border-accent-400">
                  {months.map((item) => (
                    <option key={item} value={item}>
                      {monthNamePt(item)}
                    </option>
                  ))}
                </select>
                <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={600} placeholder="Ex.: indenização trabalhista pontual de R$ 80 mil; não deve se repetir." className="comentario-texto rounded-lg border border-line bg-surface-card px-3 py-2 text-[13px] outline-none focus:border-accent-400" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-ink-500">{message}</span>
                  <button type="submit" className="comentario-salvar h-9 shrink-0 rounded-lg bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600">
                    Comentar
                  </button>
                </div>
              </form>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {!inPeriod.length && <p className="py-6 text-center text-[13px] text-ink-400">Nenhum comentário no período.</p>}
              {inPeriod.map((comment) => (
                <div key={comment.id} className="comentario-item mb-2.5 rounded-lg border border-line px-3.5 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-ink-800">
                      {names.get(comment.code) || comment.code} <span className="font-normal text-ink-400">· {monthNamePt(comment.month)}</span>
                    </p>
                    {canEdit && (
                      <button type="button" onClick={() => window.confirm("Apagar este comentário?") && removeComment(comment.id)} className="comentario-apagar text-ink-300 hover:text-danger-600" title="Apagar">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug text-ink-700">{comment.text}</p>
                  <p className="mt-1 text-[10.5px] text-ink-400">
                    {comment.author ? `${comment.author} · ` : ""}
                    {new Date(comment.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
