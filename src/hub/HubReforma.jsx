import { useState } from "react";
import { ArrowDown, ChevronDown, CircleDollarSign, FileText, HandCoins, Landmark, MapPin, Percent, Receipt, ShieldAlert, Split, Store, Wheat } from "lucide-react";
import LinhaDaReforma from "./LinhaDaReforma.jsx";
import Mosaico from "./Mosaico.jsx";
import { Revelar, Secao, moverLuz } from "./efeitos.jsx";

// Reforma Tributária no hub: só informação (sem simulador), a partir da
// EC 132/2023 e da LC 214/2025. Quando algo ainda depende de regulamentação,
// o texto diz isso em vez de cravar número.

const MUDANCAS = [
  { icone: Landmark, titulo: "Dois tributos no lugar de cinco", texto: "CBS (federal) e IBS (estados e municípios) substituem PIS, Cofins, IPI, ICMS e ISS — o chamado IVA dual." },
  { icone: Receipt, titulo: "Crédito amplo", texto: "O imposto pago nas compras da empresa vira crédito para abater do imposto das vendas. Acaba o efeito cascata." },
  { icone: MapPin, titulo: "Cobrado no destino", texto: "O imposto passa a ficar com o estado e o município onde o produto ou o serviço é consumido, não onde é produzido." },
  { icone: ShieldAlert, titulo: "Imposto Seletivo", texto: "Um tributo à parte sobre produtos prejudiciais à saúde ou ao meio ambiente, como cigarros, bebidas alcoólicas e açucaradas." },
];

const TRATAMENTOS = [
  { icone: Wheat, titulo: "Alíquota zero", texto: "Itens da Cesta Básica Nacional de alimentos e alguns outros essenciais ficam sem IBS e CBS." },
  { icone: Percent, titulo: "Redução de 60%", texto: "Setores como saúde, educação, medicamentos, alimentos e insumos agropecuários pagam 40% da alíquota cheia." },
  { icone: Percent, titulo: "Redução de 30%", texto: "Serviços de profissões intelectuais regulamentadas, como as de contadores, advogados e engenheiros, pagam 70% da alíquota." },
  { icone: Store, titulo: "Simples Nacional", texto: "Continua. A empresa pode seguir na guia única ou recolher IBS e CBS pelo regime regular, para o cliente aproveitar o crédito inteiro." },
];

const NA_PRATICA = [
  { icone: FileText, titulo: "Nota fiscal com IBS e CBS", texto: "Desde 2026 as notas trazem os campos dos novos tributos. Cadastro de produtos e serviços bem feito passa a valer ainda mais." },
  { icone: Split, titulo: "Split payment", texto: "No pagamento eletrônico, a parte do imposto pode ser separada na hora e ir direto ao governo, sem passar pelo caixa da empresa." },
  { icone: HandCoins, titulo: "Cashback", texto: "Famílias de baixa renda inscritas no CadÚnico recebem de volta parte do imposto pago em itens como energia, água e gás." },
  { icone: CircleDollarSign, titulo: "Preço e margem", texto: "Com crédito amplo e alíquotas novas, o custo de cada compra e o preço de cada venda mudam — vale revisar a formação de preço." },
];

const PERGUNTAS = [
  {
    pergunta: "Em 2026 eu já pago CBS e IBS?",
    resposta: "2026 é um ano de teste. As alíquotas (0,9% de CBS e 0,1% de IBS) aparecem na nota, o valor pode ser compensado com PIS e Cofins, e quem cumpre as obrigações acessórias fica dispensado de recolher.",
  },
  { pergunta: "O que acontece com o ICMS e o ISS?", resposta: "Continuam até 2028. De 2029 a 2032 caem aos poucos (90%, 80%, 70% e 60%) enquanto o IBS sobe, e em 2033 deixam de existir." },
  { pergunta: "Qual vai ser a alíquota?", resposta: "Ainda não há número fechado: as alíquotas de referência são definidas ao longo da transição. O escritório acompanha e avisa quando forem publicadas." },
  {
    pergunta: "Minha empresa é do Simples. Muda alguma coisa?",
    resposta: "O Simples continua. A diferença é que a empresa pode optar por recolher IBS e CBS por fora, pelo regime regular — o que pode valer a pena se os seus clientes são empresas que querem o crédito. É uma decisão para estudar caso a caso.",
  },
  {
    pergunta: "O que eu preciso fazer agora?",
    resposta: "Emitir as notas com os novos campos, revisar o cadastro de produtos e serviços (NCM, NBS e a classificação tributária) e olhar com calma preço, contratos e fornecedores. Converse com a sua equipe na Athos sobre o impacto no seu negócio.",
  },
];

function Cartoes({ itens, colunas = "lg:grid-cols-4" }) {
  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${colunas}`}>
      {itens.map(({ icone: Icone, titulo, texto }, i) => (
        <Revelar key={titulo} atraso={i * 0.06}>
          <div onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo flex h-full flex-col gap-4 p-7">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
              <Icone size={20} />
            </span>
            <h3 className="hub-display text-[19px] font-bold leading-snug">{titulo}</h3>
            <p className="text-[14px] leading-relaxed text-[var(--hub-texto-2)]">{texto}</p>
          </div>
        </Revelar>
      ))}
    </div>
  );
}

function Pergunta({ pergunta, resposta, aberta, onAlternar }) {
  return (
    <div className="border-b border-[var(--hub-borda)] last:border-b-0">
      <button type="button" onClick={onAlternar} aria-expanded={aberta} className="flex w-full items-center justify-between gap-6 py-6 text-left">
        <span className="hub-display text-[18px] font-bold leading-snug sm:text-[20px]">{pergunta}</span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--hub-borda-forte)] text-[var(--hub-acento)] transition-transform duration-300 ${aberta ? "rotate-180" : ""}`}>
          <ChevronDown size={17} />
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${aberta ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <p className="max-w-3xl pb-6 text-[15.5px] leading-relaxed text-[var(--hub-texto-2)]">{resposta}</p>
        </div>
      </div>
    </div>
  );
}

export default function HubReforma() {
  const [aberta, setAberta] = useState(0);
  return (
    <>
      <section className="mx-auto grid hub-largura items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:pt-16">
        <div>
          <Revelar>
            <p className="hub-rotulo">Reforma Tributária</p>
          </Revelar>
          <Revelar atraso={0.06}>
            <h1 className="hub-display mt-5 text-[42px] font-extrabold leading-[1.03] sm:text-[58px]">
              A maior mudança de impostos em décadas, <span className="hub-italico">sem mistério</span>
              <span className="hub-pontuacao">.</span>
            </h1>
          </Revelar>
          <Revelar atraso={0.12}>
            <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">Entre 2026 e 2033 o Brasil troca cinco tributos sobre o consumo por um sistema novo. Aqui fica o essencial: o que muda, quando muda e o que observar na sua empresa.</p>
          </Revelar>
          <Revelar atraso={0.18} className="mt-8 flex flex-wrap gap-3">
            <a href="#o-que-muda" className="hub-botao hub-botao-primario">
              O que muda <ArrowDown size={17} />
            </a>
            <a href="#perguntas" className="hub-botao hub-botao-fantasma">
              Perguntas frequentes
            </a>
          </Revelar>
        </div>
        <Revelar atraso={0.1} className="relative mx-auto hidden w-full max-w-[380px] lg:block">
          <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 70% 70%, rgba(232,105,31,0.2), transparent 60%)" }} />
          <Mosaico colunas={5} linhas={5} degraus={4} className="relative" />
        </Revelar>
      </section>

      <section className="mx-auto hub-largura px-5 sm:px-8">
        <Revelar>
          <div className="relative overflow-hidden rounded-[28px] border border-[var(--hub-borda)] bg-[var(--hub-cartao-solido)] px-7 py-10 shadow-[var(--hub-sombra)] sm:px-12">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#e8691f] to-[#f4a96f]" />
            <p className="hub-rotulo">Em uma frase</p>
            <p className="hub-display mt-4 max-w-4xl text-[24px] font-bold leading-snug sm:text-[30px]">
              PIS, Cofins, IPI, ICMS e ISS dão lugar a <span className="hub-italico">dois</span> tributos — CBS e IBS — e a um Imposto Seletivo, com crédito amplo e cobrança no destino.
            </p>
          </div>
        </Revelar>
      </section>

      <Secao className="mt-24 scroll-mt-28" rotulo="Em quatro ideias" titulo="O que" italico="muda" depois=".">
        <div id="o-que-muda" className="scroll-mt-28">
          <Cartoes itens={MUDANCAS} />
        </div>
      </Secao>

      <Secao className="mt-24" rotulo="Calendário" titulo="Quando" italico="muda" depois=".">
        <Revelar>
          <LinhaDaReforma />
        </Revelar>
      </Secao>

      <Secao className="mt-24" rotulo="Tratamentos diferenciados" titulo="Nem todo mundo paga" italico="igual" depois=".">
        <Cartoes itens={TRATAMENTOS} />
      </Secao>

      <Secao className="mt-24" rotulo="No dia a dia" titulo="O que muda" italico="na prática" depois=".">
        <Cartoes itens={NA_PRATICA} />
      </Secao>

      <Secao className="mt-24" rotulo="Perguntas frequentes" titulo="O que todo mundo" italico="pergunta" depois=".">
        <Revelar>
          <div id="perguntas" className="hub-cartao scroll-mt-28 px-7 sm:px-10">
            {PERGUNTAS.map((item, i) => (
              <Pergunta key={item.pergunta} {...item} aberta={aberta === i} onAlternar={() => setAberta(aberta === i ? -1 : i)} />
            ))}
          </div>
        </Revelar>
        <Revelar>
          <p className="mt-6 text-[13px] leading-relaxed text-[var(--hub-texto-3)]">Conteúdo informativo, com base na Emenda Constitucional 132/2023 e na Lei Complementar 214/2025. Pontos que ainda dependem de regulamentação podem mudar — para decisões da sua empresa, fale com a sua equipe na Athos.</p>
        </Revelar>
      </Secao>
    </>
  );
}
