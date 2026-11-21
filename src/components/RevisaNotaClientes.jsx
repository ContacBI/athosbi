import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Search } from "lucide-react";
import { inteiro, moneyFull } from "../lib/fmtNotas.js";
import { pedidoAberto, pedidosDoAlvo } from "../lib/revisaNota.js";

// Clientes (compradores) do Revisa Nota, no desenho do app do escritório: resumo no topo, filtros por sugestão e por confirmação, e a tabela com a sugestão (pela natureza jurídica da
// Receita ou pelo nome), o perfil confirmado, o CEBAS e a natureza jurídica (código e descrição). Clicar num comprador abre o detalhe, onde o cliente pede o perfil certo.
const ROTULO_PERFIL = { privado: "Privado", publico: "Órgão público", sus_cebas: "SUS com CEBAS" };
const ROTULO_SUG = { privado: "Privado", publico: "Parece público", sus_cebas: "SUS com CEBAS", verificar: "A verificar" };
const TOM_SUG = {
  privado: "border-line text-ink-700",
  publico: "border-amber-500/50 bg-amber-500/10 text-amber-600",
  sus_cebas: "border-amber-500/50 bg-amber-500/10 text-amber-600",
  verificar: "border-line text-ink-500",
};
const dia = (iso) => {
  const [a, m, d] = String(iso || "").slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
};
const docFormatado = (doc) => {
  const d = String(doc || "");
  if (d.includes("*")) return d;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return d || "sem CNPJ/CPF";
};
const norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tipoSug = (c) => c.sugTipo || "verificar";
const confirmado = (c) => Boolean(c.perfil?.tipo && c.perfil.tipo !== "verificar");

function Cartao({ rotulo, children, sub, icone, tom }) {
  return (
    <div className="relative rounded-2xl border border-line bg-surface-card px-5 py-4">
      {icone && <span className={`absolute right-4 top-4 ${tom}`}>{icone}</span>}
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">{rotulo}</p>
      <div className="mt-1.5">{children}</div>
      {sub && <p className="mt-1.5 text-[12px] leading-snug text-ink-500">{sub}</p>}
    </div>
  );
}

export default function ClientesCompradores({ lista, pedidos, aoAbrir, atualizadoEm }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [soVendas, setSoVendas] = useState(true);
  const clientes = lista.clientes;
  const base = useMemo(() => (soVendas ? clientes.filter((c) => (Number(c.notas) || 0) > 0) : clientes), [clientes, soVendas]);

  const cont = useMemo(() => {
    const c = { todos: base.length, publico: 0, sus_cebas: 0, privado: 0, verificar: 0, pendentes: 0, confirmados: 0 };
    for (const x of base) {
      c[tipoSug(x)] = (c[tipoSug(x)] || 0) + 1;
      if (confirmado(x)) c.confirmados += 1;
      else c.pendentes += 1;
    }
    return c;
  }, [base]);
  const total = useMemo(() => base.reduce((s, c) => s + (Number(c.valor) || 0), 0), [base]);
  const aConfirmar = useMemo(() => base.filter((c) => !confirmado(c) && ["publico", "sus_cebas"].includes(tipoSug(c))), [base]);
  const valorAConfirmar = aConfirmar.reduce((s, c) => s + (Number(c.valor) || 0), 0);

  const visiveis = useMemo(() => {
    const palavras = norm(busca).split(" ").filter(Boolean);
    return base
      .filter((c) => {
        if (["publico", "sus_cebas", "privado", "verificar"].includes(filtro) && tipoSug(c) !== filtro) return false;
        if (filtro === "confirmados" && !confirmado(c)) return false;
        if (filtro === "pendentes" && confirmado(c)) return false;
        if (!palavras.length) return true;
        const texto = norm(`${c.nome} ${c.doc} ${c.municipio} ${c.uf} ${c.natCodigo} ${c.natDescricao}`);
        return palavras.every((p) => texto.includes(p));
      })
      .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0));
  }, [base, busca, filtro]);

  const baixar = () => {
    const linhas = [["Cliente", "Documento", "UF", "Município", "Vendas no ano", "Notas", "Sugestão", "Perfil confirmado", "CEBAS até", "Natureza jurídica (código)", "Natureza jurídica (descrição)"]];
    visiveis.forEach((c) => linhas.push([c.nome, docFormatado(c.doc), c.uf, c.municipio, String(Number(c.valor) || 0).replace(".", ","), c.notas, ROTULO_SUG[tipoSug(c)], confirmado(c) ? ROTULO_PERFIL[c.perfil.tipo] || c.perfil.tipo : "", dia(c.perfil?.cebasValidade), c.natCodigo || "", c.natDescricao || ""]));
    const texto = linhas.map((l) => l.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿", texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "revisa-nota-clientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const chips = [["todos", "Todos"], ["publico", "Parece público"], ["sus_cebas", "Parece SUS/CEBAS"], ["privado", "Privado"], ["verificar", "A verificar"], ["pendentes", "Sem confirmação"], ["confirmados", "Confirmados"]];

  return (
    <>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{lista.empresa || ""}</p>
        <h2 className="mt-1 text-[30px] font-bold leading-tight text-ink-900">Clientes <em className="font-serif font-semibold italic text-accent-500">compradores</em>.</h2>
        <p className="mt-2 text-[12px] text-ink-500"><span className="font-medium text-emerald-500">● ao vivo</span>{atualizadoEm ? ` · atualizado em ${atualizadoEm}` : ""}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao rotulo="Clientes com vendas" sub={`${moneyFull(total)} vendidos`}>
          <p className="text-[34px] font-bold leading-none tabular-nums text-ink-900">{inteiro(base.length)}</p>
        </Cartao>
        <Cartao rotulo="Perfil confirmado">
          <p className="text-[34px] font-bold leading-none tabular-nums text-ink-900">{inteiro(cont.confirmados)}<small className="ml-1.5 text-[15px] font-normal text-ink-400">de {inteiro(base.length)}</small></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${base.length ? (cont.confirmados / base.length) * 100 : 0}%` }} /></div>
        </Cartao>
        <Cartao rotulo="A confirmar" icone={<AlertTriangle size={17} />} tom="text-amber-500" sub={`candidatos a público ou SUS a confirmar · ${moneyFull(valorAConfirmar)}`}>
          <p className="text-[34px] font-bold leading-none tabular-nums text-amber-500">{inteiro(aConfirmar.length)}</p>
        </Cartao>
        <Cartao rotulo="Sugeridos" icone={<CheckCircle2 size={17} />} tom="text-emerald-500" sub="sugeridos como privados">
          <p className="text-[34px] font-bold leading-none tabular-nums text-emerald-500">{inteiro(cont.privado)}</p>
        </Cartao>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ, cidade ou natureza…" className="w-full rounded-lg border border-line bg-surface-card py-2.5 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-accent-400" />
        </div>
        <button type="button" onClick={baixar} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-card px-3 py-2.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-muted"><Download size={14} /> Lista em planilha</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map(([k, t]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${filtro === k ? "border-accent-500 bg-accent-500/10 text-accent-700" : "border-line text-ink-600 hover:bg-surface-muted"}`}>
            {t} {cont[k] !== undefined && <b className="ml-0.5 tabular-nums">{inteiro(cont[k])}</b>}
          </button>
        ))}
        <label className="ml-1 flex items-center gap-1.5 text-[12.5px] text-ink-600"><input type="checkbox" checked={soVendas} onChange={(e) => setSoVendas(e.target.checked)} />só com vendas no ano</label>
        <span className="ml-auto text-[12px] text-ink-400">{inteiro(visiveis.length)} comprador{visiveis.length === 1 ? "" : "es"}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-[13px]">
            <thead className="bg-surface-card text-[11px] font-medium uppercase tracking-wide text-ink-400 shadow-[0_1px_0_var(--color-line)]">
              <tr>
                {[["Cliente"], ["UF · município"], ["Vendas no ano", true], ["Sugestão (Receita ou nome)"], ["Perfil confirmado"], ["CEBAS até"], ["Natureza jurídica (código)"], ["Natureza jurídica (descrição)"]].map(([nome, dir]) => (
                  <th key={nome} className={`whitespace-nowrap px-4 py-2.5 ${dir ? "text-right" : "text-left"}`}>{nome}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {visiveis.map((c) => {
                const t = tipoSug(c);
                const abertos = pedidosDoAlvo(pedidos, c.chave).filter(pedidoAberto).length;
                return (
                  <tr key={c.chave} onClick={() => aoAbrir(c)} className="cursor-pointer align-middle transition-colors hover:bg-accent-50/40">
                    <td className="max-w-[320px] px-4 py-2.5">
                      <p className="truncate font-semibold text-ink-900" title={c.nome}>{c.nome}</p>
                      <p className="text-[11px] tabular-nums text-ink-400">{docFormatado(c.doc)}{abertos > 0 && <span className="ml-2 rounded bg-sky-500/10 px-1.5 font-semibold text-sky-600">pedido em andamento</span>}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-700">{c.uf || "—"}<span className="text-ink-400"> · {c.municipio || "—"}</span></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums"><span className="font-semibold text-ink-900">{moneyFull(c.valor)}</span><span className="text-ink-400"> · {inteiro(c.notas)} nota(s)</span></td>
                    <td className="px-4 py-2.5"><span title={c.sugMotivo || ""} className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${TOM_SUG[t]}`}>{ROTULO_SUG[t]}</span></td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {confirmado(c) ? <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-900"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{ROTULO_PERFIL[c.perfil.tipo] || c.perfil.tipo}</span> : <span className="text-[12.5px] text-ink-400">Não confirmado</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-700">{c.perfil?.cebasValidade ? dia(c.perfil.cebasValidade) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums text-ink-800">{c.natCodigo || <span className="font-normal text-ink-300">—</span>}</td>
                    <td className="max-w-[360px] px-4 py-2.5 text-ink-700"><p className="line-clamp-2" title={c.natDescricao || ""}>{c.natDescricao || <span className="text-ink-300">{c.tipoDoc === "cpf" ? "Pessoa física" : "—"}</span>}</p></td>
                  </tr>
                );
              })}
              {!visiveis.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-400">Nenhum comprador com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
