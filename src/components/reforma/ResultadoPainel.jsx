import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORIAS } from "../../lib/reforma/parametros.js";
import { Cartao, Indicador, RotuloDica } from "./ui.jsx";
import { porcento, reais } from "../../lib/reforma/formato.js";
import { AJUDA, AJUDA_CATEGORIA } from "../../lib/reforma/textos.js";

const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map((categoria) => [categoria.id, categoria.nome]));
const rotuloAno = (ano) => (ano === "hoje" ? "Hoje" : String(ano));
const tributosAntigos = (linha) => linha.debitos.pisCofins + linha.debitos.icms + linha.debitos.iss + linha.debitos.ipi;
const totalCreditos = (linha) => Object.values(linha.creditos).reduce((soma, valor) => soma + valor, 0);
// Eixo com passos "redondos" (1, 2, 2,5 ou 5 × 10ⁿ) e rótulo com as casas
// que o passo pede — antes 1.300 aparecia como "1 mil" e 1.950 como "2 mil".
function eixo(valores) {
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(0, ...valores);
  const bruto = (maximo - minimo) / 4 || 1;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((fator) => fator * potencia).find((candidato) => candidato >= bruto);
  const ticks = [];
  for (let valor = Math.floor(minimo / passo) * passo; valor <= Math.ceil(maximo / passo) * passo + passo / 2; valor += passo) ticks.push(Math.round(valor * 100) / 100);
  return { ticks, dominio: [ticks[0], ticks[ticks.length - 1]] };
}
const compactar = (valor) => {
  const abs = Math.abs(valor);
  if (abs >= 1e6) return `${(valor / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1e3) return `${(valor / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mil`;
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};
const th = "whitespace-nowrap px-2 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-ink-400 first:text-left";
// Cabeçalho de coluna com explicação ao passar o mouse.
const Th = ({ ajuda, children }) => (
  <th className={th}>
    <RotuloDica texto={ajuda} titulo={typeof children === "string" ? children : undefined}>
      {children}
    </RotuloDica>
  </th>
);
const td = "whitespace-nowrap px-2 py-1.5 text-right font-mono text-[12.5px] tabular-nums text-ink-800 first:text-left first:font-sans";

// Efeito no resultado: positivo é bom pra empresa.
const tomDe = (valor) => (valor > 0.5 ? "positivo" : valor < -0.5 ? "negativo" : "neutro");
const efeito = (valor) => (Math.abs(valor) < 0.5 ? "sem mudança" : `${valor > 0 ? "+" : "−"}${reais(Math.abs(valor))}/mês`);

function GraficoAnos({ resultado }) {
  const { atual, hibrido } = resultado.cenarios;
  const dados = atual.anos.map((linha, index) => ({
    ano: rotuloAno(linha.ano),
    atual: linha.aRecolher,
    ...(hibrido ? { hibrido: hibrido.anos[index].aRecolher } : {}),
  }));
  const { ticks, dominio } = eixo(dados.flatMap((linha) => [linha.atual, linha.hibrido ?? 0]));
  return (
    <div className="h-[260px] w-full" role="img" aria-label="Tributos sobre consumo a recolher por mês, de hoje a 2033">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} axisLine={{ stroke: "var(--color-line)" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-400)" }} tickFormatter={compactar} axisLine={false} tickLine={false} width={64} ticks={ticks} domain={dominio} />
          <ReferenceLine y={0} stroke="var(--color-line-strong)" />
          <Tooltip
            cursor={{ fill: "var(--color-surface-muted)" }}
            formatter={(valor, nome) => [reais(valor, { centavos: true }), nome]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {hibrido && <Legend verticalAlign="top" height={26} iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--color-ink-600)" }} />}
          <Bar dataKey="atual" name={hibrido ? "Ficar no Simples" : "A recolher por mês"} fill="var(--color-viz-1)" radius={[4, 4, 0, 0]} maxBarSize={44} />
          {hibrido && <Bar dataKey="hibrido" name="Recolher IBS/CBS por fora" fill="var(--color-viz-2)" radius={[4, 4, 0, 0]} maxBarSize={44} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TabelaAnos({ cenario, simples }) {
  const temSeletivo = cenario.anos.some((linha) => linha.debitos.seletivo > 0.005);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Ano</th>
            <Th ajuda={AJUDA.tributosHoje}>Tributos de hoje</Th>
            {simples && <Th ajuda={AJUDA.das}>DAS (consumo)</Th>}
            <Th ajuda={AJUDA.cbs}>CBS</Th>
            <Th ajuda={AJUDA.ibs}>IBS</Th>
            {temSeletivo && <Th ajuda={AJUDA.seletivo}>Seletivo</Th>}
            <Th ajuda={AJUDA.creditos}>Créditos</Th>
            <Th ajuda={AJUDA.aRecolher}>A recolher</Th>
            <Th ajuda={AJUDA.carga}>Carga</Th>
            <Th ajuda={AJUDA.precoVar}>Preço p/ manter margem</Th>
            <Th ajuda={AJUDA.efeitoPrecoMantido}>Se mantiver o preço</Th>
          </tr>
        </thead>
        <tbody>
          {cenario.anos.map((linha) => (
            <tr key={linha.ano} className={`border-b border-line last:border-0 ${linha.ano === "hoje" ? "bg-surface-muted" : ""}`}>
              <td className={`${td} font-medium`}>{rotuloAno(linha.ano)}</td>
              <td className={td}>{reais(tributosAntigos(linha))}</td>
              {simples && <td className={td}>{reais(linha.debitos.das)}</td>}
              <td className={td}>{reais(linha.debitos.cbs)}</td>
              <td className={td}>{reais(linha.debitos.ibs)}</td>
              {temSeletivo && <td className={td}>{reais(linha.debitos.seletivo)}</td>}
              <td className={td}>{totalCreditos(linha) > 0.5 ? `−${reais(totalCreditos(linha))}` : reais(0)}</td>
              <td className={`${td} font-semibold text-ink-900`}>{reais(linha.aRecolher)}</td>
              <td className={td}>{porcento(linha.carga)}</td>
              <td className={td}>{linha.ano === "hoje" ? "—" : porcento(linha.precoVar, { sinal: true })}</td>
              <td className={td}>{linha.ano === "hoje" ? "—" : efeito(linha.efeitoPrecoMantido)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabelaItens({ resultado }) {
  const simples = Boolean(resultado.cenarios.hibrido);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Produto / serviço</th>
            <Th ajuda={AJUDA.vendaCategoria}>Na reforma</Th>
            <Th ajuda={AJUDA.vendaReceita}>Faturamento</Th>
            <Th ajuda={AJUDA.cargaItem}>Carga hoje</Th>
            <Th ajuda={`${AJUDA.cargaItem} Em 2033, só CBS + IBS (e Seletivo, se houver).`}>Carga 2033</Th>
            <Th ajuda={AJUDA.precoVar}>Preço p/ manter margem</Th>
            <Th ajuda={AJUDA.creditoCliente}>Crédito do cliente / R$ 100</Th>
          </tr>
        </thead>
        <tbody>
          {resultado.itens.map((item) => (
            <tr key={item.id} className="border-b border-line last:border-0">
              <td className={td}>
                <span className="block max-w-[640px] truncate text-[12.5px] text-ink-800" title={item.descricao}>
                  {item.descricao}
                </span>
                {item.codigo && <span className="font-mono text-[11px] text-ink-400">{item.codigo}</span>}
              </td>
              <td className={`${td} font-sans text-[12px] text-ink-600`} title={AJUDA_CATEGORIA[item.categoria]}>
                {NOME_CATEGORIA[item.categoria]}
              </td>
              <td className={td}>{reais(item.receita)}</td>
              <td className={td}>{porcento(item.cargaHoje)}</td>
              <td className={td}>{porcento(item.carga2033)}</td>
              <td className={td}>{porcento(item.precoVar, { sinal: true })}</td>
              <td className={td}>
                {reais(item.creditoClienteHoje, { centavos: true })} → {reais(item.creditoCliente2033, { centavos: true })}
                {simples && <span className="block text-[11px] text-ink-400">por fora: {reais(item.creditoCliente2033Hibrido, { centavos: true })}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparacaoSimples({ resultado }) {
  const { atual, hibrido } = resultado.cenarios;
  const ano = (cenario, valor) => cenario.anos.find((linha) => linha.ano === valor);
  const anos = [2027, 2033];
  const linhas = [
    { rotulo: "Tributos a recolher por mês", valor: (linha) => reais(linha.aRecolher) },
    { rotulo: "Preço ao consumidor final (manter margem)", valor: (linha) => (linha.precoConsumidorVar === null ? "—" : porcento(linha.precoConsumidorVar, { sinal: true })) },
    { rotulo: "Custo líquido do cliente empresa", valor: (linha) => (linha.custoClienteEmpresaVar === null ? "—" : porcento(linha.custoClienteEmpresaVar, { sinal: true })) },
    { rotulo: "Efeito das compras (créditos)", valor: (linha) => efeito(linha.efeitoCompras) },
    { rotulo: "Resultado se mantiver o preço", valor: (linha) => efeito(linha.efeitoPrecoMantido) },
  ];
  const fimSimples = ano(atual, 2033);
  const fimFora = ano(hibrido, 2033);
  const diferenca = fimFora.efeitoPrecoMantido - fimSimples.efeitoPrecoMantido;
  return (
    <Cartao
      titulo="Ficar no Simples × recolher IBS/CBS por fora"
      subtitulo="A partir de 2027 a empresa do Simples pode recolher IBS/CBS fora do DAS: o cliente empresa passa a tomar o crédito cheio e a empresa toma crédito das compras, mas o preço ao consumidor final sobe."
    >
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={th} />
              {anos.map((valor) => (
                <th key={`s${valor}`} className={th}>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-viz-1" />
                    Simples {valor}
                  </span>
                </th>
              ))}
              {anos.map((valor) => (
                <th key={`h${valor}`} className={th}>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-viz-2" />
                    Por fora {valor}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.rotulo} className="border-b border-line last:border-0">
                <td className={`${td} text-[12.5px]`}>{linha.rotulo}</td>
                {anos.map((valor) => (
                  <td key={`s${valor}`} className={td}>
                    {linha.valor(ano(atual, valor))}
                  </td>
                ))}
                {anos.map((valor) => (
                  <td key={`h${valor}`} className={td}>
                    {linha.valor(ano(hibrido, valor))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-[12.5px] text-ink-700">
        {Math.abs(diferenca) < 0.5
          ? "Em 2033, mantendo o preço, os dois caminhos dão o mesmo resultado no mês."
          : `Em 2033, mantendo o preço, o resultado do mês fica ${reais(Math.abs(diferenca))} melhor ${diferenca > 0 ? "recolhendo IBS/CBS por fora" : "ficando no Simples"}.`}{" "}
        Pra quem vende mais pra empresas, o crédito cheio pesa a favor de recolher por fora; pra quem vende ao consumidor final, ficar no Simples segura o preço.
      </p>
    </Cartao>
  );
}

// Aba "Resultado".
export default function ResultadoPainel({ resultado, params }) {
  const { atual, hibrido } = resultado.cenarios;
  const hoje = atual.anos[0];
  const fim = atual.anos[atual.anos.length - 1];
  if (!resultado.dados.vendas.length) {
    return (
      <Cartao titulo="Resultado">
        <p className="text-[13px] text-ink-500">Cadastre ao menos um produto ou serviço na aba Vendas pra ver a simulação.</p>
      </Cartao>
    );
  }
  const diffRecolher = fim.aRecolher - hoje.aRecolher;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Tributos sobre consumo / mês"
          valor={`${reais(hoje.aRecolher)} → ${reais(fim.aRecolher)}`}
          apoio={`Carga ${porcento(hoje.carga)} hoje → ${porcento(fim.carga)} em 2033 (${diffRecolher >= 0 ? "+" : "−"}${reais(Math.abs(diffRecolher))})`}
          tom={diffRecolher > 0.5 ? "negativo" : diffRecolher < -0.5 ? "positivo" : "neutro"}
          dica={`${AJUDA.aRecolher} Compara hoje com 2033, quando só existirem CBS e IBS. A carga é o a recolher ÷ preço ao cliente.`}
        />
        <Indicador
          rotulo="Preço p/ manter a margem (2033)"
          valor={porcento(fim.precoConsumidorVar ?? fim.precoVar, { sinal: true })}
          apoio={fim.custoClienteEmpresaVar !== null ? `Cliente empresa: custo líquido ${porcento(fim.custoClienteEmpresaVar, { sinal: true })}` : "Preço ao consumidor final"}
          dica={`${AJUDA.precoVar} O número grande é pro consumidor final; o "custo líquido" é pra quem compra como empresa e recupera o crédito.`}
        />
        <Indicador rotulo="Se mantiver o preço (2033)" valor={efeito(fim.efeitoPrecoMantido)} apoio="Efeito no resultado do mês, já com as compras" tom={tomDe(fim.efeitoPrecoMantido)} dica={AJUDA.efeitoPrecoMantido} />
        <Indicador
          rotulo="Compras (2033)"
          valor={efeito(fim.efeitoCompras)}
          apoio="Custo líquido das compras com o crédito amplo"
          tom={tomDe(fim.efeitoCompras)}
          dica="Quanto o custo das compras muda por mês em 2033: na reforma quase tudo dá crédito de CBS/IBS (inclusive serviço, energia e uso e consumo), o que costuma baratear o custo líquido."
        />
      </div>

      <Cartao titulo="Tributos a recolher por mês, ano a ano" subtitulo="Débitos menos créditos de tributos sobre consumo. Barra abaixo de zero = crédito a receber.">
        <GraficoAnos resultado={resultado} />
      </Cartao>

      {hibrido && <ComparacaoSimples resultado={resultado} />}

      <Cartao titulo={hibrido ? "Ano a ano — ficando no Simples" : "Ano a ano"} subtitulo="Valores por mês, mantendo o valor sem tributos (preço neutro).">
        <TabelaAnos cenario={atual} simples={Boolean(hibrido)} />
      </Cartao>
      {hibrido && (
        <Cartao titulo="Ano a ano — recolhendo IBS/CBS por fora" subtitulo="Mesmo cálculo, com o DAS sem a parte de PIS/Cofins e ICMS/ISS a partir de 2027.">
          <TabelaAnos cenario={hibrido} simples />
        </Cartao>
      )}

      <Cartao titulo="Produto a produto" subtitulo="Carga sobre o preço ao cliente e o crédito que um cliente empresa recupera.">
        <TabelaItens resultado={resultado} />
      </Cartao>

      <Cartao titulo="Premissas da simulação">
        <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-ink-600">
          <li>
            Alíquotas de referência estimadas: CBS {Number(params.cbs).toLocaleString("pt-BR")}% + IBS {Number(params.ibs).toLocaleString("pt-BR")}% (o Senado ainda fixa as definitivas).
          </li>
          <li>Cada empresa da cadeia mantém o valor sem tributos (preço neutro) — inclusive os fornecedores. A coluna "Se mantiver o preço" mostra o outro extremo: a empresa absorve a diferença.</li>
          <li>Cliente empresa no regime normal, tomando todo o crédito permitido (hoje, inclusive PIS/Cofins de 9,25%).</li>
          <li>Transição da LC 214/2025: 2026 é ano-teste compensado; 2027 CBS cheia e fim do PIS/Cofins e do IPI; 2029 a 2032 ICMS/ISS caem 10% ao ano; 2033 só CBS e IBS.</li>
          <li>Simples: quem fica mantém o DAS; quem recolhe por fora tira do DAS a parte de PIS/Cofins e a do ICMS/ISS que vira IBS. Compra de fornecedor do Simples gera crédito de cerca de {Number(params.creditoFornecedorSimples).toLocaleString("pt-BR")}% do valor.</li>
          <li>Fora da conta: cashback, créditos presumidos, regimes específicos (combustíveis, serviços financeiros, cooperativas), Zona Franca e benefícios fiscais de ICMS.</li>
        </ul>
      </Cartao>
    </div>
  );
}
