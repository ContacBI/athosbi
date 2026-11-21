import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, ShieldCheck, X } from "lucide-react";

// Item do anexo da LC 214, completo e sem cortes: o texto da lei, os NCMs (com exceções e alíneas), as condições do anexo (texto oficial inteiro) e os códigos de cClassTrib que podem entrar.
// Abre por cima de qualquer tela (produto, janela de pedido…). `lei` é a base da LC 214 enviada pelo escritório (anexos, itens, complementos); `codigosPorItem` são os códigos de cClassTrib do produto.
const URL_LEI = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm";

const pctDoRotulo = (t) => (t?.reducao != null ? (Number(t.reducao) === 100 ? "Alíquota zero · 100%" : `Redução de ${t.reducao}%`) : t?.rotulo || "");

function Bloco({ titulo, icone, children }) {
  return (
    <section className="rounded-2xl border border-line bg-surface-card">
      <h3 className="flex items-center gap-2 border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{icone}{titulo}</h3>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default function JanelaDoItem({ lei, anexo, item, codigosPorItem, onClose }) {
  const [textoCompleto, setTextoCompleto] = useState(null);
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onClose]);

  const a = lei?.anexos?.find((x) => String(x.anexo) === String(anexo));
  const it = a?.itens?.find((x) => String(x.item) === String(item));
  const complementos = lei?.complementos?.[anexo] || [];
  const codigos = codigosPorItem?.[`${anexo}|${item}`]?.codigos || [];
  const grupos = it?.grupos?.length ? it.grupos : it ? [{ alinea: "", ncm: it.ncm || [], excecoes: it.excecoes || [] }] : [];
  const pct = pctDoRotulo(a?.tratamento);
  const zero = Number(a?.tratamento?.reducao) === 100;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-3 py-5 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-surface-page shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Anexo ${anexo}, item ${item}`}>
        <div className="relative overflow-hidden border-b border-line bg-gradient-to-br from-accent-500/15 via-surface-card to-surface-card px-7 pb-5 pt-6">
          <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">LC 214/2025 · Anexo {anexo}</p>
          <h2 className="mt-1 text-[28px] font-bold leading-tight text-ink-900">Item {item}</h2>
          {pct && <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-[12.5px] font-bold ${zero ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{pct}</span>}
          {a?.nome && <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-ink-500">{a.nome}</p>}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 scrollbar-thin">
          {!it ? (
            <p className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-[13px] text-ink-400">Este item não está na base da LC 214 enviada pelo escritório.</p>
          ) : (
            <>
              <Bloco titulo="O que diz a lei" icone={<BookOpen size={13} />}>
                <p className="text-[16px] leading-relaxed text-ink-900">{it.descricao}</p>
              </Bloco>

              <Bloco titulo="NCM/SH na lei">
                <div className="flex flex-col gap-3">
                  {grupos.map((g, i) => (
                    <div key={`${g.alinea}-${i}`}>
                      {g.alinea && <p className="mb-1.5 text-[12px] font-semibold text-ink-600">Alínea {g.alinea}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {(g.ncm || []).map((n, k) => <span key={`${n}-${k}`} className="rounded-lg bg-surface-muted px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-ink-800">{n}</span>)}
                        {!(g.ncm || []).length && <span className="text-[12.5px] text-ink-400">Sem NCM listado.</span>}
                      </div>
                      {(g.excecoes || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11.5px] font-semibold uppercase tracking-wide text-rose-500">exceto</span>
                          {g.excecoes.map((n, k) => <span key={`${n}-${k}`} className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-rose-500">{n}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Bloco>

              {complementos.length > 0 && (
                <Bloco titulo={`Condições do Anexo ${anexo}`} icone={<ShieldCheck size={13} />}>
                  <div className="flex flex-col gap-3">
                    {complementos.map((c) => (
                      <div key={c.artigo} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                        <p className="text-[13px] font-bold text-ink-900">{c.artigo}</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-amber-600">{c.tratamento}</p>
                        {c.condicao && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-800">{c.condicao}</p>}
                        {c.textoOficial && (
                          <>
                            <button type="button" onClick={() => setTextoCompleto(textoCompleto === c.artigo ? null : c.artigo)} className="mt-2 text-[12px] font-medium text-accent-600 hover:underline">{textoCompleto === c.artigo ? "Esconder o texto oficial" : "Ler o texto oficial do artigo"}</button>
                            {textoCompleto === c.artigo && <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-card p-3 text-[13px] leading-relaxed text-ink-700">{c.textoOficial}</p>}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </Bloco>
              )}

              {codigos.length > 0 && (
                <Bloco titulo="Códigos de cClassTrib que podem entrar na nota">
                  <div className="flex flex-col gap-2">
                    {codigos.map((c) => (
                      <div key={c.cClassTrib} className="flex flex-wrap items-start gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-3">
                        <span className="rounded-lg bg-accent-500/10 px-2.5 py-1 text-[14px] font-bold tabular-nums text-accent-700">{c.cClassTrib}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium leading-snug text-ink-900">{c.nome}</p>
                          <p className="mt-0.5 text-[12px] text-ink-500">CST {c.cst}{c.reducao != null ? ` · ${Number(c.reducao) === 100 ? "alíquota zero" : `redução de ${c.reducao}%`}` : ""}{c.lc214 ? ` · ${c.lc214}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Bloco>
              )}

              <a href={URL_LEI} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-accent-600 hover:underline"><ExternalLink size={13} /> Abrir a lei no Planalto (procure por "ANEXO {anexo}", item {item})</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

