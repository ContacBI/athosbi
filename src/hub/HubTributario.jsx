import { useNavigate } from "react-router-dom";
import { ArrowRight, Boxes, FileSearch, Landmark, MapPin, Receipt, ShieldAlert } from "lucide-react";
import LinhaDaReforma from "./LinhaDaReforma.jsx";
import Mosaico from "./Mosaico.jsx";
import { Revelar, Secao, moverLuz } from "./efeitos.jsx";

// O que muda com a Reforma (EC 132/2023 e LC 214/2025), em quatro ideias.
const MUDANCAS = [
  { icone: Landmark, titulo: "Dois tributos no lugar de cinco", texto: "CBS (federal) e IBS (estados e municípios) substituem PIS, Cofins, IPI, ICMS e ISS — o chamado IVA dual." },
  { icone: Receipt, titulo: "Crédito amplo", texto: "O imposto pago nas compras da empresa vira crédito para abater do imposto das vendas. Acaba o efeito cascata." },
  { icone: MapPin, titulo: "Cobrado no destino", texto: "O imposto passa a ficar com o estado e o município onde o produto ou o serviço é consumido, não onde é produzido." },
  { icone: ShieldAlert, titulo: "Imposto Seletivo", texto: "Um tributo à parte sobre produtos prejudiciais à saúde ou ao meio ambiente, como cigarro, bebidas alcoólicas e açucaradas." },
];

const DO_SIMULADOR = [
  { icone: Boxes, titulo: "Produto a produto", texto: "Cada item vendido e comprado, com a alíquota de hoje e a da Reforma lado a lado." },
  { icone: FileSearch, titulo: "Sugestão pela LC 214", texto: "Pelo NCM ou NBS, o simulador sugere o tratamento previsto na lei: redução, alíquota zero ou regime específico." },
  { icone: Receipt, titulo: "Direto das notas", texto: "Vendas e compras podem vir das notas fiscais que o escritório já tem, sem digitar tudo de novo." },
];

export default function HubTributario() {
  const navigate = useNavigate();
  return (
    <>
      <section className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:pt-16">
        <div>
          <Revelar>
            <p className="hub-rotulo">Tributário · Reforma Tributária</p>
          </Revelar>
          <Revelar atraso={0.06}>
            <h1 className="hub-display mt-5 text-[42px] font-extrabold leading-[1.03] sm:text-[58px]">
              A maior mudança de impostos em décadas, <span className="hub-italico">sem mistério</span>
              <span className="hub-pontuacao">.</span>
            </h1>
          </Revelar>
          <Revelar atraso={0.12}>
            <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[var(--hub-texto-2)]">Entre 2026 e 2033 o Brasil troca cinco tributos sobre o consumo por um sistema novo. Aqui fica o que muda, quando muda e quanto isso pesa na sua empresa.</p>
          </Revelar>
          <Revelar atraso={0.18} className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate("/reforma")} className="hub-botao hub-botao-primario">
              Abrir o simulador <ArrowRight size={17} />
            </button>
            <a href="#o-que-muda" className="hub-botao hub-botao-fantasma">
              O que muda
            </a>
          </Revelar>
        </div>
        <Revelar atraso={0.1} className="relative mx-auto hidden w-full max-w-[380px] lg:block">
          <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 70% 70%, rgba(232,105,31,0.2), transparent 60%)" }} />
          <Mosaico colunas={5} linhas={5} degraus={4} className="relative" />
        </Revelar>
      </section>

      <Secao rotulo="Em quatro ideias" titulo="O que" italico="muda" depois="." className="scroll-mt-28" >
        <div id="o-que-muda" className="grid scroll-mt-28 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MUDANCAS.map(({ icone: Icone, titulo, texto }, i) => (
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
      </Secao>

      <Secao className="mt-24" rotulo="Calendário" titulo="Quando" italico="muda" depois=".">
        <Revelar>
          <LinhaDaReforma />
        </Revelar>
      </Secao>

      <Secao
        className="mt-24"
        rotulo="Simulador"
        titulo="Quanto pesa na"
        italico="sua empresa"
        depois="."
        acao={
          <button type="button" onClick={() => navigate("/reforma")} className="hub-botao hub-botao-primario">
            Abrir o simulador <ArrowRight size={16} />
          </button>
        }
      >
        <div className="grid gap-5 md:grid-cols-3">
          {DO_SIMULADOR.map(({ icone: Icone, titulo, texto }, i) => (
            <Revelar key={titulo} atraso={i * 0.06}>
              <div onPointerMove={moverLuz} className="hub-cartao hub-cartao-vivo flex h-full gap-4 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--hub-borda)] bg-[var(--hub-fundo)] text-[var(--hub-acento)]">
                  <Icone size={19} />
                </span>
                <div>
                  <h3 className="text-[16px] font-bold">{titulo}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--hub-texto-2)]">{texto}</p>
                </div>
              </div>
            </Revelar>
          ))}
        </div>
      </Secao>
    </>
  );
}
