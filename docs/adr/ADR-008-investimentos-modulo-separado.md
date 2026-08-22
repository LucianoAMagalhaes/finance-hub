# ADR-008: Carteira de investimentos manual e desacoplada do orçamento doméstico

**Data:** 2026-08-21
**Status:** accepted

## Contexto

Com a Fase 1 concluída, a Fase 2 abre o módulo de **Investimentos**. O
`CLAUDE.md` já previa cotações automáticas (brapi.dev, CoinGecko), proventos e
comparação com benchmarks — um escopo grande para uma primeira entrega.

Havia também uma pergunta de modelagem que decidiria a arquitetura toda: quando
o usuário aporta R$ 1.000,00 em ações, **o dinheiro sai de uma conta bancária**.
O módulo de investimentos deveria criar sozinho a despesa correspondente no pote
"Liberdade Financeira" e debitar a `BankAccount`?

E uma terceira: o mockup de referência (`reference/HubFinanceiro.jsx`) só tem
**placeholders** para investimentos — não havia layout desenhado para copiar.

## Decisão

**Uma carteira manual, separada, e entregue em fatias pequenas.**

1. **Sem acoplamento com o orçamento.** Não há FK entre `AssetOperation` e
   `Transaction`/`BankAccount`; nenhuma query do dashboard toca `assets`; nenhuma
   action de investimento revalida `/` ou `/transactions`. Quem quiser ver o
   aporte no orçamento lança a despesa em "Liberdade Financeira" **à mão**,
   exatamente como já vinha fazendo (o próprio mockup traz a linha "Investimento
   em ações" como despesa).
2. **Preço atual digitado à mão** nesta rodada. `Asset.currentPriceCents` +
   `priceUpdatedAt` já são os campos que a integração com brapi/CoinGecko vai
   preencher, então plugar a API depois não muda o schema.
3. **Posição sempre derivada.** Quantidade, preço médio e valor investido saem
   das operações via `lib/portfolio.ts` (custo médio), nunca são colunas. É o
   mesmo princípio dos limites de orçamento derivados do percentual do pote.
4. **Escopo desta fase: Carteira e Visão Geral.** Proventos e Rentabilidade vs.
   benchmarks ficam para depois — e por isso o enum `AssetOperationType` tem só
   `buy`/`sell`, sem `dividend`.
5. **Sem gráfico de evolução do patrimônio.** Num modelo manual não existe
   histórico de cotações; a única série honesta seria o custo acumulado, e
   rotulá-la como "patrimônio" seria mentira visual. A evolução real espera
   cotações automáticas (e uma futura tabela de snapshots de preço).

## Alternativas consideradas

- **Aporte gera a despesa automaticamente** — descartada. Acopla os dois módulos
  e cria risco de lançamento duplicado com o que o usuário já digita hoje; além
  disso, obrigaria a decidir o que fazer quando ele edita ou exclui um dos lados.
- **Vínculo opcional (checkbox "lançar também como despesa")** — descartada por
  ora: dobra os caminhos a testar logo na primeira versão, para uma conveniência
  que se resolve com dois cliques na tela de Transações.
- **Modelar a carteira como uma `BankAccount` de tipo especial** — descartada:
  exigiria transferências entre contas, que o app não tem (a mesma alternativa
  já havia sido recusada no card "Saldo real (sem crédito)").
- **Começar pela integração de cotações** — descartada: seria a primeira chamada
  HTTP externa do projeto (token, cache, rate limit, tratamento de falha) antes
  de existir uma carteira para exibir.

## Consequências

- **Facilita:** o módulo nasce testável e offline (nenhuma dependência de rede);
  o orçamento doméstico permanece exatamente como está; e cada fatia entrega uma
  tela que dá para ver funcionando.
- **Dificulta:** o usuário lança o aporte **duas vezes** quando quer vê-lo nos
  dois lugares — uma na carteira e outra como despesa. É uma escolha consciente,
  e é o tipo de coisa que alguém tenta "consertar" seis meses depois: quem for
  mexer nisso deve ler este ADR antes.
- **Atenção no futuro:** ao ligar a API de cotações, criar um ADR próprio para a
  estratégia de cache e limite de requisições (o free tier da brapi é de 15.000
  chamadas/mês). E ao adicionar Proventos, o `dividend` entra no enum por
  `ALTER TYPE ... ADD VALUE`, sem recriar a tabela.
