# ADR-005: Valores monetários armazenados em centavos (inteiros)

**Data:** 2026-06-13
**Status:** accepted

## Contexto

O app lida o tempo todo com dinheiro: valores de transações, limites de
orçamento, valor alvo/atual de metas, aportes. Representar dinheiro como número de
ponto flutuante (`float`/`double`) é uma fonte clássica de bugs: `0,1 + 0,2`
não é exatamente `0,3` em binário, e somatórios/porcentagens (gasto vs. limite,
progresso de meta) acumulam erros de arredondamento que aparecem como centavos
"fantasmas" para o usuário.

Precisamos de uma representação exata, simples de somar e comparar, e que sirva
tanto para o armazenamento quanto para os cálculos do domínio (status de
orçamento, aporte mensal sugerido, agregações do dashboard).

## Decisão

Armazenar **todo valor monetário como inteiro em centavos** (ex.: `150000` =
R$ 1.500,00). No schema Prisma, as colunas de dinheiro são `Int`
(`amount`, `amountLimit`, `targetAmount`, `currentAmount`,
`monthlyContribution`).

- A conversão entre centavos e a string em BRL fica centralizada em
  `lib/format.ts`: `formatBRL` (centavos → "R$ 1.500,00") e `parseBRLToCents`
  (string digitada → centavos), com arredondamento explícito para evitar resíduo
  de ponto flutuante na hora de multiplicar por 100.
- A UI nunca formata dinheiro "na mão": usa o componente `<Money />` /
  `formatBRL`, garantindo consistência.
- Os helpers de domínio (orçamento, metas, dashboard) operam sempre sobre
  centavos inteiros.

## Alternativas consideradas

- **Float/Double** — descartado pela imprecisão binária: inaceitável para
  somas e porcentagens de dinheiro.
- **`Decimal` (do Postgres/Prisma)** — exato e adequado, mas traz um tipo
  `Decimal` (objeto) que precisa ser convertido para serializar de Server para
  Client Component e nos cálculos; para os valores deste app (sem frações de
  centavo), inteiros em centavos são mais simples e igualmente exatos.
- **String** — exato no armazenamento, mas obrigaria a parsear para fazer
  qualquer aritmética; pior ergonomia que inteiros.

## Consequências

- **Facilita:** aritmética exata e barata (somar, comparar, calcular
  porcentagem); serialização trivial entre servidor e cliente (é só `number`);
  uma única porta de entrada/saída de formatação (`lib/format.ts`).
- **Dificulta:** é preciso **lembrar** que o número é centavo, não real — toda
  entrada do usuário passa por `parseBRLToCents` e toda exibição por `formatBRL`.
  Esquecer a conversão gera valores 100× errados.
- **Atenção no futuro:** se algum dia surgirem moedas com mais de 2 casas
  decimais ou frações de centavo (ex.: cotações na Fase 2), reavaliar — possivelmente
  migrando para `Decimal` ou guardando a menor unidade adequada àquele caso.
