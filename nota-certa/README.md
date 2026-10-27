# Nota Certa — nota fiscal sem erro na Reforma Tributária (IBS/CBS)

App **separado do AthosBI** para ajudar o cliente a emitir a nota certa (antes) e
conferir as notas emitidas (depois). Tudo o que é dele fica nesta pasta até
ganhar repositório próprio.

**Situação (outubro de 2026):** estudo e preparação. O app ainda não começou.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `docs/Nota Certa - Estudo (IBS-CBS).docx` | Estudo completo: contexto da Reforma, NCM/CST/cClassTrib, matriz fiscal, como o app funcionaria (telas, jornadas, esboços), regras de validação, plano por fases, decisões e fontes |
| `planilhas/Nota Certa - Base de trabalho.xlsx` | Planilha para começar sem o app. Abas: **Referência LC 214** (NCM/NBS → item do anexo, cClassTrib, redução, condição), **CFOP** (os mais usados, tipo de operação e orientação de IBS/CBS) e **Modelo de catálogo** (um produto por linha, com a sugestão da LC 214 calculada por fórmula) |
| `dados/anexos-lc214.json` | Base dos anexos da LC 214: 18 tratamentos (cClassTrib), 863 regras por NCM, 99 por NBS e o texto dos itens |
| `dados/cfop-mais-usados.json` | 70 CFOPs mais usados com tipo de operação e orientação inicial de IBS/CBS |
| `scripts/gerar-estudo.cjs` | Gera o Word a partir dos dados |
| `scripts/gerar-planilha.py` | Gera a planilha a partir dos dados |

## O que já sabemos

- A partir de 2027 a CBS é cobrada de verdade e a apuração é **assistida**: o fisco monta o imposto a partir das notas. Na prática, a **nota passa a ser a apuração**, e errar custa caro: multa por cancelar fora do prazo, crédito do comprador travado e ajustes.
- O objetivo do app é **o cliente não errar ao emitir**. O erro nasce no cadastro do produto (NCM), no cadastro do comprador e na regra do ERP.
- **Cada produto tem um NCM, mas um NCM tem muitos produtos.** O benefício da LC 214 é do produto descrito no anexo, não do NCM inteiro. Por isso o controle é pelo **catálogo de produtos**, com aprovação do escritório.
- O percentual do mesmo produto **pode mudar pelo comprador**. Exemplo: seringa vendida a hospital privado tem redução de 60% (200030); vendida a órgão público ou entidade SUS com CEBAS, tem alíquota zero (200005).
- O percentual também pode mudar pela operação, pelo regime de quem vende, pelo ano da transição e, a partir de 2029, pelo destino. A matriz fiscal é **produto × operação × comprador**.
- O **CFOP é da operação**, não do produto.
- A SEFAZ confere formato e compatibilidade dos códigos, mas **não** se a classificação está certa para aquele produto e aquele comprador. Esse é o espaço do app.

## Próximos passos

1. **Decisões:**
   - escolher de 3 a 5 clientes piloto;
   - começar pela NF-e (modelo 55);
   - coletar de 20 a 50 XMLs de cada piloto.
2. **Planilha:** preencher o "Modelo de catálogo" de cada piloto (exportação do ERP) e decidir a classificação de cada produto.
3. **Fase 1 do app:** criar o app (login, banco, publicação) e o conferidor de XML.

O plano completo está no capítulo 12 do estudo.

## Como gerar de novo

```bash
cd nota-certa/scripts
node gerar-estudo.cjs "../docs/Nota Certa - Estudo (IBS-CBS).docx"            # precisa do pacote npm "docx"
python3 gerar-planilha.py "../planilhas/Nota Certa - Base de trabalho.xlsx"   # precisa do openpyxl
```

Depois de gerar a planilha, abra e salve no Excel (ou no LibreOffice) para calcular as fórmulas.

## Cuidados

- **Dados reais de clientes não entram nesta pasta.** Isso vale para XMLs, catálogos preenchidos e listas de NCM de clientes. Para testes, só dados fictícios ou anonimizados.
- Pontos marcados com **(conferir)** no estudo e na planilha vieram de fontes secundárias ou mudam com frequência. Confirme no texto oficial antes de virarem regra.

## Fonte e licença dos dados

`dados/anexos-lc214.json` vem do pacote `@sinete/ibs-cbs-dados@2026.9.3`, com dados de 2026.09 e licença **Apache-2.0** (FAZER.AI LTDA e contribuidores do sinete). O pacote foi extraído do módulo offline (V0059) da Calculadora de Tributos da Reforma Tributária do Consumo, da Receita Federal, e das tabelas do Informe Técnico 2025.002 v1.60.

Os CFOPs vêm da tabela oficial: Convênio s/nº de 1970, com a redação do Ajuste SINIEF 07/2001. As descrições estão resumidas; confira a tabela oficial.
