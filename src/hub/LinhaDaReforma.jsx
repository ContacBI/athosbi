import { LINHA_DA_REFORMA, andamentoDaReforma } from "../lib/hub.js";

// Os quatro marcos da transição, com o trilho laranja até onde estamos.
export default function LinhaDaReforma({ hoje = new Date() }) {
  const andamento = andamentoDaReforma(hoje);
  const atual = Math.min(LINHA_DA_REFORMA.length - 1, Math.floor(andamento * (LINHA_DA_REFORMA.length - 1)));
  return (
    <div className="hub-cartao p-7 sm:p-10">
      <div className="relative hidden md:block">
        <div className="hub-trilho absolute left-[12.5%] right-[12.5%] top-[7px] h-[3px] rounded-full" style={{ "--feito": `${andamento * 100}%` }} />
      </div>
      <ol className="relative grid gap-8 md:grid-cols-4">
        {LINHA_DA_REFORMA.map((marco, i) => (
          <li key={marco.ano} className="flex flex-col md:items-center md:text-center">
            <span className={`relative z-10 h-4 w-4 rounded-[5px] ${i === atual ? "bg-[var(--hub-acento)] shadow-[0_0_0_6px_var(--hub-acento-suave)]" : "border-2 border-[var(--hub-borda-forte)] bg-[var(--hub-cartao-solido)]"}`} />
            <p className="hub-display mt-5 text-[26px] font-bold">{marco.ano}</p>
            {i === atual && <span className="hub-selo hub-selo-vivo mt-2 self-start md:self-center">Estamos aqui</span>}
            <p className="mt-3 text-[15px] font-bold">{marco.titulo}</p>
            <p className="mt-1.5 max-w-[260px] text-[13.5px] leading-relaxed text-[var(--hub-texto-2)]">{marco.texto}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
