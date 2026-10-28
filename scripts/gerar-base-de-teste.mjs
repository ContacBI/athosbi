// Base do site de TESTE (docs/AMBIENTES.md): três empresas fictícias e um
// grupo, de jan a set/2026, num .zip no formato do "Backup geral" — é só
// restaurar em Parâmetros › Empresas › "Restaurar backup" no site de teste.
// Nada aqui é dado de cliente: tudo sai da empresa de exemplo dos testes
// automáticos (tests/fixtures/empresaExemplo.mjs), em escalas diferentes.
//
//   node --import ./tests/register.mjs scripts/gerar-base-de-teste.mjs saida.zip

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { buildEmpresaExemplo } from "../tests/fixtures/empresaExemplo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { parseCsv } = await import(path.join(ROOT, "src/importers/csv.js"));
const plano = parseCsv(fs.readFileSync(path.join(ROOT, "public/data/plano_gerencial_padrao.csv"), "utf8"));

const EMPRESAS = [
  { id: "cmp_teste_comercial", name: "COMERCIAL MODELO LTDA", cnpj: "11.111.111/0001-11", codigo: "T01", fator: 1 },
  { id: "cmp_teste_servicos", name: "SERVIÇOS EXEMPLO LTDA", cnpj: "22.222.222/0001-22", codigo: "T02", fator: 0.62 },
  { id: "cmp_teste_industria", name: "INDÚSTRIA FICTÍCIA S/A", cnpj: "33.333.333/0001-33", codigo: "T03", fator: 1.85 },
];
// Abril a setembro repetem o trimestre do exemplo (jan–mar) com variação.
const VARIACAO = { 4: 1.1, 5: 0.92, 6: 1.18, 7: 1.05, 8: 0.85, 9: 1.22 };
const round = (n) => Math.round(n * 100) / 100;

function montarEmpresa({ id, name, cnpj, codigo, fator }) {
  const { company, journal } = buildEmpresaExemplo(plano);
  const razao = [];
  for (let mes = 1; mes <= 9; mes += 1) {
    const origem = String(((mes - 1) % 3) + 1).padStart(2, "0");
    const variacao = (VARIACAO[mes] || 1) * fator;
    journal
      .filter((entry) => entry.data.slice(5, 7) === origem)
      .forEach((entry) => {
        razao.push({
          ...entry,
          data: `2026-${String(mes).padStart(2, "0")}${entry.data.slice(7)}`,
          linha_origem: `${mes}${entry.linha_origem}`,
          debito: round(entry.debito * variacao),
          credito: round(entry.credito * variacao),
        });
      });
  }
  // Balancete de jan a set: saldo de 31/12/2025 (na mesma escala) +
  // débitos − créditos do razão.
  const accounts = company.accounts.map((account) => {
    const linhas = razao.filter((entry) => entry.classificacao === account.classificacao);
    const saldoAnterior = round(account.saldo_anterior * fator);
    const debito = round(linhas.reduce((soma, entry) => soma + entry.debito, 0));
    const credito = round(linhas.reduce((soma, entry) => soma + entry.credito, 0));
    return { ...account, saldo_anterior: saldoAnterior, debito, credito, saldo_atual: round(saldoAnterior + debito - credito) };
  });
  return {
    ...company,
    id,
    name,
    cnpj,
    codigo,
    accounts,
    journal: razao,
    journalCount: razao.length,
    journalLoaded: true,
    periodStart: "2026-01-01",
    periodEnd: "2026-09-30",
    lastBalanceteMeta: { inicio: "2026-01-01", fim: "2026-09-30", origem: "dominio", name: "Base de teste (fictícia)" },
    responsaveis: [],
    fechadoAte: "2026-09",
  };
}

export function baseDeTeste() {
  const companies = EMPRESAS.map(montarEmpresa);
  const groups = [{ id: "grp_teste_modelo", name: "GRUPO MODELO (TESTE)", companyIds: companies.map((company) => company.id) }];
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    activeCompanyId: companies[0].id,
    activeGroupId: "",
    companies,
    groups,
    plano: [],
    planosPadrao: [],
    indicatorOverrides: {},
    representantes: [],
    assistantFavorites: [],
    slideLibrary: [],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const saida = process.argv[2] || "base_teste_athosbi.zip";
  const zip = new JSZip();
  const manifesto = baseDeTeste();
  zip.file("backup.json", JSON.stringify(manifesto));
  fs.writeFileSync(saida, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`${saida}: ${manifesto.companies.length} empresas (${manifesto.companies.map((company) => `${company.name} · ${company.journal.length} lançamentos`).join("; ")}) e 1 grupo.`);
}
