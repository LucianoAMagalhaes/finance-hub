# ADR-010: Cotações automáticas via Yahoo Finance, sob botão e só em reais

**Data:** 2026-08-27
**Status:** accepted

## Contexto

Desde a `feat/portfolio-assets` a cotação de cada ativo é **digitada à mão** na
própria célula da tabela da Carteira. A decisão foi consciente
([ADR-008](ADR-008-investimentos-modulo-separado.md)): carteira manual primeiro,
API depois.

O "depois" chegou por um motivo medido, não estético. Três números da aplicação
dependem da cotação — o card **"Valor atual"**, o **resultado** de cada linha e,
o mais caro, a **lacuna** que a tela de Aportes usa para decidir onde colocar o
próximo dinheiro ([ADR-009](ADR-009-nota-do-ativo-e-sugestao-de-aporte.md)). E o
banco mostrava que o preenchimento manual simplesmente **não estava
acontecendo**: os 16 ativos da carteira estavam com `current_price_cents` NULL.
Uma sugestão de aporte calculada sobre preço de custo é uma sugestão errada.

Duas restrições vieram do desenvolvedor durante a decisão: **não pagar nada** por
dados de mercado, e a pergunta que abriu tudo — *dá para usar a mesma API que o
Google Finance usa?*

## Decisão

**Cotação automática via endpoint de gráfico do Yahoo Finance
(`query1.finance.yahoo.com/v8/finance/chart`), disparada por um botão "Atualizar
cotações" na Carteira, e apenas para o que é negociado em reais.**

Quatro escolhas dentro disso:

1. **Gatilho manual, não automático.** O botão dispara a busca; abrir a tela não
   dispara nada. Uma busca no carregamento faria requisição a cada F5 e deixaria
   a página esperando o mercado responder.
2. **A linha de corte é a MOEDA, não a cobertura.** O Yahoo cota muito mais do
   que se busca aqui — AAPL, VOO, BTC —, mas responde esses em dólar, e
   `Asset.currentPriceCents` são centavos de **real** sem coluna de moeda ao
   lado. Então busca-se só o que já é negociado em real, o que na prática é
   **tudo que está na B3**: ações, FIIs, ETFs brasileiros (BOVA11, IVVB11) e
   BDRs (AAPL34) — todos verificados ao vivo. Cripto, ação listada no exterior e
   Tesouro seguem na célula manual.
3. **Uma trava de moeda no caminho da escrita.** `brlQuoteToCents` recusa
   qualquer cotação que não venha em `BRL`. Um sufixo errado, ou um ticker que
   também existe em outra bolsa, gravaria um preço em dólar numa coluna que
   significa real — o ativo passaria a valer cinco vezes menos, calado. Recusar
   faz o ticker ser reportado como "sem retorno" e manter o preço que tinha.
4. **Duas camadas.** `lib/quotes.ts` é puro e testado (mapa tipo → provedor,
   símbolo do Yahoo, conversão, trava de moeda, resumo da execução);
   `lib/yahoo.ts` é a única parte que fala com a rede. Mesma separação que já
   existe entre `lib/portfolio.ts` e a page.

Duas regras de comportamento que valem tanto quanto a escolha do provedor:

- **Ticker sem retorno mantém a cotação anterior**, e aparece nomeado no resumo
  ("2 sem retorno (XPML11, TGAR11)"). Apagar faria a carteira ler como se
  valesse menos do que vale.
- **Preço igual não é gravado**, então `priceUpdatedAt` continua significando
  "este preço é de tal dia" e não "cliquei no botão hoje" — a mesma regra que
  `nextPriceStamp` já aplicava à célula manual, e da qual depende o aviso âmbar
  de cotação velha (`isPriceStale`).

## Alternativas consideradas

- **"A API do Google Finance"** — **não existe.** O Google descontinuou a dela em
  maio de 2011 e desligou em outubro de 2012, e nunca reconstruiu. O que se
  encontra hoje com esse nome são scrapers de terceiros (SerpApi, ScrapFly),
  pagos e contra os termos de uso do Google. O único acesso oficial é a função
  `GOOGLEFINANCE()` **dentro do Google Sheets**, que é fórmula de planilha, não
  API — não há como um servidor Next.js chamá-la.
- **brapi.dev** — chegou a ser **implementada por inteiro** antes desta decisão,
  e é a alternativa mais séria. É brasileira, oficial, documentada, com termos
  claros e plano gratuito honesto (15 mil requisições/mês, sem cartão). Perdeu
  por três motivos somados: exige **criar conta e gerenciar um token** para um
  app local de um usuário só; **atrasa 30 minutos** no plano gratuito; e cobre
  **só a B3**, fechando a porta para cripto e ação internacional caso um dia a
  moeda deixe de ser o impedimento. **Continua sendo o plano B** — se o Yahoo
  quebrar, é para cá que se volta, e o custo é reescrever um arquivo.
- **Alpha Vantage** — oficial e documentada, mas o plano gratuito dá **25
  requisições por dia**. Com 12 tickers, são duas atualizações diárias. Inviável.
- **Twelve Data / Finnhub / FMP** — exigem chave e a cobertura da B3 costuma
  ficar atrás de plano pago; não chegaram a ser testadas porque o Yahoo já
  resolvia sem cadastro.
- **CoinGecko agora** — adiado junto com a cripto: não há nenhum ativo `crypto`
  na carteira, e a decisão 2 acima o deixaria de fora de qualquer forma.
- **Buscar cotação no carregamento da página** — descartado junto com a
  decisão 1.

## Consequências

- **Nenhuma chave de API, nenhum cadastro, nenhum custo.** O `.env` do projeto
  não ganhou variável nova; as que existiam para dados de mercado saíram.
- **Depende de um endpoint interno, não de uma API pública.** O Yahoo pode mudar
  a URL, passar a exigir cookie/crumb ou bloquear, sem aviso — e já fez isso no
  passado. É o preço aceito aqui. A queda está contida: o provedor está isolado
  em um arquivo, o erro vira uma frase em português abaixo do botão, nenhum dado
  é alterado numa falha, e a célula manual continua funcionando. Formalmente
  também contraria os termos de uso do Yahoo; num app local, de uso pessoal e de
  baixo volume, o risco prático é o endpoint quebrar, não uma consequência
  jurídica.
- **O endpoint estrangula rajadas.** Doze tickers disparados quatro a quatro
  bastaram para provocar `429` nos testes. Por isso o cliente usa **duas
  conexões** e **repete uma vez** depois de uma pausa; só a segunda recusa vira
  mensagem. Descoberta relacionada e contraintuitiva: o `User-Agent` padrão do
  curl é recusado, então o header é obrigatório — mas ele é um identificador
  honesto (`finance-hub/1.0`), porque dizer-se Chrome sem o fingerprint TLS do
  Chrome é justamente o que checagem anti-bot procura.
- **Cripto e ação internacional continuam manuais** — e agora por um motivo
  registrado (moeda), não por falta de fonte. Quando incomodar, o caminho já
  está desenhado: buscar `USDBRL=X` (que o Yahoo dá de graça) e converter, ou
  guardar a moeda no ativo e converter só na exibição. Cuidado com `GBp`: a bolsa
  de Londres cota em **pence**, não em libras.
- **A cotação continua sendo uma foto, não uma série.** Nada de histórico de
  preço é guardado — só o último valor e sua data. Um gráfico de evolução do
  patrimônio exigiria um modelo novo.
