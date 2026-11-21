import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageSquare, Plus, Send } from "lucide-react";
import { STATUS_DE_PEDIDO, TIPOS_DE_PEDIDO, observarPedido, pedidoAberto, resumoDoPedido } from "../lib/revisaNota.js";
import { FormNovoProduto, LinhaDoTempo, SeloDoStatus } from "./RevisaNotaPedidos.jsx";

// Cadastro do Revisa Nota como conversa: à esquerda os pedidos (com bolinha quando o escritório respondeu), à direita o pedido aberto — situação, o que foi pedido e o bate-papo
// (cliente de um lado, escritório do outro). Quem escreve, o outro lado vê na hora (a tela atualiza a cada 15 s e avisa quando chega mensagem nova).

const quando = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
const titulo = (p) => p.descricao || p.alvo;

// As mensagens da conversa em ordem: o pedido (primeira mensagem do cliente), as observações e a resposta final do escritório, quando existe.
function mensagensDoPedido(pedido) {
  const proposta = pedido.proposta || {};
  const pedidoInicial = { id: `pedido-${pedido.id}`, autor: "cliente", autor_nome: pedido.criado_por ? pedido.criado_por.split("@")[0] : "Cliente", criado_em: pedido.criado_em, destaque: `${TIPOS_DE_PEDIDO[pedido.tipo]}: ${resumoDoPedido(pedido)}`, texto: proposta.observacao || "" };
  const lista = [pedidoInicial, ...(pedido.observacoes || [])];
  if (pedido.resposta) lista.push({ id: `resposta-${pedido.id}`, autor: "escritorio", autor_nome: "", criado_em: pedido.atualizado_em, destaque: pedido.status === "recusado" ? "Resposta · pedido recusado" : "Resposta do escritório", texto: pedido.resposta });
  return lista.sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
}

function Balao({ m }) {
  const doEscritorio = m.autor === "escritorio";
  return (
    <li className={`flex ${doEscritorio ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] ${doEscritorio ? "rounded-bl-md bg-accent-500/12 text-ink-900" : "rounded-br-md bg-surface-muted text-ink-900"}`}>
        <p className="text-[11px] font-semibold text-ink-500">
          {doEscritorio ? `Escritório${m.autor_nome ? ` · ${m.autor_nome}` : ""}` : m.autor_nome || "Você"} <span className="font-normal text-ink-400">· {quando(m.criado_em)}</span>
        </p>
        {m.destaque && <p className="mt-1 text-[12.5px] font-semibold text-accent-700">{m.destaque}</p>}
        {m.texto && <p className="mt-0.5 whitespace-pre-wrap break-words">{m.texto}</p>}
      </div>
    </li>
  );
}

function Conversa({ pedido, recarregar, aoLer }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fim = useRef(null);
  const mensagens = useMemo(() => mensagensDoPedido(pedido), [pedido]);

  // sempre mostra o fim da conversa; ver a conversa aberta é "ler"
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
    aoLer?.(pedido);
  }, [mensagens.length, pedido.status, pedido.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    setErro("");
    try {
      await observarPedido(pedido.id, limpo);
      setTexto("");
      await recarregar?.();
    } catch (err) {
      setErro(err.message || "Não consegui enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="flex min-h-[220px] flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {mensagens.map((m) => <Balao key={m.id} m={m} />)}
        <li ref={fim} aria-hidden="true" />
      </ul>
      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            rows={2}
            maxLength={1000}
            placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter pula linha)"
            className="w-full resize-none rounded-xl border border-line bg-surface-page px-3 py-2 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400"
          />
          <button type="button" onClick={enviar} disabled={enviando || !texto.trim()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent-500 px-4 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50"><Send size={14} /> Enviar</button>
        </div>
        {erro && <p className="mt-1.5 text-[12px] text-danger-600">{erro}</p>}
      </div>
    </div>
  );
}

export default function CentralDePedidos({ pedidos, companyId, recarregar, naoLidas, aoLer, abrirId, aoAbrir }) {
  const [filtro, setFiltro] = useState("abertos");
  const [novo, setNovo] = useState(false);
  const [escolhido, setEscolhido] = useState(null);
  const abertos = pedidos.filter(pedidoAberto).length;
  const lista = pedidos.filter((p) => (filtro === "abertos" ? pedidoAberto(p) || naoLidas.has(p.id) : true));
  // o pedido que um aviso mandou abrir, ou o que estava aberto; senão o primeiro da lista
  useEffect(() => {
    if (abrirId && pedidos.some((p) => p.id === abrirId)) {
      setEscolhido(abrirId);
      setFiltro("todos");
      aoAbrir?.();
    }
  }, [abrirId, pedidos, aoAbrir]);
  const atual = pedidos.find((p) => p.id === escolhido) || null;
  const mostrarLista = !atual;

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-card px-5 py-4 shadow-sm">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">Pedidos e conversas</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">Peça um cadastro ou uma mudança e converse com o escritório em cada pedido. A resposta chega aqui e você é avisado.</p>
        </div>
        {!novo && <button type="button" onClick={() => setNovo(true)} className="flex items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-600"><Plus size={14} /> Cadastrar produto</button>}
      </section>
      {novo && (
        <section className="rounded-2xl border border-line bg-surface-card p-5 shadow-sm">
          <FormNovoProduto companyId={companyId} onCancelar={() => setNovo(false)} onCriado={async () => { setNovo(false); await recarregar(); }} />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section className={`${atual ? "hidden lg:flex" : "flex"} min-h-[420px] flex-col rounded-2xl border border-line bg-surface-card`}>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h3 className="text-[13.5px] font-semibold text-ink-900">Seus pedidos</h3>
            <div className="inline-flex rounded-lg bg-surface-muted p-0.5 text-[12px]">
              {[["abertos", `Em andamento${abertos ? ` (${abertos})` : ""}`], ["todos", `Todos (${pedidos.length})`]].map(([id, nome]) => (
                <button key={id} type="button" onClick={() => setFiltro(id)} className={`rounded-md px-2.5 py-1 font-medium transition-colors ${filtro === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{nome}</button>
              ))}
            </div>
          </div>
          <ul className="flex-1 divide-y divide-line/60 overflow-y-auto">
            {lista.map((p) => {
              const sel = p.id === escolhido;
              const nova = naoLidas.has(p.id);
              const ultima = (p.observacoes || [])[(p.observacoes || []).length - 1];
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => setEscolhido(p.id)} className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${sel ? "bg-accent-500/8" : "hover:bg-surface-muted/60"}`}>
                    <span className="flex items-center gap-2">
                      {nova && <span className="h-2 w-2 shrink-0 rounded-full bg-accent-500" title="Mensagem nova" />}
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-600">{TIPOS_DE_PEDIDO[p.tipo]}</span>
                      <span className="ml-auto text-[11px] text-ink-400">{quando(ultima?.criado_em || p.criado_em)}</span>
                    </span>
                    <span className={`truncate text-[13.5px] ${nova ? "font-bold" : "font-semibold"} text-ink-900`}>{titulo(p)}</span>
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-500">{ultima ? `${ultima.autor === "escritorio" ? "Escritório: " : "Você: "}${ultima.texto}` : resumoDoPedido(p)}</span>
                      <SeloDoStatus status={p.status} />
                    </span>
                  </button>
                </li>
              );
            })}
            {!lista.length && <li className="px-4 py-10 text-center text-[13px] text-ink-400">{filtro === "abertos" ? "Nenhum pedido em andamento." : "Nenhum pedido ainda."}</li>}
          </ul>
        </section>

        <section className={`${mostrarLista ? "hidden lg:flex" : "flex"} min-h-[420px] flex-col rounded-2xl border border-line bg-surface-card`}>
          {!atual ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <MessageSquare size={26} className="text-ink-300" />
              <p className="text-[13px] text-ink-400">Escolha um pedido para ver a situação e a conversa.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-line px-5 py-4">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => setEscolhido(null)} aria-label="Voltar para a lista" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-500 hover:bg-surface-muted lg:hidden"><ArrowLeft size={16} /></button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{TIPOS_DE_PEDIDO[atual.tipo]}</p>
                    <h3 className="truncate text-[15px] font-semibold text-ink-900">{titulo(atual)}</h3>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">{resumoDoPedido(atual)}</p>
                  </div>
                  <SeloDoStatus status={atual.status} />
                </div>
                <div className="mt-4"><LinhaDoTempo pedido={atual} /></div>
              </div>
              <Conversa key={atual.id} pedido={atual} recarregar={recarregar} aoLer={aoLer} />
              {!pedidoAberto(atual) && <p className="border-t border-line bg-surface-muted/40 px-4 py-2 text-center text-[11.5px] text-ink-400">Pedido {STATUS_DE_PEDIDO[atual.status]?.nome.toLowerCase()}. A conversa continua aberta se precisar.</p>}
            </>
          )}
        </section>
      </div>
    </>
  );
}
