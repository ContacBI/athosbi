import { useEffect, useState } from "react";
import { AlertTriangle, MessageSquare, Send, X } from "lucide-react";
import { STATUS_DE_PEDIDO, TIPOS_DE_PEDIDO, alvoDoProduto, criarPedido, etapasDoPedido, ncmFormatado, observarPedido, resumoDoPedido, rotuloDaReducao } from "../lib/revisaNota.js";

// Pedidos do Revisa Nota (produto novo, mudança de classificação, perfil de comprador) e a conversa de observações de cada um. O cliente pede e conversa aqui; o escritório responde pelo
// app dele e a resposta aparece na hora. Tudo em Athos (tabelas revisa_nota_pedidos e revisa_nota_observacoes).

const TONS = {
  azul: "bg-sky-500/10 text-sky-600",
  ambar: "bg-amber-500/15 text-amber-600",
  verde: "bg-emerald-500/10 text-emerald-600",
  cinza: "bg-surface-muted text-ink-500",
};
const campo = "w-full rounded-lg border border-line bg-surface-page px-3 py-2 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400";
const rotulo = "block text-[11.5px] font-medium text-ink-500";

const quando = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export function SeloDoStatus({ status }) {
  const s = STATUS_DE_PEDIDO[status] || STATUS_DE_PEDIDO.enviado;
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONS[s.tom]}`}>{s.nome}</span>;
}

/** Situação do pedido em três etapas (Enviado → Em análise → Aprovado/Recusado), com o horário de cada uma. */
export function LinhaDoTempo({ pedido }) {
  const etapas = etapasDoPedido(pedido);
  const cor = (e) => (e.estado === "feito" ? "bg-emerald-500" : e.estado === "recusado" ? "bg-rose-500" : "bg-ink-200");
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Situação</p>
      <ol className="grid grid-cols-3">
        {etapas.map((e, i) => (
          <li key={e.id} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : cor(e)}`} />
              <span className={`h-3 w-3 shrink-0 rounded-full ${cor(e)}`} />
              <span className={`h-0.5 flex-1 ${i === etapas.length - 1 ? "bg-transparent" : cor(etapas[i + 1])}`} />
            </div>
            <p className={`mt-1.5 text-[12px] font-semibold ${e.estado === "pendente" ? "text-ink-400" : "text-ink-900"}`}>{e.nome}</p>
            <p className="text-[10.5px] text-ink-400">{e.quando ? quando(e.quando) : e.estado === "pendente" ? "—" : ""}</p>
          </li>
        ))}
      </ol>
      {pedido.resposta && <p className="mt-2 text-[12.5px] font-medium text-accent-600">{pedido.resposta}</p>}
    </div>
  );
}

/** A conversa de um pedido: balões (escritório de um lado, cliente do outro) e a caixa para escrever. */
export function Conversa({ pedido, onMudou }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    setEnviando(true);
    setErro("");
    try {
      await observarPedido(pedido.id, limpo);
      setTexto("");
      await onMudou?.();
    } catch (err) {
      setErro(err.message || "Não consegui enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-page p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400"><MessageSquare size={12} /> Conversa</p>
      {pedido.observacoes.length === 0 ? (
        <p className="text-[12.5px] text-ink-400">Nenhuma observação ainda. Escreva abaixo para o escritório ver.</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
          {pedido.observacoes.map((o) => (
            <li key={o.id} className={`flex ${o.autor === "escritorio" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] ${o.autor === "escritorio" ? "bg-accent-500/10 text-ink-900" : "bg-surface-card text-ink-900 shadow-sm"}`}>
                <p className="text-[11px] font-semibold text-ink-500">{o.autor === "escritorio" ? `Escritório${o.autor_nome ? ` · ${o.autor_nome}` : ""}` : o.autor_nome || "Cliente"} <span className="font-normal text-ink-400">· {quando(o.criado_em)}</span></p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{o.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex items-end gap-2">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(); }} rows={2} maxLength={1000} placeholder="Escrever uma observação… (Ctrl+Enter envia)" className={`${campo} resize-none`} />
        <button type="button" onClick={enviar} disabled={enviando || !texto.trim()} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 text-[12.5px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50"><Send size={13} /> Enviar</button>
      </div>
      {erro && <p className="mt-1.5 text-[12px] text-danger-600">{erro}</p>}
    </div>
  );
}

/** Um pedido: tipo, o que foi pedido, situação, a resposta do escritório e a conversa. */
export function CartaoDePedido({ pedido, onMudou, aberto: abertoInicial = false, mostrarAlvo = true }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const proposta = pedido.proposta || {};
  const nObs = pedido.observacoes.length;
  return (
    <div className="rounded-xl border border-line bg-surface-card">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-ink-600">{TIPOS_DE_PEDIDO[pedido.tipo]}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">{mostrarAlvo ? pedido.descricao || pedido.alvo : resumoDoPedido(pedido)}</span>
        {nObs > 0 && <span className="flex items-center gap-1 text-[11.5px] text-ink-400"><MessageSquare size={12} /> {nObs}</span>}
        <span className="text-[11.5px] text-ink-400">{quando(pedido.criado_em)}</span>
        <SeloDoStatus status={pedido.status} />
      </button>
      {aberto && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <LinhaDoTempo pedido={pedido} />
          <p className="mt-3 text-[13px] text-ink-700"><span className="text-ink-400">Pedido:</span> {resumoDoPedido(pedido)}{proposta.observacao ? ` — ${proposta.observacao}` : ""}</p>
          <Conversa pedido={pedido} onMudou={onMudou} />
        </div>
      )}
    </div>
  );
}

const reducaoTxt = (c) => (c.reducao != null ? (Number(c.reducao) === 100 ? "alíquota zero" : `redução de ${c.reducao}%`) : c.pRedIBS != null ? `IBS ${c.pRedIBS}% · CBS ${c.pRedCBS}%` : "");
const TOM_CONF = { alta: "bg-emerald-500/10 text-emerald-600", "média": "bg-amber-500/15 text-amber-600" };

// Quadro "condicional" da janela de decisão: quando o código pode mudar por uma condição da lei (coluna Condicional = Sim ou Depende), mostra cada código e o que a lei exige.
function QuadroCondicional({ cond, opcoes, complementos }) {
  if (!cond || cond === "—") return null;
  if (cond === "Não") {
    const cods = [...new Set(opcoes.flatMap((o) => (o.codigos || []).map((c) => c.cClassTrib)))];
    return <p className="text-[12.5px] text-ink-500"><b className="text-ink-700">Não condicional.</b> Um código só, para qualquer comprador{cods.length ? ` (${cods.join(", ")})` : ""}.</p>;
  }
  const anexos = [...new Set(opcoes.map((o) => o.anexo))];
  const condicaoDe = (anexo, c) => (complementos?.[anexo] || []).find((x) => x.artigo === c.lc214)?.condicao || "";
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-600"><AlertTriangle size={14} /> {cond === "Sim" ? "Produto condicional: o código pode mudar" : "Pode ser condicional: depende de qual item da lei descreve o produto"}</p>
      <p className="mt-1 text-[12.5px] text-ink-600">{cond === "Sim" ? "A tabela oficial prevê mais de um código; a diferença vem de uma condição da lei, quase sempre de quem compra." : "O NCM aparece em anexos diferentes. Escolha primeiro o item da lei que descreve o produto."}</p>
      {anexos.map((a) => {
        const codigos = opcoes.find((o) => o.anexo === a)?.codigos || [];
        return (
          <div key={a} className="mt-2.5">
            <p className="text-[12px] font-semibold text-ink-800">Anexo {a}: {codigos.length > 1 ? `${codigos.length} códigos possíveis` : "um código só"}</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {codigos.map((c, i) => (
                <li key={c.cClassTrib} className="text-[12px] text-ink-600">
                  <b className="tabular-nums text-ink-900">{c.cClassTrib}</b> · {reducaoTxt(c) || "ver tabela"}{c.lc214 ? <span className="text-ink-400"> · {c.lc214}</span> : null}
                  {codigos.length > 1 && <span className={`ml-1.5 rounded px-1.5 text-[10.5px] font-semibold ${i === 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{i === 0 ? "Padrão" : "Exceção"}</span>}
                  <br />{c.nome}
                  {condicaoDe(a, c) && <><br /><em className="text-ink-500">O que a lei exige: {condicaoDe(a, c)}</em></>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Janela "Pedir alteração": a mesma tela de decisão do escritório (itens da LC 214 que casam com o NCM, código na nota, situação, observação), só que o resultado é um pedido
 *  que o escritório analisa e responde na conversa do pedido. */
export function JanelaDeAlteracao({ produto, opcoes, lista, companyId, onFechar, onCriado }) {
  const d = produto.decisao;
  const [escolha, setEscolha] = useState(d?.anexo ? `${d.anexo}|${d.item}` : d?.cClassTrib === "000001" ? "integral" : d?.cClassTrib ? "outro" : "");
  const [outroCst, setOutroCst] = useState(d && !d.anexo && d.cClassTrib !== "000001" ? d.cst || "" : "");
  const [outroClass, setOutroClass] = useState(d && !d.anexo && d.cClassTrib !== "000001" ? d.cClassTrib || "" : "");
  const [codigoSel, setCodigoSel] = useState(d?.anexo ? d.cClassTrib || "" : "");
  const [status, setStatus] = useState(d?.status === "duvida" ? "duvida" : "decidido");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const tecla = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onFechar(); } };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
  }, [onFechar]);

  const itemEscolhido = opcoes.find((o) => o.k === escolha);
  const codigosDoAnexo = itemEscolhido?.codigos || [];
  const codigoAtual = codigosDoAnexo.find((c) => c.cClassTrib === codigoSel) || codigosDoAnexo[0] || null;
  const oficiais = lista.codigosOficiais || [];
  const outroOficial = escolha === "outro" && /^\d{6}$/.test(outroClass) && oficiais.length ? oficiais.find((c) => c.cClassTrib === outroClass) || false : null;
  const melhor = opcoes.length > 1 ? opcoes[0] : null;
  const temSugestao = melhor && ["alta", "média"].includes(melhor.confianca);
  const nadaSeParece = melhor && melhor.confianca === "nenhuma";
  const anexosDasOpcoes = [...new Set(opcoes.map((o) => o.anexo))].filter((a) => lista.complementos?.[a]?.length);

  function montar() {
    const base = { anexo: "", item: "", itemTexto: "", tratamento: "", ncmLei: "", cst: "", cClassTrib: "" };
    if (escolha === "integral") return { ...base, cst: "000", cClassTrib: "000001", tratamento: "tributação integral" };
    if (escolha === "outro") {
      const cst = outroCst.trim();
      const cc = outroClass.trim();
      if (!/^\d{3}$/.test(cst) || !/^\d{6}$/.test(cc)) return { erro: "CST tem 3 dígitos e cClassTrib tem 6." };
      if (cc.slice(0, 3) !== cst) return { erro: "Os 3 primeiros dígitos do cClassTrib devem ser iguais ao CST." };
      if (oficiais.length) {
        const oficial = oficiais.find((c) => c.cClassTrib === cc);
        if (!oficial) return { erro: `O cClassTrib ${cc} não existe na tabela oficial do Portal da NF-e.` };
        if (oficial.fim && new Date().toISOString().slice(0, 10) > oficial.fim) return { erro: `O cClassTrib ${cc} deixou de valer em ${oficial.fim.split("-").reverse().join("/")}.` };
      }
      return { ...base, cst, cClassTrib: cc, tratamento: "código informado pelo cliente" };
    }
    if (itemEscolhido) return { ...base, anexo: itemEscolhido.anexo, item: String(itemEscolhido.item), itemTexto: itemEscolhido.descricao, tratamento: itemEscolhido.rotulo || "", ncmLei: itemEscolhido.ncmLei || "", cst: codigoAtual?.cst || "", cClassTrib: codigoAtual?.cClassTrib || "" };
    if (status === "decidido") return { erro: "Escolha o item do anexo ou a tributação integral, ou marque “Em dúvida”." };
    return base;
  }

  async function enviar() {
    const r = montar();
    if (r.erro) { setErro(r.erro); return; }
    setEnviando(true);
    setErro("");
    try {
      await criarPedido({ companyId, tipo: "alteracao", alvo: alvoDoProduto(produto), descricao: produto.descricao, ncm: produto.ncm, unidade: produto.unidade || "UN", proposta: { ...r, status, observacao: obs.trim() } });
      await onCriado?.();
    } catch (err) {
      setErro(err.message || "Não consegui enviar o pedido.");
      setEnviando(false);
    }
  }

  const cartao = (sel) => `flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${sel ? "border-accent-500 bg-accent-500/5" : "border-line hover:bg-surface-muted/50"}`;
  const estab = lista.estabs?.[produto.emp];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-label="Pedir alteração de classificação" className="flex h-full max-h-[880px] w-full max-w-6xl flex-col rounded-2xl bg-surface-card shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">{produto.codigo} · NCM {ncmFormatado(produto.ncm)}{estab ? ` · ${estab}` : ""}</span>
            <h2 className="mt-0.5 text-[18px] font-semibold text-ink-900">{produto.descricao || "Produto sem descrição"}</h2>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-900"><X size={18} /></button>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[1.25fr_1fr] md:overflow-hidden">
          <div className="flex flex-col gap-3 p-6 md:overflow-y-auto md:border-r md:border-line">
            <QuadroCondicional cond={produto.cond} opcoes={opcoes} complementos={lista.complementos} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Itens da LC 214 que casam com este NCM ({opcoes.length})</p>
            {temSugestao && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-[12.5px] text-ink-700">
                <span><b>Sugestão:</b> Anexo {melhor.anexo}, item {melhor.item} (confiança {melhor.confianca}){melhor.palavras.length > 0 && <> — em comum com o produto: <i>{melhor.palavras.join(", ")}</i></>}. É só uma sugestão: confira o texto do item.</span>
                <button type="button" onClick={() => { setEscolha(melhor.k); setCodigoSel(""); }} className="rounded-lg bg-sky-500 px-3 py-1 text-[12px] font-semibold text-white hover:bg-sky-600">Usar a sugestão</button>
              </div>
            )}
            {nadaSeParece && <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-[12.5px] text-ink-700"><b>Nenhum item da lei se parece com a descrição deste produto.</b> O NCM casa com {opcoes.length} itens, mas o produto pode não ser nenhum deles (tributação integral): confira com o escritório.</p>}
            {anexosDasOpcoes.map((a) => (
              <div key={a} className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 text-[12.5px] text-ink-700">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">Condições do Anexo {a} (texto da lei)</p>
                {lista.complementos[a].map((c) => <p key={c.artigo} className="mt-1.5"><b>{c.artigo}:</b> {c.tratamento}. {c.condicao}</p>)}
              </div>
            ))}

            <div className="flex flex-col gap-2.5">
              {opcoes.map((o) => {
                const sel = escolha === o.k;
                const red = rotuloDaReducao(o.reducao, o.rotulo);
                return (
                  <label key={o.k} className={cartao(sel)}>
                    <input type="radio" name="cls" checked={sel} onChange={() => { setEscolha(o.k); setCodigoSel(""); }} className="mt-1 accent-[var(--color-accent-500)]" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <b className="text-[13px] text-ink-900">Anexo {o.anexo} · item {o.item}</b>
                        {red && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">{red}</span>}
                        {o.ncmLei && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-500">NCM na lei: {o.ncmLei}</span>}
                        {o.alinea && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-500">alínea {o.alinea}</span>}
                        {o === melhor && temSugestao && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TOM_CONF[o.confianca]}`}>Sugerido · {o.confianca}</span>}
                        {o.decididoManual && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-500">decisão atual do escritório</span>}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">{o.descricao}</p>
                      {o.palavras?.length > 0 && opcoes.length > 1 && <p className="mt-1 text-[11.5px] text-ink-400">em comum com o produto: {o.palavras.join(", ")}</p>}
                    </div>
                  </label>
                );
              })}
              <label className={cartao(escolha === "integral")}>
                <input type="radio" name="cls" checked={escolha === "integral"} onChange={() => setEscolha("integral")} className="mt-1 accent-[var(--color-accent-500)]" />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5"><b className="text-[13px] text-ink-900">Tributação integral</b><span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-500">000 · 000001</span></div>
                  <p className="mt-1 text-[12.5px] text-ink-600">Sem benefício da LC 214 para este produto.</p>
                </div>
              </label>
              <label className={cartao(escolha === "outro")}>
                <input type="radio" name="cls" checked={escolha === "outro"} onChange={() => setEscolha("outro")} className="mt-1 accent-[var(--color-accent-500)]" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[13px] text-ink-900">Outro código</b>
                    <input placeholder="CST (3)" maxLength={3} value={outroCst} onChange={(e) => { setEscolha("outro"); setOutroCst(e.target.value.replace(/\D/g, "")); }} className={`${campo} !w-28`} />
                    <input placeholder="cClassTrib (6)" maxLength={6} value={outroClass} onChange={(e) => { setEscolha("outro"); setOutroClass(e.target.value.replace(/\D/g, "")); }} className={`${campo} !w-36`} />
                  </div>
                  {outroOficial && <p className="mt-1.5 text-[11.5px] text-ink-500">Tabela oficial: {outroOficial.nome}{outroOficial.reducao != null ? (outroOficial.reducao === 100 ? " · alíquota zero" : outroOficial.reducao > 0 ? ` · redução de ${outroOficial.reducao}%` : "") : ""}</p>}
                  {outroOficial === false && <p className="mt-1.5 text-[11.5px] text-danger-600">Este código não existe na tabela oficial para NF-e.</p>}
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-6 md:overflow-y-auto">
            {itemEscolhido && codigosDoAnexo.length === 0 && <p className="text-[12.5px] text-danger-600">A tabela oficial não liga o Anexo {itemEscolhido.anexo} a nenhum código de NF-e. O pedido segue sem cClassTrib; o escritório confere.</p>}
            {codigoAtual && (
              <div className="rounded-xl border border-line p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Código na nota (tabela oficial{lista.versaoTabela ? `, versão ${lista.versaoTabela}` : ""})</p>
                <div className="mt-2 flex flex-col gap-2">
                  {codigosDoAnexo.map((c, i) => {
                    const sel = codigoAtual.cClassTrib === c.cClassTrib;
                    return (
                      <label key={c.cClassTrib} className={cartao(sel)}>
                        <input type="radio" name="cod" checked={sel} onChange={() => setCodigoSel(c.cClassTrib)} className="mt-1 accent-[var(--color-accent-500)]" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <b className="text-[13px] tabular-nums text-ink-900">{c.cst ? `CST ${c.cst} · ` : ""}cClassTrib {c.cClassTrib}</b>
                            {reducaoTxt(c) && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">{reducaoTxt(c)}</span>}
                            {c.lc214 && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-500">{c.lc214}</span>}
                            {i === 0 && codigosDoAnexo.length > 1 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">Padrão</span>}
                          </div>
                          <p className="mt-1 text-[12.5px] text-ink-600">{c.nome}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Situação</p>
              <div className="mt-1.5 inline-flex rounded-xl bg-surface-muted p-1 text-[12.5px]">
                {[["decidido", "Decidido"], ["duvida", "Em dúvida (perguntar ao escritório)"]].map(([id, nome]) => (
                  <button key={id} type="button" onClick={() => setStatus(id)} className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${status === id ? "bg-surface-card text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>{nome}</button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Observação (explique o motivo do pedido)</span>
              <textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} placeholder="Ex.: o produto é vendido para hospitais públicos; tem registro na Anvisa…" className={`${campo} mt-1.5 resize-none`} />
            </label>
            <p className="text-[12px] text-ink-400">O pedido vai para o escritório, que analisa e responde por aqui. A classificação só muda depois que o escritório aprovar.</p>
            {erro && <p className="text-[12.5px] text-danger-600">{erro}</p>}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-6 py-3.5">
          <button type="button" onClick={onFechar} className="rounded-lg border border-line-strong px-4 py-2 text-[13px] text-ink-600 hover:bg-surface-muted">Cancelar</button>
          <button type="button" onClick={enviar} disabled={enviando} className="rounded-lg bg-accent-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50">Pedir alteração</button>
        </footer>
      </div>
    </div>
  );
}

const PERFIS_PEDIDO = [["privado", "Privado"], ["publico", "Órgão público"], ["sus_cebas", "SUS com CEBAS"], ["verificar", "A verificar"]];

/** Formulário "pedir perfil de comprador". */
export function FormPerfil({ cliente, companyId, onCriado, onCancelar }) {
  const [tipo, setTipo] = useState(cliente.perfil?.tipo || "");
  const [validade, setValidade] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    if (!tipo) { setErro("Escolha o perfil."); return; }
    if (tipo === "sus_cebas" && !validade) { setErro("Informe a validade do CEBAS."); return; }
    setEnviando(true);
    setErro("");
    try {
      await criarPedido({ companyId, tipo: "perfil", alvo: cliente.chave, descricao: cliente.nome, proposta: { tipo, cebasValidade: tipo === "sus_cebas" ? validade : "", comprovante, observacao } });
      await onCriado?.();
    } catch (err) {
      setErro(err.message || "Não consegui enviar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-xl border border-accent-500/40 bg-surface-card p-4">
      <p className="text-[13px] font-semibold text-ink-900">Pedir o perfil deste comprador</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PERFIS_PEDIDO.map(([id, nome]) => (
          <button key={id} type="button" onClick={() => setTipo(id)} className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${tipo === id ? "border-accent-500 bg-accent-500 text-white" : "border-line text-ink-600 hover:bg-surface-muted"}`}>{nome}</button>
        ))}
      </div>
      {tipo === "sus_cebas" && (
        <label className={`${rotulo} mt-3 max-w-xs`}>Validade do CEBAS
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={`${campo} mt-1`} />
        </label>
      )}
      <label className={`${rotulo} mt-3`}>Comprovante (de onde vem a informação)
        <input value={comprovante} onChange={(e) => setComprovante(e.target.value)} maxLength={240} className={`${campo} mt-1`} placeholder="Ex.: certidão, portaria, consulta ao CNPJ…" />
      </label>
      <label className={`${rotulo} mt-3`}>Observação
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} maxLength={500} className={`${campo} mt-1 resize-none`} />
      </label>
      {erro && <p className="mt-2 text-[12px] text-danger-600">{erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-lg border border-line-strong px-3.5 py-1.5 text-[12.5px] text-ink-600 hover:bg-surface-muted">Cancelar</button>
        <button type="button" onClick={enviar} disabled={enviando} className="rounded-lg bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50">Enviar pedido</button>
      </div>
    </div>
  );
}

/** Formulário "cadastrar produto novo". */
export function FormNovoProduto({ companyId, onCriado, onCancelar }) {
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ncm, setNcm] = useState("");
  const [unidade, setUnidade] = useState("UN");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    if (!codigo.trim() || !descricao.trim()) { setErro("Informe o código e a descrição."); return; }
    if (ncm.replace(/\D/g, "").length !== 8) { setErro("O NCM precisa ter 8 dígitos."); return; }
    setEnviando(true);
    setErro("");
    try {
      await criarPedido({ companyId, tipo: "novo", alvo: codigo.trim(), descricao: descricao.trim(), ncm, unidade, proposta: { observacao } });
      await onCriado?.();
    } catch (err) {
      setErro(err.message || "Não consegui enviar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_100px]">
        <label className={rotulo}>Código do produto *<input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={60} className={`${campo} mt-1`} /></label>
        <label className={rotulo}>NCM (8 dígitos) *<input value={ncm} onChange={(e) => setNcm(e.target.value)} inputMode="numeric" maxLength={10} placeholder="9021.39.30" className={`${campo} mt-1`} /></label>
        <label className={rotulo}>Unidade<input value={unidade} onChange={(e) => setUnidade(e.target.value.toUpperCase())} maxLength={6} className={`${campo} mt-1`} /></label>
      </div>
      <label className={rotulo}>Descrição *<input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} className={`${campo} mt-1`} /></label>
      <label className={rotulo}>Observação<textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} maxLength={500} className={`${campo} mt-1 resize-none`} placeholder="Ex.: produto novo da linha X, ainda sem vendas." /></label>
      {erro && <p className="text-[12px] text-danger-600">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className="rounded-lg border border-line-strong px-3.5 py-1.5 text-[12.5px] text-ink-600 hover:bg-surface-muted">Cancelar</button>
        <button type="button" onClick={enviar} disabled={enviando} className="rounded-lg bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-600 disabled:opacity-50">Enviar pedido de cadastro</button>
      </div>
    </div>
  );
}

