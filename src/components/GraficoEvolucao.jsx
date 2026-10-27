import { useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { rotuloMes, valorCheio, valorCurto, variacaoEntre } from "../lib/serieMensal.js";

// Um número do resumo mês a mês (aba "Evolução" da explicação no Início).
// Uma série só, sem legenda (o título diz o que é). Barras pros números do
// mês (receita, lucro, despesas…), linha pros saldos e percentuais (caixa,
// margem). Barra negativa em vermelho; o último mês em destaque e com o
// valor escrito; linha tracejada na média do período; passar o mouse mostra
// cada mês. Embaixo, "Ver em tabela" abre a mesma série com a variação de
// um mês pro outro.

function Dica({ active, payload, formato }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl bg-navy-950 px-3 py-2 text-[12px] text-white shadow-xl ring-1 ring-white/10">
      <p className="text-[11px] text-white/60">{item.rotulo}</p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums">{valorCheio(item.valor, formato)}</p>
      {item.variacao && <p className="mt-0.5 text-[11px] text-white/60">{item.variacao.texto} sobre o mês anterior</p>}
    </div>
  );
}

// Barra com a ponta arredondada só do lado do valor (presa na linha do zero).
function Barra(props) {
  const { payload, x, y, width, height } = props;
  if (payload?.valor == null || !height) return null;
  const negativa = payload.valor < 0;
  return <Rectangle x={x} y={y} width={width} height={height} radius={negativa ? [0, 0, 4, 4] : [4, 4, 0, 0]} fill={negativa ? "var(--color-danger-500)" : "var(--color-accent-500)"} fillOpacity={payload.ultimo ? 1 : 0.45} />;
}

export default function GraficoEvolucao({ serie, formato = "money", tipo = "barra" }) {
  const [tabela, setTabela] = useState(false);
  const dados = serie.map((item, index) => ({ ...item, rotulo: rotuloMes(item.mes), ultimo: index === serie.length - 1, variacao: index ? variacaoEntre(serie[index - 1].valor, item.valor, formato) : null }));
  const valores = dados.map((item) => item.valor).filter((valor) => valor != null);
  if (!valores.length) return <p className="py-14 text-center text-[13px] text-ink-400">Sem valores neste período.</p>;
  const media = valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
  const curto = (valor) => valorCurto(valor, formato);
  const muitos = dados.length > 8;

  const eixoX = <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "var(--color-ink-500)" }} axisLine={false} tickLine={false} interval={muitos ? "preserveStartEnd" : 0} tickMargin={8} />;
  const eixoY = <YAxis tick={{ fontSize: 10.5, fill: "var(--color-ink-400)" }} axisLine={false} tickLine={false} width={62} tickFormatter={curto} tickCount={5} domain={tipo === "linha" ? ["auto", "auto"] : [0, "auto"]} />;
  const grade = <CartesianGrid vertical={false} stroke="var(--color-line)" />;
  const linhaMedia = valores.length > 2 && <ReferenceLine y={media} stroke="var(--color-ink-300)" strokeDasharray="4 4" ifOverflow="extendDomain" />;
  const rotuloUltimo = (deslocar) =>
    function RotuloUltimo({ x, y, width = 0, index, value }) {
      if (index !== dados.length - 1 || value == null) return null;
      return (
        <text x={x + width / 2} y={deslocar(value, y)} textAnchor={width ? "middle" : "end"} fontSize={11.5} fontWeight={600} fill="var(--color-ink-900)" stroke="var(--color-surface-card)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">
          {curto(value)}
        </text>
      );
    };

  return (
    <div>
      <div className="h-60 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          {tipo === "linha" ? (
            <LineChart data={dados} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
              {grade}
              {eixoX}
              {eixoY}
              {linhaMedia}
              <Tooltip content={<Dica formato={formato} />} cursor={{ stroke: "var(--color-line-strong)", strokeDasharray: "3 3" }} />
              <Line type="monotone" dataKey="valor" stroke="var(--color-accent-500)" strokeWidth={2.25} dot={{ r: 4, fill: "var(--color-accent-500)", stroke: "var(--color-surface-card)", strokeWidth: 2 }} activeDot={{ r: 6, stroke: "var(--color-surface-card)", strokeWidth: 2 }} isAnimationActive={false} connectNulls>
                <LabelList dataKey="valor" content={rotuloUltimo((value, y) => y - 12)} />
              </Line>
            </LineChart>
          ) : (
            <BarChart data={dados} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
              {grade}
              {eixoX}
              {eixoY}
              {linhaMedia}
              <ReferenceLine y={0} stroke="var(--color-line-strong)" />
              <Tooltip content={<Dica formato={formato} />} cursor={{ fill: "var(--color-surface-muted)", radius: 6 }} />
              <Bar dataKey="valor" maxBarSize={40} shape={Barra} isAnimationActive={false}>
                <LabelList dataKey="valor" content={rotuloUltimo((value, y) => (value < 0 ? y + 16 : y - 7))} />
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className={tipo === "linha" ? "h-2.5 w-2.5 rounded-full bg-accent-500" : "h-2.5 w-2 rounded-[2px] bg-accent-500"} /> Mês mais recente
          </span>
          {valores.length > 2 && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-ink-300" /> Média do período
            </span>
          )}
        </p>
        <button type="button" onClick={() => setTabela((aberta) => !aberta)} aria-expanded={tabela} className="evolucao-tabela flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-600 transition-colors hover:bg-surface-muted hover:text-ink-900">
          <Table2 size={13.5} /> {tabela ? "Esconder tabela" : "Ver em tabela"}
          <ChevronDown size={13} className={`transition-transform ${tabela ? "rotate-180" : ""}`} />
        </button>
      </div>

      {tabela && (
        <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-line">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface-muted/70">
              <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-400">
                <th className="px-3.5 py-2 font-semibold">Mês</th>
                <th className="px-3.5 py-2 text-right font-semibold">Valor</th>
                <th className="px-3.5 py-2 text-right font-semibold">Sobre o mês anterior</th>
              </tr>
            </thead>
            <tbody>
              {[...dados].reverse().map((item) => (
                <tr key={item.mes} className="border-t border-line">
                  <td className={`px-3.5 py-2 ${item.ultimo ? "font-semibold text-ink-900" : "text-ink-600"}`}>{item.rotulo}</td>
                  <td className={`px-3.5 py-2 text-right tabular-nums ${item.valor < 0 ? "text-danger-600" : "text-ink-900"} ${item.ultimo ? "font-semibold" : ""}`}>{valorCheio(item.valor, formato)}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums text-ink-500">{item.variacao?.texto || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
