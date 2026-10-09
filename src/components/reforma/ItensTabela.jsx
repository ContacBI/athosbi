import { useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { CATEGORIAS, SIMPLES_ANEXOS } from "../../lib/reforma/parametros.js";
import { novaCompra, novaVenda, novoId, padraoCompra } from "../../lib/reforma/calculo.js";
import { AJUDA, AJUDA_CATEGORIA } from "../../lib/reforma/textos.js";
import { Cartao, Dica, NumeroInput, RotuloDica, Selecao, TextoInput, botaoSecundario } from "./ui.jsx";
import SugestaoLc214 from "./SugestaoLc214.jsx";
import { reais } from "../../lib/reforma/formato.js";

const OPCOES_CATEGORIA = CATEGORIAS.map((categoria) => ({ valor: categoria.id, rotulo: categoria.nome }));
const th = "whitespace-nowrap px-1.5 pb-2 text-left text-[11px] font-medium uppercase tracking-wide text-ink-400";
const td = "px-1.5 py-2 align-top";
const traco = <span className="flex h-8 items-center px-2 text-[12px] text-ink-300">—</span>;

// Cabeçalho com explicação ao passar o mouse.
function Th({ ajuda, children, className = "" }) {
  return (
    <th className={`${th} ${className}`}>
      <RotuloDica texto={ajuda} titulo={typeof children === "string" ? children : undefined}>
        {children}
      </RotuloDica>
    </th>
  );
}

function Acoes({ onDuplicar, onExcluir }) {
  return (
    <div className="flex h-8 items-center justify-end gap-0.5">
      <Dica texto="Duplicar a linha — útil pra dividir um grupo em produtos, ou testar outra tributação.">
        <button type="button" onClick={onDuplicar} aria-label="Duplicar" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-surface-muted hover:text-ink-700">
          <Copy size={13} />
        </button>
      </Dica>
      <Dica texto="Excluir a linha.">
        <button type="button" onClick={onExcluir} aria-label="Excluir" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger-600">
          <Trash2 size={13} />
        </button>
      </Dica>
    </div>
  );
}

// Seletor de categoria com a explicação da opção escolhida e a sugestão da
// LC 214 embaixo.
function Categoria({ item, tipo, codigo, onCategoria }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Dica texto={AJUDA_CATEGORIA[item.categoria]} className="w-full">
        <Selecao valor={item.categoria} onChange={onCategoria} opcoes={OPCOES_CATEGORIA} ariaLabel="Categoria na reforma" className="w-full" />
      </Dica>
      <SugestaoLc214 codigo={codigo} tipo={tipo} categoria={item.categoria} onAplicar={onCategoria} />
    </div>
  );
}

// Liga/desliga um crédito de hoje (ICMS, PIS/Cofins) — um checkbox com cara
// de etiqueta, pra caberem os dois na mesma coluna.
function ChipCredito({ rotulo, ligado, onMudar, ajuda }) {
  return (
    <Dica texto={ajuda}>
      <label
        className={`flex shrink-0 cursor-pointer select-none items-center gap-0.5 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10.5px] font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-300 ${
          ligado ? "border-accent-300 bg-accent-50 text-accent-700" : "border-line-strong text-ink-400 hover:text-ink-600"
        }`}
      >
        <input type="checkbox" checked={ligado} onChange={(event) => onMudar(event.target.checked)} className="sr-only" aria-label={`Crédito de ${rotulo} hoje`} />
        {ligado ? <Check size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={2.5} />}
        {rotulo}
      </label>
    </Dica>
  );
}

function acoesDaLista(lista, onLista) {
  return {
    mudar: (id, patch) => onLista(lista.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    duplicar: (id) => {
      const index = lista.findIndex((item) => item.id === id);
      const copia = { ...lista[index], id: novoId(id.startsWith("c") ? "c" : "v"), descricao: `${lista[index].descricao || "Item"} (cópia)` };
      onLista([...lista.slice(0, index + 1), copia, ...lista.slice(index + 1)]);
    },
    excluir: (id) => onLista(lista.filter((item) => item.id !== id)),
  };
}

function Vazio({ children }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-10 text-center text-[12.5px] text-ink-400">{children}</p>;
}

// Aba "Vendas": um item por produto/serviço (ou grupo com a mesma
// tributação). Colunas mudam com o regime (Simples tem anexo e ICMS-ST).
// Largura fixa nas colunas de número e a descrição ocupa o resto — na tela
// larga cabe tudo sem rolagem lateral.
export function VendasTabela({ dados, onVendas }) {
  const { mudar, duplicar, excluir } = acoesDaLista(dados.vendas, onVendas);
  const simples = dados.regime === "simples";
  const [verSeletivo, setVerSeletivo] = useState(false);
  // Linha recém-adicionada: entra com animação e já com o cursor no nome.
  const [novo, setNovo] = useState(null);
  const adicionar = (tipo) => {
    const item = novaVenda(dados, tipo);
    setNovo(item.id);
    onVendas([...dados.vendas, item]);
  };
  const comSeletivo = verSeletivo || dados.vendas.some((item) => Number(item.seletivo) > 0);
  const total = dados.vendas.reduce((soma, item) => soma + (Number(item.receita) || 0), 0);
  const colunas = [
    ["descricao", "auto"],
    ["tipo", 100],
    ["codigo", 116],
    ["receita", 146],
    ["b2b", 80],
    ["icms", 92],
    ...(simples ? [["anexo", 116], ["st", 64]] : [["ipi", 80]]),
    ["pis", 138],
    ["categoria", 206],
    ...(comSeletivo ? [["seletivo", 84]] : []),
    ["acoes", 64],
  ];
  const minimo = colunas.reduce((soma, [, largura]) => soma + (largura === "auto" ? 200 : largura), 0);
  return (
    <Cartao
      titulo="O que a empresa vende"
      subtitulo="Um item por produto ou serviço (ou por NCM). Valores por mês. Passe o mouse nos títulos das colunas pra ver o que cada uma significa."
      acoes={
        <>
          {!comSeletivo && (
            <Dica texto={AJUDA.vendaSeletivo}>
              <button type="button" onClick={() => setVerSeletivo(true)} className="h-8 rounded-md px-2 text-[12px] text-ink-500 hover:bg-surface-muted hover:text-ink-700">
                + Imposto Seletivo
              </button>
            </Dica>
          )}
          <button type="button" onClick={() => adicionar("mercadoria")} className={botaoSecundario}>
            <Plus size={14} />
            Produto
          </button>
          <button type="button" onClick={() => adicionar("servico")} className={botaoSecundario}>
            <Plus size={14} />
            Serviço
          </button>
        </>
      }
    >
      {dados.vendas.length === 0 ? (
        <Vazio>Nenhum item ainda. Adicione um produto ou serviço — ou traga das notas fiscais da Domínio.</Vazio>
      ) : (
        <div className="-mx-1.5 overflow-x-auto">
          <table className="w-full table-fixed border-collapse" style={{ minWidth: minimo }}>
            <colgroup>
              {colunas.map(([chave, largura]) => (
                <col key={chave} style={largura === "auto" ? undefined : { width: largura }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line">
                <Th ajuda={AJUDA.vendaDescricao}>Produto / serviço</Th>
                <Th ajuda={AJUDA.vendaTipo}>Tipo</Th>
                <Th ajuda={AJUDA.vendaCodigo}>NCM / NBS</Th>
                <Th ajuda={AJUDA.vendaReceita} className="text-right">
                  Faturamento / mês
                </Th>
                <Th ajuda={AJUDA.vendaB2b} className="text-right">
                  % p/ empresas
                </Th>
                <Th ajuda={AJUDA.vendaIcmsIss} className="text-right">
                  ICMS / ISS
                </Th>
                {simples ? (
                  <>
                    <Th ajuda={AJUDA.vendaAnexo}>Anexo</Th>
                    <Th ajuda={AJUDA.vendaIcmsSt} className="text-center">
                      ICMS-ST
                    </Th>
                  </>
                ) : (
                  <Th ajuda={AJUDA.vendaIpi} className="text-right">
                    IPI
                  </Th>
                )}
                <Th ajuda={AJUDA.vendaPisCofins}>PIS/Cofins</Th>
                <Th ajuda={AJUDA.vendaCategoria}>Na reforma</Th>
                {comSeletivo && (
                  <Th ajuda={AJUDA.vendaSeletivo} className="text-right">
                    Seletivo
                  </Th>
                )}
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.vendas.map((item) => (
                <tr key={item.id} className={`border-b border-line transition-colors last:border-0 hover:bg-surface-muted/40 ${item.id === novo ? "animate-entrar" : ""}`}>
                  <td className={td}>
                    <Dica texto={item.descricao && item.descricao.length > 34 ? item.descricao : ""} className="w-full">
                      <TextoInput valor={item.descricao} onChange={(descricao) => mudar(item.id, { descricao })} placeholder="Ex.: Anel de prata" className="w-full" ariaLabel="Produto ou serviço" autoFocus={item.id === novo} />
                    </Dica>
                  </td>
                  <td className={td}>
                    <Selecao
                      valor={item.tipo}
                      onChange={(tipo) => mudar(item.id, tipo === "servico" ? { tipo, iss: item.iss || 5, icms: 0, ipi: 0 } : { tipo, icms: item.icms || 18, iss: 0 })}
                      opcoes={[
                        { valor: "mercadoria", rotulo: "Produto" },
                        { valor: "servico", rotulo: "Serviço" },
                      ]}
                      ariaLabel="Tipo"
                      className="w-full"
                    />
                  </td>
                  <td className={td}>
                    <TextoInput valor={item.codigo} onChange={(codigo) => mudar(item.id, { codigo })} placeholder={item.tipo === "servico" ? "NBS" : "NCM"} className="w-full font-mono" ariaLabel="NCM ou NBS" />
                  </td>
                  <td className={td}>
                    <NumeroInput valor={item.receita} onChange={(receita) => mudar(item.id, { receita })} prefixo="R$" className="w-full" ariaLabel="Faturamento por mês" />
                  </td>
                  <td className={td}>
                    <NumeroInput valor={item.b2b} onChange={(b2b) => mudar(item.id, { b2b })} sufixo="%" casas={0} max={100} className="w-full" ariaLabel="Percentual vendido para empresas" />
                  </td>
                  <td className={td}>
                    {item.tipo === "servico" ? (
                      <NumeroInput valor={item.iss} onChange={(iss) => mudar(item.id, { iss })} sufixo="%" max={100} className="w-full" ariaLabel="ISS" />
                    ) : (
                      <NumeroInput valor={item.icms} onChange={(icms) => mudar(item.id, { icms })} sufixo="%" max={100} className="w-full" ariaLabel="ICMS" />
                    )}
                  </td>
                  {simples ? (
                    <>
                      <td className={td}>
                        <Selecao valor={item.anexo || dados.anexoPadrao} onChange={(anexo) => mudar(item.id, { anexo })} opcoes={Object.keys(SIMPLES_ANEXOS).map((id) => ({ valor: id, rotulo: `Anexo ${id}` }))} ariaLabel="Anexo do Simples" className="w-full" />
                      </td>
                      <td className={`${td} text-center`}>
                        {item.tipo === "servico" ? (
                          traco
                        ) : (
                          <span className="flex h-8 items-center justify-center">
                            <input type="checkbox" checked={Boolean(item.icmsSt)} onChange={(event) => mudar(item.id, { icmsSt: event.target.checked })} aria-label="ICMS por substituição tributária" />
                          </span>
                        )}
                      </td>
                    </>
                  ) : (
                    <td className={td}>{item.tipo === "servico" ? traco : <NumeroInput valor={item.ipi} onChange={(ipi) => mudar(item.id, { ipi })} sufixo="%" max={100} className="w-full" ariaLabel="IPI" />}</td>
                  )}
                  <td className={td}>
                    <Selecao
                      valor={item.pisCofins}
                      onChange={(pisCofins) => mudar(item.id, { pisCofins })}
                      opcoes={[
                        { valor: "normal", rotulo: "Normal" },
                        { valor: "monofasico", rotulo: "Monofásico" },
                        { valor: "zero", rotulo: "Alíquota zero" },
                      ]}
                      ariaLabel="PIS/Cofins"
                      className="w-full"
                    />
                  </td>
                  <td className={td}>
                    <Categoria item={item} tipo={item.tipo} codigo={item.codigo} onCategoria={(categoria) => mudar(item.id, { categoria })} />
                  </td>
                  {comSeletivo && (
                    <td className={td}>
                      <NumeroInput valor={item.seletivo} onChange={(seletivo) => mudar(item.id, { seletivo })} sufixo="%" max={100} className="w-full" ariaLabel="Imposto Seletivo" />
                    </td>
                  )}
                  <td className={td}>
                    <Acoes onDuplicar={() => duplicar(item.id)} onExcluir={() => excluir(item.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-1.5 pt-3 text-[12px] font-medium text-ink-500" colSpan={3}>
                  Total · {dados.vendas.length} {dados.vendas.length === 1 ? "item" : "itens"}
                </td>
                <td className="px-3 pt-3 text-right font-mono text-[12.5px] font-semibold tabular-nums text-ink-900">{reais(total, { centavos: true })}</td>
                <td colSpan={colunas.length - 4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Cartao>
  );
}

const TIPOS_COMPRA = [
  { valor: "mercadoria", rotulo: "Mercadoria" },
  { valor: "insumo", rotulo: "Insumo" },
  { valor: "servico", rotulo: "Serviço tomado" },
  { valor: "energia", rotulo: "Energia/telecom" },
  { valor: "aluguel", rotulo: "Aluguel" },
  { valor: "outros", rotulo: "Uso e consumo" },
];
const ncmMostrado = (ncm) => (/^\d{8}$/.test(String(ncm || "")) ? `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}` : ncm || "");

// Aba "Compras e despesas": o que gera (ou passa a gerar) crédito. Folha de
// pagamento não entra.
export function ComprasTabela({ dados, onCompras }) {
  const { mudar, duplicar, excluir } = acoesDaLista(dados.compras, onCompras);
  const regimeNormal = dados.regime !== "simples";
  const real = dados.regime === "real";
  const total = dados.compras.reduce((soma, item) => soma + (Number(item.valor) || 0), 0);
  const colunas = [
    ["descricao", "auto"],
    ["tipo", 150],
    ["ncm", 104],
    ["valor", 148],
    ["fornecedor", 120],
    ["aliquota", 96],
    ...(regimeNormal ? [["ipi", 80], ["creditos", real ? 128 : 76]] : []),
    ["categoria", 206],
    ["acoes", 64],
  ];
  const minimo = colunas.reduce((soma, [, largura]) => soma + (largura === "auto" ? 180 : largura), 0);
  const [novo, setNovo] = useState(null);
  const adicionar = () => {
    const item = novaCompra();
    setNovo(item.id);
    onCompras([...dados.compras, item]);
  };
  return (
    <Cartao
      titulo="O que a empresa compra"
      subtitulo="Compras e despesas com fornecedores, por mês. Na reforma quase tudo gera crédito de IBS/CBS — inclusive o que hoje não gera. Folha de pagamento não entra."
      acoes={
        <button type="button" onClick={adicionar} className={botaoSecundario}>
          <Plus size={14} />
          Compra / despesa
        </button>
      }
    >
      {dados.compras.length === 0 ? (
        <Vazio>Nenhuma compra ainda. Sem compras, a simulação não considera crédito nenhum.</Vazio>
      ) : (
        <div className="-mx-1.5 overflow-x-auto">
          <table className="w-full table-fixed border-collapse" style={{ minWidth: minimo }}>
            <colgroup>
              {colunas.map(([chave, largura]) => (
                <col key={chave} style={largura === "auto" ? undefined : { width: largura }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line">
                <Th ajuda={AJUDA.compraDescricao}>Descrição</Th>
                <Th ajuda={AJUDA.compraTipo}>Tipo</Th>
                <Th ajuda={AJUDA.compraNcm}>NCM</Th>
                <Th ajuda={AJUDA.compraValor} className="text-right">
                  Valor / mês
                </Th>
                <Th ajuda={AJUDA.compraFornecedor}>Fornecedor</Th>
                <Th ajuda={AJUDA.compraAliquota} className="text-right">
                  ICMS / ISS
                </Th>
                {regimeNormal && (
                  <>
                    <Th ajuda={AJUDA.compraIpi} className="text-right">
                      IPI
                    </Th>
                    <Th ajuda={real ? `${AJUDA.compraCreditoIcms} ${AJUDA.compraCreditoPisCofins}` : AJUDA.compraCreditoIcms}>Créditos hoje</Th>
                  </>
                )}
                <Th ajuda={AJUDA.compraCategoria}>Na reforma</Th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dados.compras.map((item) => {
                const comMercadoria = ["mercadoria", "insumo"].includes(item.tipo);
                return (
                  <tr key={item.id} className={`border-b border-line transition-colors last:border-0 hover:bg-surface-muted/40 ${item.id === novo ? "animate-entrar" : ""}`}>
                    <td className={td}>
                      <Dica texto={item.descricao && item.descricao.length > 34 ? item.descricao : ""} className="w-full">
                        <TextoInput valor={item.descricao} onChange={(descricao) => mudar(item.id, { descricao })} placeholder="Ex.: Prata e insumos" className="w-full" ariaLabel="Descrição" autoFocus={item.id === novo} />
                      </Dica>
                    </td>
                    <td className={td}>
                      <Selecao valor={item.tipo} onChange={(tipo) => mudar(item.id, padraoCompra(tipo))} opcoes={TIPOS_COMPRA} ariaLabel="Tipo de compra" className="w-full" />
                    </td>
                    <td className={td}>
                      {comMercadoria ? (
                        <TextoInput valor={ncmMostrado(item.ncm)} onChange={(ncm) => mudar(item.id, { ncm: ncm.replace(/\D/g, "").slice(0, 8) })} placeholder="NCM" className="w-full font-mono" ariaLabel="NCM da compra" />
                      ) : (
                        traco
                      )}
                    </td>
                    <td className={td}>
                      <NumeroInput valor={item.valor} onChange={(valor) => mudar(item.id, { valor })} prefixo="R$" className="w-full" ariaLabel="Valor por mês" />
                    </td>
                    <td className={td}>
                      <Selecao
                        valor={item.fornecedor}
                        onChange={(fornecedor) => mudar(item.id, { fornecedor })}
                        opcoes={[
                          { valor: "normal", rotulo: "Normal" },
                          { valor: "simples", rotulo: "Simples" },
                          { valor: "semCredito", rotulo: "Pessoa física" },
                        ]}
                        ariaLabel="Fornecedor"
                        className="w-full"
                      />
                    </td>
                    <td className={td}>
                      <NumeroInput valor={item.aliquota} onChange={(aliquota) => mudar(item.id, { aliquota })} sufixo="%" max={100} className="w-full" ariaLabel="ICMS ou ISS embutido" />
                    </td>
                    {regimeNormal && (
                      <>
                        <td className={td}>{comMercadoria ? <NumeroInput valor={item.ipi} onChange={(ipi) => mudar(item.id, { ipi })} sufixo="%" max={100} className="w-full" ariaLabel="IPI" /> : traco}</td>
                        <td className={td}>
                          <div className="flex h-8 items-center gap-1">
                            {["mercadoria", "insumo", "energia"].includes(item.tipo) && (
                              <ChipCredito rotulo="ICMS" ligado={Boolean(item.creditoIcms)} onMudar={(creditoIcms) => mudar(item.id, { creditoIcms })} ajuda={AJUDA.compraCreditoIcms} />
                            )}
                            {real && <ChipCredito rotulo="PIS/Cof" ligado={item.creditoPisCofins !== false} onMudar={(creditoPisCofins) => mudar(item.id, { creditoPisCofins })} ajuda={AJUDA.compraCreditoPisCofins} />}
                            {!["mercadoria", "insumo", "energia"].includes(item.tipo) && !real && <span className="px-1 text-[12px] text-ink-300">—</span>}
                          </div>
                        </td>
                      </>
                    )}
                    <td className={td}>
                      <Categoria item={item} tipo="mercadoria" codigo={comMercadoria ? item.ncm : ""} onCategoria={(categoria) => mudar(item.id, { categoria })} />
                    </td>
                    <td className={td}>
                      <Acoes onDuplicar={() => duplicar(item.id)} onExcluir={() => excluir(item.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-1.5 pt-3 text-[12px] font-medium text-ink-500" colSpan={3}>
                  Total · {dados.compras.length} {dados.compras.length === 1 ? "linha" : "linhas"}
                </td>
                <td className="px-3 pt-3 text-right font-mono text-[12.5px] font-semibold tabular-nums text-ink-900">{reais(total, { centavos: true })}</td>
                <td colSpan={colunas.length - 4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Cartao>
  );
}
