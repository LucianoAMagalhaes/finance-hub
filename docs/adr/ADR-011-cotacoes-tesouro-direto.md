# ADR-011: Cotações do Tesouro Direto pelo arquivo do Tesouro Transparente

**Data:** 2026-08-29
**Status:** accepted

## Contexto

O [ADR-010](ADR-010-cotacoes-automaticas.md) trouxe cotações automáticas para o
que é negociado na B3, via Yahoo Finance, e deixou de fora tudo que **não é
cotado em real** — cripto, ação listada fora e **renda fixa**. Para os dois
primeiros a razão é a moeda. Para a renda fixa, não: um título do Tesouro é
cotado em real, todo dia, publicamente. Ele ficou de fora só porque o Yahoo não
o cobre.

Duas coisas mudaram desde então:

1. A carteira do desenvolvedor é **inteiramente Tesouro Direto** no lado da renda
   fixa — quatro títulos, ~R$ 53 mil, todos sem cotação. Eram a maior fatia do
   patrimônio lendo como "sem cotação" na tela.
2. A branch `feat/treasury-identity` deu ao título uma identidade de máquina: o
   par **(tipo, vencimento)**, em vez do texto livre de até 12 caracteres que
   produzia nomes como `PRE-FIX 2029`.
   Sem essa chave não havia como casar um título com fonte alguma.

## Decisão

Buscar o preço unitário (PU) dos títulos no **arquivo diário do Tesouro
Transparente**, o portal de dados abertos do próprio Tesouro Nacional.

- **Fonte:** `precotaxatesourodireto.csv`, servido por um portal CKAN do governo.
  Sem chave, sem cadastro, sem limite de requisições. Um request traz **todos** os
  títulos — mais simples que o Yahoo, que precisa de um request por ticker.
- **Coluna: `PU Venda Manha`** — o preço pelo qual o Tesouro **recompra** o
  título, que é o que o investidor receberia. Validado contra o extrato real do
  banco: `1,10 × 2.458,57 = 2.704,43` contra os `2.704,41` exibidos. `PU Compra`
  daria `2.730,65`, R$ 26 a mais.
- **Chave de casamento: `(tipo, ano de vencimento)`**, não a data exata. Nenhum
  tipo oferece dois vencimentos no mesmo ano (verificado nos 58 títulos), então o
  ano basta — e perdoa um dia de vencimento digitado de memória. Se dois títulos
  caírem na mesma chave, **os dois** ficam sem preço: virar "sem retorno" é
  visível e inofensivo, precificar um com a cotação do outro seria silencioso e
  errado.
- **O carimbo é a data do arquivo, não a hora do clique.** O arquivo publica o
  preço da **manhã do último dia útil**, então `priceUpdatedAt` recebe aquele dia.
  A coluna Cotação passa a dizer "ontem" com honestidade, e o aviso de cotação
  velha conta certo.
- **Falha de um provedor não derruba o outro.** Yahoo e Tesouro rodam em
  `Promise.allSettled`; se o Tesouro cair, as ações ainda atualizam e o resumo diz
  "Tesouro Direto indisponível". As escritas seguem numa transação só.

### O detalhe que decide a viabilidade

O arquivo tem **13,8 MB** — é a série histórica inteira. Baixá-lo a cada clique
seria inaceitável. Duas descobertas do teste ao vivo resolvem isso:

- ele é servido **do mais recente para o mais antigo**, e os 58 títulos da data
  mais nova cabem nos primeiros ~4 KB;
- **`Range` não é honrado** (`curl -r 0-600` baixou os 13,8 MB inteiros), e não há
  `Content-Length` — a resposta é chunked.

Então o cliente lê os primeiros **32 KB e cancela o stream**: 40 KB em **178 ms**,
0,3% do arquivo. A última linha vem truncada, e o parser simplesmente descarta
qualquer linha sem todos os campos.

## Alternativas consideradas

- **`treasurybondsinfo.json` do tesourodireto.com.br** — o endpoint que o site
  oficial usava, com todos os títulos num JSON pequeno. Seria a opção ideal;
  responde **HTTP 410 Gone**. Testado, não existe mais.
- **brapi.dev** — já é o plano B do ADR-010 e tem endpoint de Tesouro. Perde pelos
  mesmos motivos de lá: exige conta e token, e atrasa os dados.
- **Scraping da página do Tesouro Direto** — frágil por construção, e desnecessário
  havendo dado aberto oficial.
- **Baixar o CSV inteiro e cachear em disco** — resolveria o tamanho, mas troca um
  download de 178 ms por um arquivo de 13,8 MB versionado ou em disco, mais a
  lógica de invalidação. Cancelar o stream é mais simples e mais fresco.

## Consequências

**Facilita.** Renda fixa passa a ter valor atual e resultado como qualquer ação, e
o app deixa de subestimar a maior fatia do patrimônio. O provedor é oficial,
gratuito e estável — dado aberto do governo tende a durar mais que um endpoint
interno de empresa.

**Dificulta / a ter em mente:**

- **Cupons continuam fora.** "IPCA+ com Juros Semestrais" e "Renda+" pagam juros
  antes do vencimento, e o app não registra cupom recebido. O resultado desses
  títulos aparece **menor que o real** — mesma lacuna dos dividendos de ações. O
  formulário de compra avisa; a solução é comum às duas e não foi feita aqui.
- **O PU é bruto.** Não desconta IR, IOF nem taxa de custódia da B3, então o
  "Resultado" da tela é maior que o dinheiro que chegaria num resgate hoje.
- **O preço é sempre de um dia útil atrás**, no melhor caso. É a natureza do
  arquivo, não uma limitação do cliente.
- **Um título que sai de negociação some do arquivo.** Ele cai em "sem retorno" e
  **mantém** a última cotação — apagá-la faria a carteira ler como se valesse
  menos do que vale.
- **`quoteProviderFor` agora tem dois valores**, e o guard de `yahooSymbolFor`
  precisou virar `!== 'yahoo'`: com renda fixa deixando de ser `null`, a checagem
  antiga passaria a pedir `"TESOURO IPCA+ 2035.SA"` ao Yahoo.
