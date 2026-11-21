import { useState } from "react";
import { EyeOff, Lock } from "lucide-react";
import { kItem } from "../lib/visibilidade.js";

// "A tela do cliente" do Acesso dos clientes: uma maquete do site, com o menu e o que o cliente enxerga com o que está marcado agora (as mesmas regras de
// lib/visibilidade.js e lib/modulos.js). Dá pra clicar nas abas e subabas da maquete pra ver os itens de cada uma. Não carrega dado nenhum da empresa: os itens
// aparecem como cartões com o nome do item.
const MENU = [
  { id: "inicio", nome: "Início" },
  { id: "bi", nome: "Meu B.I." },
  { id: "reforma", nome: "Reforma Tributária" },
  { id: "servicos", nome: "Serviços" },
  { id: "conteudos", nome: "Conteúdos" },
  { id: "ferramentas", nome: "Ferramentas" },
];

// Barrinhas só pra o cartão parecer um gráfico (formas fixas, sem dado).
const FORMAS = [[40, 62, 48, 80, 66, 90], [70, 44, 58, 36, 52, 30], [30, 38, 55, 60, 78, 92], [82, 70, 76, 58, 64, 50]];

function Cartao({ titulo, indice, dica }) {
  const barras = FORMAS[indice % FORMAS.length];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <p className="truncate text-[11px] font-semibold text-slate-700">{titulo}</p>
      {dica && <p className="truncate text-[9.5px] text-slate-400">{dica}</p>}
      <div className="mt-2 flex h-9 items-end gap-1">
        {barras.map((h, i) => <span key={i} className="flex-1 rounded-sm bg-orange-300/70" style={{ height: `${h}%` }} />)}
      </div>
    </div>
  );
}

export default function PreviaCliente({ secao, nomeAlvo, abasVistas, ferramentasVistas, ferramentasPelaFicha, veBi, nomeWidget, semConfiguracao, textoFixa, areasOcultas }) {
  const [abaEscolhida, setAbaEscolhida] = useState(null);
  const [subEscolhida, setSubEscolhida] = useState(null);

  const aba = abasVistas.find((a) => a.id === abaEscolhida) || abasVistas[0] || null;
  const sub = aba ? aba.subs.find((s) => s.id === subEscolhida) || aba.subs[0] || null : null;
  const itens = aba ? (sub ? sub.widgets || [] : aba.subs.length ? [] : aba.widgets || []).filter((w) => veBi(kItem(aba.id, sub?.id, w.id))) : [];

  const menu = MENU.filter((m) => !areasOcultas.has(m.id) && (m.id === "bi" ? abasVistas.length > 0 : m.id === "ferramentas" ? ferramentasVistas.length > 0 : true));
  const ativo = MENU.some((m) => m.id === secao) ? secao : "bi";
  const oculta = areasOcultas.has(secao);
  const fixa = !oculta && MENU.some((m) => m.id === secao) && secao !== "bi" && secao !== "ferramentas";

  return (
    <aside className="hidden w-[460px] shrink-0 flex-col overflow-y-auto border-l border-line bg-surface-muted/40 p-4 xl:flex">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-accent-600">A tela do cliente</p>
        <span className="flex items-center gap-1 text-[10.5px] text-ink-400"><Lock size={11} /> prévia — não salva nada</span>
      </div>

      <div className="mt-2.5 overflow-hidden rounded-xl border border-line bg-slate-50 shadow-sm">
        {/* barra do navegador */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" />
          <span className="ml-2 truncate rounded bg-white px-2 py-0.5 text-[9.5px] text-slate-400">bi.athosconsultoriaempresarial.com</span>
        </div>

        {/* menu do site */}
        <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-2">
          <span className="mr-2 text-[11px] font-extrabold text-slate-800">Athos <span className="text-[8px] text-orange-500">HUB</span></span>
          {menu.map((m) => (
            <span key={m.id} className={`rounded-full px-2 py-1 text-[10px] font-medium ${m.id === ativo ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-500"}`}>{m.nome}</span>
          ))}
        </div>

        {/* cabeçalho da empresa */}
        <div className="border-b border-slate-200 bg-white px-3 py-2">
          <p className="truncate text-[10.5px] font-semibold text-slate-700">{nomeAlvo}</p>
        </div>

        {oculta && <EmptyTela texto="Esta área está escondida do menu do cliente: ele não a vê nem abre pelo endereço." />}
        {fixa && <EmptyTela texto={textoFixa || ""} />}

        {!oculta && !fixa && secao !== "ferramentas" && (
          <div className="min-h-[300px]">
            {!aba && <EmptyTela texto="O cliente não vê nenhuma aba do B.I. Marque ao menos uma à esquerda." />}
            {aba && (
              <>
                <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-3 py-1.5">
                  {abasVistas.map((a) => (
                    <button key={a.id} type="button" onClick={() => { setAbaEscolhida(a.id); setSubEscolhida(null); }} className={`rounded-full px-2.5 py-1 text-[10.5px] font-medium ${a.id === aba.id ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{a.name}</button>
                  ))}
                </div>
                {aba.subs.length > 0 && (
                  <div className="flex flex-wrap gap-3 border-b border-slate-200 bg-white px-3 py-1.5">
                    {aba.subs.map((s) => (
                      <button key={s.id} type="button" onClick={() => setSubEscolhida(s.id)} className={`border-b-2 pb-0.5 text-[10.5px] font-medium ${sub && s.id === sub.id ? "border-orange-500 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}>{s.name}</button>
                    ))}
                  </div>
                )}
                <div className="p-3">
                  {itens.length === 0 ? (
                    <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-[11px] text-slate-400"><EyeOff size={13} /> Nenhum item marcado {sub ? `em ${sub.name}` : `em ${aba.name}`}: o cliente vê esta {sub ? "subaba" : "aba"} vazia.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {itens.map((w, i) => <Cartao key={`${w.id}-${i}`} titulo={nomeWidget(w.id)} indice={i} dica={sub ? `${aba.name} · ${sub.name}` : aba.name} />)}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!oculta && !fixa && secao === "ferramentas" && (
          <div className="min-h-[300px] p-3">
            {ferramentasVistas.length === 0 && !ferramentasPelaFicha ? (
              <EmptyTela texto="O cliente não vê nenhuma ferramenta. Marque as que ele deve ter à esquerda." />
            ) : (
              <>
                <p className="mb-2 text-[11px] font-semibold text-slate-700">Ferramentas</p>
                <div className="grid grid-cols-2 gap-2">
                  {ferramentasVistas.map((m, i) => (
                    <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                      <p className="text-[11px] font-semibold text-slate-700">{m.nome}</p>
                      <p className="mt-0.5 text-[9.5px] leading-snug text-slate-400">{m.descricao}</p>
                      <span className="mt-2 block h-1 rounded bg-orange-300/70" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
                    </div>
                  ))}
                </div>
                {ferramentasPelaFicha && <p className="mt-3 text-[10.5px] text-slate-400">Sem lista da empresa: cada pessoa vê as ferramentas liberadas na ficha dela.</p>}
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-2.5 text-[11px] leading-snug text-ink-400">
        {semConfiguracao ? "Ainda sem configuração: o cliente vê tudo até você marcar e salvar. " : ""}
        O Início aparece sempre; as demais áreas você mostra ou esconde em cada seção. Clique nas abas da maquete para ver os itens de cada uma.
      </p>
    </aside>
  );
}

function EmptyTela({ texto }) {
  return <p className="flex min-h-[300px] items-center justify-center px-6 text-center text-[11.5px] text-slate-400">{texto}</p>;
}
