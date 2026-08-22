# ADR-007: Precisão numérica nos investimentos — centavos inteiros para dinheiro, `Decimal` para quantidade e cotação

**Data:** 2026-08-21
**Status:** accepted

## Contexto

O [ADR-005](ADR-005-cents-for-money.md) fixou que todo valor monetário do app é
um **inteiro em centavos**. Ele funciona perfeitamente para o orçamento
doméstico, onde nada tem fração de centavo — e o próprio ADR já avisava que a
regra precisaria ser reavaliada na Fase 2, "ex.: cotações".

A Fase 2 traz dois números que não cabem nesse molde:

- **Quantidade de ativo.** Cripto é fracionária por natureza (`0.00123456 BTC`),
  e mesmo na B3 existem frações de ação. Um inteiro não serve.
- **Cotação unitária.** Uma moeda pode valer R$ 0,000071 — isto é, 0,0071
  centavos. Guardada como inteiro de centavos, ela vira **zero**.

Uma terceira opção estava na mesa: escalar tudo para inteiros em micro-unidades.
E havia a dúvida prática de onde guardar o **preço atual** digitado à mão, já que
nesta fase não há API de cotação.

## Decisão

Dividir os números **pela natureza deles**, e não por "é dinheiro ou não":

| Natureza | Tipo no banco | Exemplo |
|---|---|---|
| Dinheiro que **se moveu** (custo, aporte, resultado) | `Int` em centavos — ADR-005 intacto | `asset_operations.total_cents` |
| **Quantidade** de unidades | `Decimal(24, 8)` | `0.00123456` |
| **Cotação** unitária | `Decimal(20, 6)`, **em centavos** | `0.0071` (= R$ 0,000071) |

Três consequências desenham o resto do módulo:

1. **O preço unitário de uma operação não é armazenado.** O formulário pede
   quantidade e preço, mas o que vai para o banco é a **quantidade + o total em
   centavos inteiros** — que é o dinheiro que de fato saiu da conta, corretagem
   incluída. O preço médio é sempre derivado (`investido / quantidade`), então
   nunca existem dois campos que possam discordar (o clássico "3 × R$ 10,333 =
   R$ 30,999: guardo 3099 ou 3100?").
2. **A cotação mora no `Asset`**, junto de um `price_updated_at`. É atributo do
   ativo, não da operação; atualiza-se sozinha; e são exatamente os dois campos
   que a branch futura de brapi.dev/CoinGecko vai preencher, sem migration nova.
   `null` significa "nunca precificado" — a UI mostra "sem cotação" em vez de
   fingir que a posição vale R$ 0,00.
3. **`Decimal` não cruza para o cliente.** O `Decimal` do Prisma é um objeto
   Decimal.js, que não serializa de Server para Client Component. A regra é
   converter na borda, na page: `Number(row.quantity)`. Por isso
   `lib/portfolio.ts` **não importa Prisma** — recebe e devolve só `number`, o
   que também o mantém testável no Vitest.

O arredondamento acontece uma vez por cálculo e sempre explícito
(`Math.round`): no valor atual (`quantidade × cotação`) e no custo retirado por
uma venda. Dinheiro nunca deixa de ser inteiro; float nunca vira dinheiro sem
passar por um `Math.round`.

## Alternativas consideradas

- **Migrar tudo para `Decimal`** — descartada. Obrigaria a converter todo campo
  de dinheiro em toda borda Server→Client, trocaria `+`/`*` por `.plus()`/
  `.times()` nos helpers puros e quebraria a homogeneidade com
  `Transaction.amount` e `BankAccount.initialBalance`. Custo alto para um ganho
  nulo: o dinheiro deste app não tem fração de centavo.
- **Inteiros escalados (micro-unidades)** — descartada. `Int` no Postgres é de 32
  bits: com escala `1e8`, o teto é **21,47 unidades** — quebraria com 100 ações.
  A saída seria `BigInt`, que o `JSON.stringify` não serializa e que contamina
  toda a aritmética com literais `10n`.
- **Guardar o preço unitário junto do total** — descartada por redundância: dois
  campos derivados um do outro divergem no primeiro arredondamento.
- **`Float`** — descartada pelos mesmos motivos do ADR-005.

## Consequências

- **Facilita:** o modelo mental "dinheiro é centavo inteiro" continua valendo em
  todo o app; `lib/portfolio.ts` é uma função pura testável, sem Prisma; e a
  entrada da API de cotações não precisa de mudança de schema.
- **Dificulta:** há agora **duas** representações a lembrar. Ao escrever uma page
  nova de investimentos, é obrigatório converter `Decimal → number` na borda —
  esquecer disso produz o erro "Only plain objects can be passed to Client
  Components". E `formatBRL` (2 casas) não serve para cotação sub-centavo: para
  preço unitário usa-se `formatPriceBRL`, que cai para 6 casas quando o valor é
  menor que um centavo.
- **Atenção no futuro:** se um dia entrar carteira em outra moeda (dólar), a
  cotação de câmbio segue a mesma regra da cotação de ativo — `Decimal`, em
  centavos. E se aparecer campo de **corretagem** separado, ele é dinheiro
  movido: `Int` em centavos, e precisa entrar no custo médio.
