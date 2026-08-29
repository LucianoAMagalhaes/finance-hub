# ADR-013: Ativo em moeda estrangeira convertido na gravação, pela taxa do dia

**Data:** 2026-08-29
**Status:** accepted

## Contexto

O [ADR-010](ADR-010-cotacoes-automaticas.md) traçou a linha das cotações
automáticas na **moeda**, não na cobertura: só o que é negociado em real era
buscado, porque `currentPriceCents` são centavos de real **sem coluna de moeda ao
lado**. Ação listada fora, cripto e Tesouro ficaram na célula manual.

O que aquela decisão não previu é que nada impedia o usuário de **digitar dólares
naquela célula manual** — e foi o que aconteceu. O IVV (iShares Core S&P 500)
tinha cinco compras gravadas com valores em dólar: a tela mostrava `R$ 96,59` de
investido onde o valor real era `R$ 566,91`. Esse número entrava no total da
carteira, na pizza de alocação e no rateio do simulador de aporte.

O problema não era o provedor. Era o app não ter uma resposta para "e se o
dinheiro não for real?".

## Decisão

**Converter para real na gravação**, e nunca deixar um valor estrangeiro entrar no
banco.

### Onde a conversão acontece, e o que isso dispensa

Na Server Action, antes do `INSERT`. Como o banco permanece inteiramente em
centavos de real (ADR-005), **nada a jusante precisou mudar**: `lib/portfolio.ts`,
`lib/contribution.ts`, os cards, a pizza de alocação e o planejador de aportes
ficaram intactos. Também não houve **coluna de moeda nem migration** — a moeda é
um campo do **formulário**, não do modelo.

A alternativa seria guardar a moeda no `Asset`, manter os valores nativos e
converter na leitura. Foi descartada: exigiria conversão em cada ponto de
agregação, e todo ponto esquecido seria um número errado silencioso.

### A taxa é a do dia de CADA compra

Não a de hoje. Esta é a decisão que muda o número que o usuário lê:

| | investido | vale hoje | resultado |
|---|---|---|---|
| taxa de cada compra | R$ 566,91 | R$ 663,92 | **+17,11%** |
| taxa de hoje nos dois lados | R$ 502,79 | R$ 663,92 | +32,05% |

Convertendo os dois lados pela mesma taxa, o câmbio **se cancela** e a tela passa
a mostrar o retorno em dólar com cifrão de real. O dólar caiu de ~5,90 para 5,21
no período e comeu quase metade do ganho — isso é dinheiro real que o investidor
não tem, e precisa aparecer. É também como o Fisco calcula custo de aquisição.

O custo é uma chamada de rede na gravação. Vale.

### A lista de moedas é fechada

`SUPPORTED_FX` tem hoje um único item, `USD`. Moeda fora da lista é **recusada**,
nunca adivinhada, porque a falha é severa e silenciosa: o Yahoo responde **`GBp`**
para Londres — **pence**, não libras. Converter isso pela taxa da libra erra por
**100×**. Joanesburgo responde `ZAc`. Cada moeda acrescentada ali é uma promessa
de que o app sabe convertê-la.

### Duas precisões, duas funções

- `foreignToBrlCents` — para **dinheiro que se moveu**, que é sempre um número
  inteiro de centavos (ADR-005). Arredonda uma vez, no fim.
- `brlQuoteToCents` — para uma **cotação**, que pode ser mais fina que um centavo
  (ADR-007). Converte o preço e só então tira os centavos, com 6 casas.

Arredondar a cotação para centavo inteiro antes de converter achataria justamente
a precisão que o ADR-007 existe para preservar.

### Falhar é melhor que adivinhar

Se a taxa não puder ser buscada, a compra é **recusada** com a frase do erro. Se o
dólar não voltar numa rodada de cotações, o ativo estrangeiro aparece como "sem
retorno" e **mantém** o preço que tinha. Em nenhum dos dois casos um número em
dólar é gravado como se fosse real — que é o bug que este ADR existe para matar.

### Fim de semana cai no pregão anterior

Uma compra feita no sábado não tem câmbio próprio. `pickCloseOnOrBefore` usa o
último fechamento **anterior**, numa janela de 10 dias, e **nunca busca para a
frente** — usar a taxa da segunda-feira seria informação do futuro.

## Consequências

**Facilita.** Ativo no exterior deixa de poluir o patrimônio com número de outra
moeda, e passa a ter cotação automática como qualquer ação da B3. O retorno em
real inclui o câmbio, que é o retorno de verdade para quem gasta em real.

**Dificulta / a ter em mente:**

- **Supera parcialmente o ADR-010.** O critério "só o que é negociado em real"
  deixa de valer para `stock_intl`. O restante daquele ADR — botão em vez de
  fetch automático, Yahoo como fonte, ticker sem retorno mantém a cotação —
  continua de pé.
- **A compra em moeda estrangeira depende da rede.** Sem internet, registra-se em
  reais ou espera-se.
- **Só o dólar.** Ação em euro ou libra precisa entrar na lista, com o cuidado do
  `GBp`.
- **Cripto ficou de fora** por ora: mesma mecânica, símbolo diferente
  (`BTC-USD`), e nenhuma na carteira para verificar. `quoteProviderFor` é o ponto
  de entrada.
- **A moeda da compra não fica registrada.** Depois de convertida, o app não sabe
  mais que aquela compra foi feita em dólar — o painel expandido mostra reais. Se
  um dia isso incomodar, é uma coluna em `AssetOperation`, não um redesenho.
- **Imposto sobre ativo no exterior** (Lei 14.754/2023) não é modelado; a carteira
  inteira é bruta por decisão anterior.
