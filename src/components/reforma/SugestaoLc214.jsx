import { CheckCircle2, CircleAlert, Sparkles } from "lucide-react";
import { CATEGORIAS } from "../../lib/reforma/parametros.js";
import { rotuloAnexo, sugestaoLc214 } from "../../lib/reforma/lc214.js";
import { Dica } from "./ui.jsx";

const NOME = Object.fromEntries(CATEGORIAS.map((categoria) => [categoria.id, categoria.nome]));
const chip = "inline-flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-[1px] text-[10.5px] font-medium leading-4";
const corta = (texto, limite = 220) => (texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto);

function Enquadramento({ dado }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <p className="font-medium text-white">
        {rotuloAnexo(dado)} ({dado.artigo}) — {dado.titulo}: {dado.reducao === 100 ? "alíquota zero" : `redução de ${dado.reducao}%`}
        {dado.condicao ? `, ${dado.condicao}` : ""}.
      </p>
      {dado.itens.slice(0, 3).map((item) => (
        <p key={item.item} className="mt-0.5 text-white/70">
          Item {item.item.split("/")[1]}: “{corta(item.texto)}”
        </p>
      ))}
      {dado.itens.length > 3 && <p className="text-white/60">…e mais {dado.itens.length - 3} itens do anexo.</p>}
    </div>
  );
}

// Sugestão da coluna "Na reforma" pelos anexos da LC 214/2025, a partir do
// NCM (produto) ou NBS (serviço). Mostra se a categoria escolhida bate, e
// deixa aplicar com um clique; o texto do item do anexo fica na explicação
// (passando o mouse), porque vários itens ainda limitam pela descrição.
export default function SugestaoLc214({ codigo, tipo = "mercadoria", categoria, onAplicar }) {
  const servico = tipo === "servico";
  const digitos = String(codigo || "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length !== (servico ? 9 : 8)) {
    return (
      <Dica
        titulo="Sem sugestão da LC 214"
        texto={servico ? `Pra sugerir a categoria de um serviço precisa do NBS (9 dígitos). "${codigo}" parece o item da LC 116 (lista do ISS), que não define a categoria na reforma.` : `O NCM precisa ter 8 dígitos pra conferir nos anexos da LC 214 ("${codigo}" tem ${digitos.length}).`}
      >
        <span className={`${chip} bg-surface-muted text-ink-400`}>{servico ? "Sem NBS" : "NCM incompleto"}</span>
      </Dica>
    );
  }

  const { principal, alternativas } = sugestaoLc214(digitos, tipo);
  const sugerida = principal?.categoria || "padrao";
  const detalhes = (
    <div>
      {principal ? <Enquadramento dado={principal} /> : <p className="text-white">{servico ? "Esse NBS" : "Esse NCM"} não está em nenhum anexo de redução da LC 214 que valha pra qualquer venda: alíquota padrão.</p>}
      {alternativas.length > 0 && (
        <div className="mt-2 border-t border-white/10 pt-1.5">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Também pode valer</p>
          {alternativas.map((dado) => (
            <Enquadramento key={dado.cClassTrib} dado={dado} />
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-white/50">Fonte: anexos da LC 214/2025 pela Calculadora da Reforma (RFB). Confira se o produto é o descrito no item.</p>
    </div>
  );

  if (categoria === sugerida) {
    return (
      <Dica titulo="Confere com a LC 214" texto={detalhes} largura={380}>
        <span tabIndex={0} className={`${chip} cursor-help bg-success-50 text-success-600 outline-none`}>
          <CheckCircle2 size={11} className="shrink-0" />
          {principal ? `LC 214 · Anexo ${principal.anexo}` : "LC 214 · sem redução"}
        </span>
      </Dica>
    );
  }
  if (principal || categoria === "padrao") {
    return (
      <Dica titulo={`Sugestão da LC 214: ${NOME[sugerida]}`} texto={detalhes} largura={380}>
        <button type="button" onClick={() => onAplicar(sugerida)} className={`${chip} bg-accent-50 text-accent-700 hover:bg-accent-100`}>
          <Sparkles size={11} className="shrink-0" />
          Usar {NOME[sugerida].toLowerCase()}
        </button>
      </Dica>
    );
  }
  return (
    <Dica titulo="Fora dos anexos da LC 214" texto={detalhes} largura={380}>
      <button type="button" onClick={() => onAplicar("padrao")} className={`${chip} bg-warning-50 text-warning-700 hover:opacity-90`}>
        <CircleAlert size={11} className="shrink-0" />
        {alternativas.length ? "Só com condição" : "Sem base na LC 214"}
      </button>
    </Dica>
  );
}
