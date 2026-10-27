# Pedido à Central: produtos vendidos e compradores (modelo)

Modelo do pedido que a gente cola na Central (a sessão no computador do
escritório que lê a Domínio) para montar o catálogo de um cliente piloto. Os
campos entre `<>` são preenchidos na hora. A planilha que volta tem dados
reais e **não entra no GitHub**.

---

Pedido pontual (não é envio pro AthosBI): lista dos PRODUTOS vendidos e dos COMPRADORES de um cliente, para o estudo do Nota Certa. Não mexe em nada do que já roda (lançamentos, balancete, resumo fiscal).

Empresa: `<NOME>` — CNPJ `<CNPJ>`. Use os mesmos códigos da Domínio que você soma no resumo fiscal (matriz + filiais: `<CÓDIGOS>`). Período: `<INÍCIO>` a `<FIM>` (o mesmo do resumo fiscal).

Gere um Excel (.xlsx) e salve na Área de Trabalho do Windows (pegue o caminho com `[Environment]::GetFolderPath('Desktop')`), com o nome "`<NOME CURTO>` - produtos vendidos.xlsx". Se não tiver como gerar .xlsx, use CSV com separador ";" (um arquivo por aba).

**Aba "produtos"**: uma linha por produto vendido. O critério de venda é o mesmo do resumo fiscal:
- só venda;
- descontar as devoluções de venda;
- ficam fora: transferência, remessa, bonificação, amostra, demonstração, comodato, retorno e nota cancelada ou denegada.

Colunas:
- `codigo_produto`: código do produto na Domínio;
- `descricao`: descrição completa do cadastro;
- `ncm`: 8 dígitos, do cadastro do produto;
- `ncm_nas_notas`: se nas notas apareceu NCM diferente do cadastro, liste os NCMs usados;
- `unidade`;
- `gtin`: código de barras/EAN do cadastro, se existir;
- `quantidade`: líquida de devoluções;
- `valor`: líquido de devoluções, com desconto, sem IPI e sem ICMS-ST;
- `notas`: quantas notas;
- `cfops`: lista;
- `primeira_venda` e `ultima_venda`.

Ordene por NCM e depois por valor, do maior para o menor.

**Aba "compradores"**: uma linha por cliente comprador no período. Colunas:
- `cnpj_cpf`, `nome`, `uf`, `municipio`;
- `valor` (líquido), `notas`, `cfops`;
- `contribuinte_icms`: sim ou não, pelo indicador do destinatário ou pela inscrição estadual.

**Conferência antes de salvar:** a soma do valor da aba "produtos" por NCM tem que bater com o resumo fiscal já enviado. Mostre por NCM o nº de produtos, o total e a diferença, se houver.

Tabelas prováveis (confirme com SELECT):
- bethadba.efsaidas e efmvspro: itens das saídas;
- efentradas e efmvepro: devoluções;
- efprodutos: cadastro do produto (descrição, NCM, unidade, código de barras);
- efclientes: CNPJ/CPF, UF, município.

Regras de sempre:
- **SÓ SELECT na Domínio, nunca alterar nada.**
- O arquivo tem dados de clientes: não enviar para lugar nenhum, só salvar na Área de Trabalho.
- Este pedido não usa o token. O token continua só no arquivo `C:\Users\DC04\.athosbi-sync.json` e não deve aparecer no chat nem no log.
