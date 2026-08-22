# ADR-009: Nota do ativo por checklist e sugestão de aporte por lacuna

**Data:** 2026-08-22
**Status:** accepted

## Contexto

A Carteira (`/investments/portfolio`, [ADR-008](ADR-008-investimentos-modulo-separado.md))
mostra **o que** o usuário tem, mas não ajuda a decidir **onde colocar o próximo
dinheiro**. Hoje essa decisão é feita de cabeça, sem critério registrado e sem
olhar se a carteira está fora do equilíbrio desejado.

O usuário já tinha um método na cabeça: uma bateria de perguntas objetivas por
ativo ("Empresas: Dívida Líquida/EBITDA é < 2,5x? Bancos: Índice de Basileia
≥ 14%?"), cada resposta somando ou tirando um ponto, para chegar numa nota. O
que faltava era decidir **onde essas perguntas moram**, **em que escala a nota
vive** e, principalmente, **como a nota vira dinheiro** na hora do aporte.

Esta decisão cobre as três peças, ainda que sejam entregues em branches
separadas (`feat/asset-scoring` → `feat/allocation-targets` →
`feat/contribution-planner`).

## Decisão

### 1. As perguntas moram no banco, editáveis pelo usuário

Modelos `ScoreQuestion` (a pergunta, com `scope` e `position`) e `ScoreAnswer`
(a resposta de um ativo a uma pergunta), editáveis na seção **"Checklist de
avaliação"** de Configurações. O `prisma/seed.ts` oferece um conjunto inicial de
10 perguntas por lista, mas **só quando aquela lista está vazia** — nunca edita
nem ressuscita o que o usuário mexeu, seguindo a regra que o seed de categorias
aprendeu na prática.

Há **duas listas** (`ScoreScope`): `stocks`, que vale para `stock_br` e
`stock_intl`, e `fiis`. As perguntas de ação são sobre saúde da empresa, que não
muda com a bolsa onde ela é negociada — daí os dois tipos compartilharem a lista.
`crypto` e `fixed_income` não têm checklist.

Editar uma pergunta **não** pode movê-la de lista: as respostas já dadas
pertencem àquela lista, e mudar o `scope` faria elas contarem para os ativos
errados sem aviso.

### 2. Uma única escala, de −10 a +10

Cada "sim" soma 1, cada "não" tira 1 — então uma lista de 10 perguntas produz
uma nota de −10 a +10. Uma pergunta **em branco não conta** (a nota é parcial e a
UI mostra "7/10"); só a ausência total de respostas deixa o ativo **sem nota**.

`crypto` e `fixed_income` recebem uma nota **digitada à mão** (`Asset.manualScore`)
**na mesma escala**. Nota manual em 0–10 seria mais natural de digitar, mas a
coluna "Nota" da Carteira mostra todos os tipos lado a lado: um "8" manual ao
lado de um "+4" de checklist faria a cripto parecer melhor do que é.

A nota, como a posição em `lib/portfolio.ts` e o limite de orçamento em
`lib/budget.ts`, é **derivada** (`lib/scoring.ts`) e nunca gravada — assim ela
não tem como discordar das respostas que a produziram.

### 3. O aporte é rateado por lacuna, nos dois níveis

O simulador divide o aporte em dois passos, ambos com a mesma primitiva:

**Nível 1 — entre os tipos.** A meta de alocação (`% em Ação BR`, `FII`…) define
o alvo de cada tipo sobre o patrimônio **depois** do aporte; o dinheiro vai para
quem está mais abaixo do próprio alvo. Tipo já acima da meta recebe R$ 0 — o
aporte reequilibra a carteira sozinho, **sem nunca sugerir uma venda**.

**Nível 2 — entre os ativos do tipo.** A **nota define o alvo** de cada ativo
dentro do tipo (nota 9 contra nota 6 → 60% e 40% da fatia do tipo), e de novo o
dinheiro vai para quem está mais atrás do próprio alvo.

**Só nota positiva atrai dinheiro.** Nota ≤ 0 ou ativo sem avaliação pesam zero:
continuam na carteira e continuam listados no simulador, com o motivo, mas não
recebem sugestão.

## Alternativas consideradas

- **Perguntas fixas em código** (`lib/scoring/questions.ts`) — descartada. Era
  mais simples e dispensaria uma tela, mas o usuário ainda está amadurecendo os
  próprios critérios, e uma pergunta que ele não consegue editar é uma pergunta
  que ele para de confiar. O `position` estável no banco dá a mesma garantia que
  um id fixo em código daria: reescrever o texto não invalida as respostas.
- **Rateio direto pela nota, no nível 2** (nota 9 e nota 6 → 60% e 40% do
  dinheiro, ignorando a posição atual) — descartada. É mais fácil de conferir de
  cabeça, mas ignora quanto já se tem de cada ativo: o pior papel do grupo
  continuaria recebendo aporte todo mês, e a concentração nunca se corrigiria.
- **Nota só como corte** (nota ≥ X entra, e entre os aprovados divide igual) —
  descartada por jogar fora informação: a diferença entre um ativo nota 9 e um
  nota 4 vira nada.
- **Nota manual em 0–10** — descartada pelo motivo da seção 2 (escalas
  diferentes na mesma coluna).
- **Soft-delete das perguntas** (`active: false`) para preservar respostas
  antigas — descartada. Quando o usuário apaga uma pergunta ruim, ele quer que
  ela suma; o `onDelete: Cascade` faz isso, e a confirmação diz quantas respostas
  vão junto.

## Consequências

- **A nota só é comparável dentro do mesmo tipo.** Listas de tamanhos diferentes
  produzem faixas diferentes (8 perguntas → −8..+8), e a nota manual é subjetiva
  por definição. Isso é inofensivo porque o cálculo do aporte **nunca** compara
  ativos de tipos diferentes pela nota — a divisão entre tipos é feita pela meta
  de alocação, no nível 1.
- **Ativo não avaliado nunca recebe sugestão.** É deliberado (o "—" na coluna
  Nota é um chamado à ação), mas significa que uma carteira recém-importada
  devolve um plano vazio até o usuário avaliar.
- **Apagar ou adicionar uma pergunta muda a nota de todo mundo** que a tinha
  respondido, e portanto muda a sugestão de aporte. É o preço de deixar a lista
  editável; a confirmação de exclusão diz quantas respostas serão perdidas.
- **Posições fechadas ficam de fora do simulador.** Um ticker zerado teria lacuna
  igual ao alvo inteiro e engoliria o aporte.
- **O simulador não registra nada.** Ele calcula e mostra; a compra continua
  sendo registrada pelo modal "Nova compra" da Carteira, e nada disso toca
  transações ou contas do orçamento — [ADR-008](ADR-008-investimentos-modulo-separado.md)
  segue valendo.
- **Metas que não somam 100% não travam a conta.** O rateio normaliza pelos
  pesos, então uma soma de 90% ou 110% produz um plano coerente; a UI avisa, o
  cálculo não quebra.
