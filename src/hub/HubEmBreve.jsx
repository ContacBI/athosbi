import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Calculator, CalendarClock, Sparkles } from "lucide-react";
import { AREAS_DO_HUB } from "../lib/hub.js";
import Mosaico from "./Mosaico.jsx";
import { Revelar } from "./efeitos.jsx";

const ICONE = { servicos: CalendarClock, conteudos: BookOpen, ferramentas: Calculator };

// Área que ainda não tem conteúdo: conta o que vai ter ali, sem número inventado.
export default function HubEmBreve({ area: id }) {
  const navigate = useNavigate();
  const area = AREAS_DO_HUB.find((item) => item.id === id);
  if (!area) return null;
  const Icone = ICONE[id] || Sparkles;
  return (
    <section className="mx-auto grid max-w-[1320px] gap-14 px-5 pb-10 pt-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
      <div>
        <Revelar className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--hub-acento-suave)] text-[var(--hub-acento)]">
            <Icone size={22} />
          </span>
          <span className="hub-selo">Em construção</span>
        </Revelar>
        <Revelar atraso={0.06}>
          <h1 className="hub-display mt-6 text-[44px] font-extrabold leading-[1.03] sm:text-[60px]">
            {area.nome}
            <span className="hub-italico">.</span>
          </h1>
        </Revelar>
        <Revelar atraso={0.12}>
          <p className="mt-5 max-w-[520px] text-[18px] leading-relaxed text-[var(--hub-texto-2)]">{area.resumo}</p>
        </Revelar>
        <Revelar atraso={0.18}>
          <p className="hub-rotulo mt-12">O que vai ter aqui</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {area.itens.map((item) => (
              <li key={item} className="hub-cartao flex items-start gap-3 rounded-2xl p-4 text-[14.5px] font-semibold leading-snug">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[var(--hub-acento)]" />
                {item}
              </li>
            ))}
          </ul>
        </Revelar>
        <Revelar atraso={0.24}>
          <button type="button" onClick={() => navigate("/hub")} className="hub-botao hub-botao-fantasma mt-10">
            <ArrowLeft size={16} /> Voltar ao início
          </button>
        </Revelar>
      </div>
      <Revelar atraso={0.1} className="relative mx-auto hidden w-full max-w-[420px] self-center lg:block">
        <div className="absolute -inset-8 rounded-full blur-3xl" style={{ background: "radial-gradient(circle at 70% 70%, rgba(232,105,31,0.18), transparent 60%)" }} />
        <Mosaico colunas={5} linhas={5} degraus={2} className="relative" />
      </Revelar>
    </section>
  );
}
