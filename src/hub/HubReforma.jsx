import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Boxes, Briefcase, Check, ChevronDown, CircleDollarSign, Factory, FileText, HandCoins, Landmark, MapPin, Percent, Receipt, RotateCcw, Search, ShieldAlert, Split, Store, Tractor, Wheat } from "lucide-react";
import { ALVOS_DO_SELETIVO, ANOS_DA_REFORMA, ANTES_E_DEPOIS, FONTES_OFICIAIS, GLOSSARIO_DA_REFORMA, O_QUE_FAZER_AGORA, POR_TIPO_DE_EMPRESA, gravarFeitos, lerFeitos } from "../lib/reformaInformativa.js";
import LinhaDaReforma from "./LinhaDaReforma.jsx";
import Mosaico from "./Mosaico.jsx";
import { CadeiaDoCredito, SplitPayment } from "./ilustracoes.jsx";
import { Revelar, Secao, moverLuz } from "./efeitos.jsx";

// Reforma Tributária no hub: só informação (sem simulador), a partir da
// EC 132/2023 e da LC 214/2025. Quando algo ainda depende de regulamentação,
// o texto diz isso em vez de cravar número. O calendário ano a ano, o antes
// e depois, os tipos de empresa, o glossário, a lista do que fazer e as
// fontes ficam em lib/reformaInformativa.js; os desenhos, em ilustracoes.jsx.

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

const SOBRE_O_CREDITO = [
  { icone: FileText, titulo: "O crédito sai da nota", texto: "São o IBS e a CBS destacados na nota do fornecedor que viram crédito. Nota certa, crédito certo." },
  { icone: Boxes, titulo: "Vale para quase tudo", texto: "Não só a mercadoria: energia, aluguel, serviços e máquinas usados no negócio também geram crédito. Fica de fora o que é de uso pessoal." },
  { icone: Store, titulo: "Quem compra do Simples", texto: "Recebe crédito só do que o fornecedor recolheu no DAS — a não ser que ele opte por recolher IBS e CBS por fora." },
];

const COM_SPLIT_PAYMENT = [
  { titulo: "Hoje", texto: "O cliente paga a empresa, o dinheiro todo entra no caixa e o imposto sai depois, na guia." },
  { titulo: "Com split payment", texto: "No pagamento eletrônico — cartão, Pix, boleto —, a parte da CBS e do IBS pode ser separada na liquidação e ir direto para o governo. A empresa recebe o valor da venda." },
  { titulo: "O que observar", texto: "O dinheiro do imposto deixa de passar pelo caixa da empresa, o que mexe no capital de giro. A implantação é gradual, e os detalhes ainda dependem de regulamentação." },
];

const ICONE_DO_TIPO = { comercio: Store, industria: Factory, servicos: Briefcase, agro: Tractor, simples: Landmark };

const PERGUNTAS = [
  {
    pergunta: "Em 2026 eu já pago CBS e IBS?",
    resposta: "2026 é um ano de teste. As alíquotas (0,9% de CBS e 0,1% de IBS) aparecem na nota, o valor pode ser compensado com PIS e Cofins, e quem cumpre as obrigações acessórias fica dispensado de recolher.",
  },
  { pergunta: "O que acontece com o ICMS e o ISS?", resposta: "Continuam até 2028. De 2029 a 2032 caem aos poucos (90%, 80%, 70% e 60%) enquanto o IBS sobe, e em 2033 deixam de existir." },
  {
    pergunta: "Qual vai ser a alíquota?",
    resposta: "Ainda não há número fechado: as alíquotas de referência são definidas ao longo da transição. As estimativas do Ministério da Fazenda para a soma de CBS e IBS têm ficado entre 26% e 28%. O escritório acompanha e avisa quando forem publicadas.",
  },
  {
    pergunta: "Vou ter crédito de tudo o que comprar?",
    resposta: "De quase tudo o que é usado na atividade da empresa — é o crédito amplo. Ficam de fora os itens de uso ou consumo pessoal. E o crédito sai das notas dos fornecedores, por isso elas precisam vir certas.",
  },
  {
    pergunta: "Minha empresa é do Simples. Muda alguma coisa?",
    resposta: "O Simples continua. A diferença é que a empresa pode optar por recolher IBS e CBS por fora, pelo regime regular — o que pode valer a pena se os seus clientes são empresas que querem o crédito. É uma decisão para estudar caso a caso.",
  },
  {
    pergunta: "O que é split payment e quando começa?",
    resposta: "É o recolhimento na hora do pagamento: no pagamento eletrônico, a parte do imposto pode ser separada e enviada direto ao governo, sem passar pelo caixa da empresa. A implantação será gradual, e o calendário e os detalhes dependem de regulamentação.",
  },
  {
    pergunta: "O que é o Imposto Seletivo e quem paga?",
    resposta: "É um imposto federal que começa em 2027 e incide sobre produtos prejudiciais à saúde ou ao meio ambiente: produtos de tabaco, bebidas alcoólicas e açucaradas, veículos, embarcações e aeronaves, extração mineral e apostas. Quem não trabalha com esses itens não é afetado diretamente.",
  },
  {
    pergunta: "O preço para o meu cliente vai mudar?",
    resposta: "Não dá para cravar: depende do imposto que o produto carrega hoje, dos créditos ao longo da cadeia e das alíquotas que ainda serão fixadas. Por isso vale refazer as contas de preço item a item, com a sua equipe na Athos.",
  },
  {
    pergunta: "O que eu preciso fazer agora?",
    resposta: "Emitir as notas com os novos campos, revisar o cadastro de produtos e serviços (NCM, NBS e a classificação tributária) e olhar com calma preço, contratos e fornecedores. A lista \"O que fazer agora\", nesta página, ajuda a acompanhar. Converse com a sua equipe na Athos sobre o impacto no seu negócio.",
  },
];

const INDICE = [
  ["o-que-muda", "O que muda"],
  ["antes-e-depois", "Antes e depois"],
  ["calendario", "Ano a ano"],
  ["credito", "Como o crédito funciona"],
  ["split-payment", "Split payment"],
  ["por-tipo", "Por tipo de empresa"],
  ["o-que-fazer", "O que fazer agora"],
  ["glossario", "Glossário"],
  ["perguntas", "Perguntas"],
  ["fontes", "Fontes oficiais"],
];

const norm = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

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

// Cinco tributos de hoje → os três do sistema novo, e sobre o que incide o Seletivo.
function AntesEDepois() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
      <Revelar>
        <div className="hub-cartao h-full px-6 sm:px-8">
          {ANTES_E_DEPOIS.map((linha) => (
            <div key={linha.depois.sigla} className="grid gap-4 border-b border-[var(--hub-borda)] py-7 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)] md:items-center md:gap-6">
              <div>
                <p className="hub-rotulo !text-[10.5px]">Hoje</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {linha.hoje.length ? (
                    linha.hoje.map((tributo) => (
                      <span key={tributo.sigla} className="rounded-xl border border-[var(--hub-borda-forte)] bg-[var(--hub-fundo)] px-3 py-1.5">
                        <span className="block text-[15px] font-bold leading-tight">{tributo.sigla}</span>
                        <span className="block text-[11.5px] text-[var(--hub-texto-3)]">{tributo.esfera}</span>
                      </span>
                    ))
                  ) : (
                    <span className="rounded-xl border border-dashed border-[var(--hub-borda-forte)] px-3 py-2.5 text-[13px] text-[var(--hub-texto-3)]">Não existe hoje</span>
                  )}
                </div>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--hub-borda-forte)] text-[var(--hub-acento)] md:mt-6" aria-hidden="true">
                <ArrowDown size={16} className="md:hidden" />
                <ArrowRight size={16} className="hidden md:block" />
              </span>
              <div>
                <p className="hub-rotulo !text-[10.5px]">Depois</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8691f] to-[#f28a42] px-3 text-[16px] font-extrabold text-white shadow-[0_10px_22px_-12px_rgba(232,105,31,0.8)]">{linha.depois.sigla}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-snug">{linha.depois.nome}</span>
                    <span className="block text-[12.5px] text-[var(--hub-texto-3)]">{linha.depois.esfera}</span>
                  </span>
                </div>
                <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--hub-texto-2)]">{linha.quando}</p>
              </div>
            </div>
          ))}
        </div>
      </Revelar>
      <Revelar atraso={0.08}>
        <div className="hub-cartao flex h-full flex-col p-7 sm:p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
            <ShieldAlert size={20} />
          </span>
          <h3 className="hub-display mt-5 text-[22px] font-bold leading-snug">Sobre o que incide o Imposto Seletivo</h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">Um tributo à parte, só para bens e serviços prejudiciais à saúde ou ao meio ambiente:</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {ALVOS_DO_SELETIVO.map((alvo) => (
              <li key={alvo} className="rounded-full border border-[var(--hub-borda-forte)] bg-[var(--hub-fundo)] px-3.5 py-1.5 text-[13px] font-semibold">
                {alvo}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">A ideia é desestimular o consumo desses itens, e não arrecadar de todo mundo: quem não trabalha com eles não é afetado diretamente. Começa em 2027 e é cobrado uma única vez sobre cada bem ou serviço.</p>
          <p className="mt-auto pt-6 text-[13px] leading-relaxed text-[var(--hub-texto-3)]">As alíquotas de cada item ainda serão definidas.</p>
        </div>
      </Revelar>
    </div>
  );
}

// Os oito anos da transição, com o quanto ainda vale do ICMS e do ISS.
function AnoAAno() {
  const anoAtual = new Date().getFullYear();
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ANOS_DA_REFORMA.map((item, i) => {
        const atual = item.ano === anoAtual;
        return (
          <Revelar key={item.ano} atraso={(i % 4) * 0.05} className="h-full">
            <div className="hub-cartao flex h-full flex-col p-6" style={atual ? { borderColor: "var(--hub-acento)" } : undefined}>
              <div className="flex items-center justify-between gap-3">
                <p className="hub-display text-[28px] font-bold leading-none">{item.ano}</p>
                {atual && <span className="hub-selo hub-selo-vivo">Estamos aqui</span>}
              </div>
              <p className="mt-2 text-[15px] font-bold">{item.titulo}</p>
              <ul className="mt-3 space-y-2">
                {item.pontos.map((ponto) => (
                  <li key={ponto} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[var(--hub-texto-2)]">
                    <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-[2px] bg-[var(--hub-acento)]" aria-hidden="true" />
                    {ponto}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                <div className="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold text-[var(--hub-texto-3)]">
                  <span>ICMS e ISS</span>
                  <span className="tabular-nums">{item.icmsIss ? `${item.icmsIss}% das alíquotas de hoje` : "extintos"}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--hub-ilu-trilho)]">
                  <div className="h-full rounded-full bg-[var(--hub-ilu-marinho)]" style={{ width: `${item.icmsIss}%` }} />
                </div>
              </div>
            </div>
          </Revelar>
        );
      })}
    </div>
  );
}

// Um tipo de empresa por vez (abas): comércio, indústria, serviços, agro e Simples.
function PorTipoDeEmpresa() {
  const [ativo, setAtivo] = useState(POR_TIPO_DE_EMPRESA[0].id);
  const tipo = POR_TIPO_DE_EMPRESA.find((item) => item.id === ativo);
  const Icone = ICONE_DO_TIPO[tipo.id];
  const andar = (passo) => {
    const i = POR_TIPO_DE_EMPRESA.findIndex((item) => item.id === ativo);
    const proximo = POR_TIPO_DE_EMPRESA[(i + passo + POR_TIPO_DE_EMPRESA.length) % POR_TIPO_DE_EMPRESA.length];
    setAtivo(proximo.id);
    document.getElementById(`aba-tipo-${proximo.id}`)?.focus();
  };
  return (
    <Revelar>
      <div className="hub-cartao p-2.5 sm:p-3">
        <div
          role="tablist"
          aria-label="Tipo de empresa"
          className="flex flex-wrap gap-1.5 rounded-[18px] bg-[var(--hub-fundo)] p-1.5"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") andar(1);
            if (event.key === "ArrowLeft") andar(-1);
          }}
        >
          {POR_TIPO_DE_EMPRESA.map((item) => {
            const IconeDaAba = ICONE_DO_TIPO[item.id];
            const selecionada = item.id === ativo;
            return (
              <button
                key={item.id}
                id={`aba-tipo-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selecionada}
                aria-controls="painel-do-tipo"
                tabIndex={selecionada ? 0 : -1}
                onClick={() => setAtivo(item.id)}
                className={`flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-4 text-[14px] font-semibold transition-colors ${selecionada ? "bg-[var(--hub-cartao-solido)] text-[var(--hub-texto)] shadow-[var(--hub-sombra)]" : "text-[var(--hub-texto-2)] hover:text-[var(--hub-texto)]"}`}
              >
                <IconeDaAba size={16} className={selecionada ? "text-[var(--hub-acento)]" : ""} />
                {item.titulo}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" id="painel-do-tipo" aria-labelledby={`aba-tipo-${tipo.id}`} className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-12">
          <div>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e8691f] to-[#f28a42] text-white shadow-[0_12px_24px_-12px_rgba(232,105,31,0.8)]">
              <Icone size={24} />
            </span>
            <h3 className="hub-display mt-5 text-[28px] font-bold leading-tight">{tipo.titulo}</h3>
            <p className="mt-2 max-w-sm text-[15.5px] leading-relaxed text-[var(--hub-texto-2)]">{tipo.resumo}</p>
          </div>
          <ul className="space-y-4">
            {tipo.pontos.map((ponto) => (
              <li key={ponto} className="flex gap-3 text-[15px] leading-relaxed text-[var(--hub-texto-2)]">
                <Check size={17} className="mt-1 shrink-0 text-[var(--hub-acento)]" aria-hidden="true" />
                {ponto}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Revelar>
  );
}

// A lista do que fazer agora: quem lê pode ir marcando (fica só neste navegador).
function OQueFazerAgora() {
  const [feitos, setFeitos] = useState(() => lerFeitos());
  const atualizar = (novos) => {
    setFeitos(novos);
    gravarFeitos(novos);
  };
  const alternar = (id) => atualizar(feitos.includes(id) ? feitos.filter((item) => item !== id) : [...feitos, id]);
  const total = O_QUE_FAZER_AGORA.length;
  return (
    <Revelar>
      <div className="hub-cartao p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-[var(--hub-texto-2)]" aria-live="polite">
              <span className="hub-display mr-1 text-[28px] font-bold text-[var(--hub-texto)]">{feitos.length}</span> de {total} feitos
            </p>
            <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-[var(--hub-ilu-trilho)]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#e8691f] to-[#f4a96f] transition-[width] duration-500" style={{ width: `${(feitos.length / total) * 100}%` }} />
            </div>
          </div>
          {feitos.length > 0 && (
            <button type="button" onClick={() => atualizar([])} className="hub-botao hub-botao-fantasma hub-botao-p">
              <RotateCcw size={14} /> Desmarcar tudo
            </button>
          )}
        </div>
        <ul className="mt-7 grid gap-2.5 md:grid-cols-2">
          {O_QUE_FAZER_AGORA.map((item) => {
            const feito = feitos.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={feito}
                  onClick={() => alternar(item.id)}
                  className={`flex h-full w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors ${feito ? "border-[var(--hub-acento)] bg-[var(--hub-acento-suave)]" : "border-[var(--hub-borda)] bg-[var(--hub-fundo)] hover:border-[var(--hub-borda-forte)]"}`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${feito ? "border-[var(--hub-acento)] bg-[var(--hub-acento)] text-white" : "border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)]"}`}>
                    {feito && <Check size={15} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[15px] font-bold leading-snug ${feito ? "text-[var(--hub-texto-2)]" : ""}`}>{item.texto}</span>
                    <span className="mt-1 block text-[13.5px] leading-relaxed text-[var(--hub-texto-3)]">{item.detalhe}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-[12.5px] text-[var(--hub-texto-3)]">As marcações ficam guardadas só neste navegador.</p>
      </div>
    </Revelar>
  );
}

function Glossario() {
  const [termo, setTermo] = useState("");
  const itens = useMemo(() => [...GLOSSARIO_DA_REFORMA].sort((a, b) => a.termo.localeCompare(b.termo, "pt-BR")), []);
  const busca = norm(termo.trim());
  const visiveis = itens.filter((item) => !busca || norm(`${item.termo} ${item.definicao}`).includes(busca));
  return (
    <Revelar>
      <div className="hub-cartao p-6 sm:p-8">
        <label className="flex h-12 max-w-md items-center gap-3 rounded-full border border-[var(--hub-borda-forte)] bg-[var(--hub-fundo)] px-4 transition-colors focus-within:border-[var(--hub-acento)]">
          <Search size={16} className="shrink-0 text-[var(--hub-texto-3)]" />
          <input value={termo} onChange={(event) => setTermo(event.target.value)} placeholder="Buscar um termo" aria-label="Buscar no glossário" className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--hub-texto)] outline-none placeholder:text-[var(--hub-texto-3)]" />
        </label>
        <dl className="mt-6 grid gap-x-10 md:grid-cols-2">
          {visiveis.map((item) => (
            <div key={item.termo} className="border-t border-[var(--hub-borda)] py-5">
              <dt className="text-[15.5px] font-bold">{item.termo}</dt>
              <dd className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">{item.definicao}</dd>
            </div>
          ))}
        </dl>
        {visiveis.length === 0 && <p className="border-t border-[var(--hub-borda)] py-8 text-center text-[14px] text-[var(--hub-texto-3)]">Nenhum termo com "{termo.trim()}".</p>}
      </div>
    </Revelar>
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
        <Revelar as="nav" aria-label="Nesta página" className="mt-6 flex flex-wrap items-center gap-2">
          <span className="hub-rotulo mr-2 !text-[10.5px]">Nesta página</span>
          {INDICE.map(([id, nome]) => (
            <a key={id} href={`#${id}`} className="inline-flex h-9 items-center rounded-full border border-[var(--hub-borda)] bg-[var(--hub-cartao)] px-3.5 text-[13px] font-semibold text-[var(--hub-texto-2)] transition-colors hover:border-[var(--hub-acento)] hover:text-[var(--hub-texto)]">
              {nome}
            </a>
          ))}
        </Revelar>
      </section>

      <Secao id="o-que-muda" className="mt-24" rotulo="Em quatro ideias" titulo="O que" italico="muda" depois=".">
        <Cartoes itens={MUDANCAS} />
      </Secao>

      <Secao id="antes-e-depois" className="mt-24" rotulo="Antes e depois" titulo="Quem sai e quem" italico="entra" depois=".">
        <AntesEDepois />
      </Secao>

      <Secao id="calendario" className="mt-24" rotulo="Calendário" titulo="Quando" italico="muda" depois=".">
        <Revelar>
          <LinhaDaReforma />
        </Revelar>
        <Revelar>
          <h3 className="hub-display mt-12 text-[22px] font-bold">Ano a ano</h3>
        </Revelar>
        <AnoAAno />
      </Secao>

      <Secao id="credito" className="mt-24" rotulo="Não cumulatividade" titulo="Como o crédito" italico="funciona" depois=".">
        <Revelar>
          <p className="-mt-2 mb-8 max-w-3xl text-[16.5px] leading-relaxed text-[var(--hub-texto-2)]">Em cada etapa, o imposto é calculado sobre a venda inteira, mas a empresa abate o que já veio pago nas compras. Na prática, cada um paga só sobre o valor que agregou — e o imposto deixa de se acumular em cascata.</p>
        </Revelar>
        <Revelar>
          <CadeiaDoCredito />
        </Revelar>
        <div className="mt-5">
          <Cartoes itens={SOBRE_O_CREDITO} colunas="lg:grid-cols-3" />
        </div>
      </Secao>

      <Secao id="split-payment" className="mt-24" rotulo="Split payment" titulo="O imposto separado" italico="na hora" depois=".">
        <div className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div className="space-y-7 lg:pt-4">
            {COM_SPLIT_PAYMENT.map((item, i) => (
              <Revelar key={item.titulo} atraso={i * 0.06} className="flex gap-4">
                <span className="hub-display flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[15px] font-bold text-[var(--hub-acento)]">{i + 1}</span>
                <div>
                  <h3 className="text-[17px] font-bold">{item.titulo}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--hub-texto-2)]">{item.texto}</p>
                </div>
              </Revelar>
            ))}
          </div>
          <Revelar atraso={0.08}>
            <SplitPayment />
          </Revelar>
        </div>
      </Secao>

      <Secao id="tratamentos" className="mt-24" rotulo="Tratamentos diferenciados" titulo="Nem todo mundo paga" italico="igual" depois=".">
        <Cartoes itens={TRATAMENTOS} />
      </Secao>

      <Secao id="por-tipo" className="mt-24" rotulo="Para cada negócio" titulo="O que muda na" italico="sua empresa" depois=".">
        <PorTipoDeEmpresa />
      </Secao>

      <Secao id="na-pratica" className="mt-24" rotulo="No dia a dia" titulo="O que muda" italico="na prática" depois=".">
        <Cartoes itens={NA_PRATICA} />
      </Secao>

      <Secao id="o-que-fazer" className="mt-24" rotulo="Checklist" titulo="O que fazer" italico="agora" depois=".">
        <OQueFazerAgora />
      </Secao>

      <Secao id="glossario" className="mt-24" rotulo="Glossário" titulo="As palavras da" italico="reforma" depois=".">
        <Glossario />
      </Secao>

      <Secao id="perguntas" className="mt-24" rotulo="Perguntas frequentes" titulo="O que todo mundo" italico="pergunta" depois=".">
        <Revelar>
          <div className="hub-cartao px-7 sm:px-10">
            {PERGUNTAS.map((item, i) => (
              <Pergunta key={item.pergunta} {...item} aberta={aberta === i} onAlternar={() => setAberta(aberta === i ? -1 : i)} />
            ))}
          </div>
        </Revelar>
      </Secao>

      <Secao id="fontes" className="mt-24" rotulo="Fontes oficiais" titulo="Direto da" italico="fonte" depois=".">
        <div className="grid gap-5 md:grid-cols-3">
          {FONTES_OFICIAIS.map((fonte, i) => (
            <Revelar key={fonte.url} atraso={i * 0.06} className="h-full">
              <a href={fonte.url} target="_blank" rel="noreferrer" onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo group flex h-full flex-col p-7">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--hub-texto-3)]">{fonte.site}</span>
                  <ArrowUpRight size={18} className="text-[var(--hub-acento)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
                <span className="hub-display mt-4 block text-[20px] font-bold leading-snug">{fonte.titulo}</span>
                <span className="mt-2 block text-[14px] leading-relaxed text-[var(--hub-texto-2)]">{fonte.descricao}</span>
              </a>
            </Revelar>
          ))}
        </div>
        <Revelar>
          <p className="mt-6 text-[13px] leading-relaxed text-[var(--hub-texto-3)]">Conteúdo informativo, com base na Emenda Constitucional 132/2023 e na Lei Complementar 214/2025. Pontos que ainda dependem de regulamentação podem mudar — para decisões da sua empresa, fale com a sua equipe na Athos.</p>
        </Revelar>
        <Revelar className="mt-10">
          <Link to="/hub/conteudos" onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo group flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:p-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
              <BookOpen size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">Conteúdos</span>
              <span className="mt-1 block text-[14.5px] leading-relaxed text-[var(--hub-texto-2)]">Entenda a DRE, o balanço, o fluxo de caixa e os indicadores da empresa, com exemplos desenhados.</span>
            </span>
            <span className="inline-flex items-center gap-2 text-[14.5px] font-bold text-[var(--hub-acento)]">
              Ler os guias <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Link>
        </Revelar>
      </Secao>
    </>
  );
}
