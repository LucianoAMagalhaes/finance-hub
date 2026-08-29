# ADR-012: Valor líquido do Tesouro como estimativa, calculada por lote

**Data:** 2026-08-29
**Status:** accepted

## Contexto

Com o [ADR-011](ADR-011-cotacoes-tesouro-direto.md) a carteira passou a mostrar o
valor **bruto** de cada título: `quantidade × PU`. É o mesmo número que o "Saldo
Bruto" do extrato do banco — validado ao centavo — e a mesma conta que o app já
fazia para ações.

Só que, para renda fixa, o bruto não é o que chega na conta. O extrato do próprio
Tesouro exibe uma coluna a mais que o app não tinha: **Valor Líquido**, depois de
IR, IOF e taxa de custódia da B3. No exemplo real do desenvolvedor a diferença era
de ~R$ 25 sobre R$ 1.223 — 2%. Numa posição de R$ 53 mil, R$ 158.

Para ações essa distinção quase não existe (venda com lucro tem IR, mas é apurado
pelo investidor, não retido na fonte). Para o Tesouro o IR **sai na fonte** no
resgate: não é opcional nem estimável pelo usuário depois.

## Decisão

Calcular e exibir o valor líquido, **explicitamente rotulado como previsão**, no
painel que se abre ao expandir a linha do título.

### Por lote, não pela posição

A alíquota de IR depende da idade de **cada aplicação**, não da média:

| dias corridos | alíquota |
|---|---|
| até 180 | 22,5% |
| 181 a 360 | 20% |
| 361 a 720 | 17,5% |
| acima de 720 | 15% |

Duas compras do mesmo título feitas com um ano de diferença são tributadas
diferente. `buildPosition` (`lib/portfolio.ts`) trabalha em **custo médio** e não
serve aqui: seria preciso aplicar uma alíquota só a uma base média, o que dá o
número errado sempre que a posição atravessa uma faixa. Então `treasuryNetValue`
percorre as compras uma a uma e soma.

Isso só é simples porque **vendas foram cortadas da UI**: todo lote ainda está em
carteira e não há FIFO a resolver. Se vendas voltarem, esta função precisa saber
quais lotes já saíram.

### A ordem das deduções é a legal

IOF incide sobre o rendimento primeiro (tabela regressiva dos 30 primeiros dias,
96% no dia 1 até 0% no dia 30); o IR incide sobre **o que sobra** dele. Lote no
prejuízo não paga nem um nem outro — e não gera crédito contra os outros, que não
é como retenção na fonte funciona.

### A taxa da B3 é a única parte realmente aproximada

0,20% ao ano sobre o valor mantido, pro-rata pelos dias, calculada sobre a **média
entre o investido e o bruto** do lote. A isenção do **Tesouro Selic até
R$ 10.000** é aplicada e rateada proporcionalmente entre os lotes.

Medida contra o extrato real: **R$ 4,29** contra os **R$ 4,18** cobrados — 2,6%.
Não dá para fazer melhor com o dado que o app tem: a taxa acumula **diariamente**
sobre um PU que variou todos aqueles dias, e reproduzir isso exigiria a série
histórica de PU do título inteiro.

### O líquido não entra na coluna "Resultado"

Aquela coluna precisa significar uma coisa só em todas as linhas, para uma ação e
um título continuarem comparáveis nela — e para uma ação não há retenção a
descontar. `positionValueCents` e as metas de alocação também seguem no **bruto**:
alocação é sobre patrimônio, não sobre o que sobraria se tudo fosse resgatado hoje.

## Alternativas consideradas

- **Não calcular, e deixar o usuário abrir o app do Tesouro** — é o estado
  anterior. Descartado porque o número aparecia 2% otimista sem dizer que era
  bruto, e comparar um título com uma ação na mesma tabela ficava enganoso.
- **Calcular só o IR e ignorar IOF e B3** — o IR é 90% da diferença e é exato. Mas
  o IOF apareceu de imediato na carteira real (duas compras com 17 dias, R$ 124 de
  IOF somados), e omiti-lo mostraria um líquido alto demais justamente nos casos
  em que a diferença é maior.
- **Gravar o valor líquido no banco** — contraria o padrão do projeto: posição,
  limite de orçamento e nota do ativo são todos **derivados**, nunca armazenados,
  para não poderem divergir do histórico.
- **Guardar a série de PU para calcular a taxa B3 exata** — muito custo (uma
  tabela nova e um download diário) por 2,6% de precisão numa linha que representa
  R$ 18 na carteira inteira.

## Consequências

**Facilita.** O número na tela passa a ser o dinheiro que chegaria na conta, e o
app reproduz a coluna que o usuário já lê no extrato do Tesouro. A alíquota por
compra fica visível no painel, o que também explica *por que* o líquido é aquele.

**Dificulta / a ter em mente:**

- **É previsão, não apuração.** Assume resgate **hoje**, ao preço de hoje. No dia
  seguinte tudo muda — e o IPCA que corrigirá o título no resgate real ainda nem
  foi publicado.
- **A taxa B3 tem ~3% de erro**, sempre para mais (a estimativa usa a média, e a
  taxa real acumulou sobre valores menores no começo).
- **A isenção do Selic é aplicada por posição**, enquanto a regra é por investidor
  somando todos os títulos Selic. Igual para quem tem um só; levemente generosa
  para quem tiver vários.
- **Cupons continuam fora.** Um título com juros semestrais já pagou dinheiro que
  o app não registra, então o líquido dele lê **menor** que o real. O painel avisa
  nesses títulos — é a mesma lacuna dos dividendos de ações.
- Se **vendas** voltarem à UI, `treasuryNetValue` precisa saber quais lotes já
  saíram; hoje ela assume que todos continuam em carteira.
