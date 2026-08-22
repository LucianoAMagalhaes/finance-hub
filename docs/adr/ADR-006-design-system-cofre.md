# ADR-006: Design system "cofre" próprio, com tema escuro fixo

**Data:** 2026-06-14
**Status:** accepted

## Contexto

Até junho de 2026 a interface do app era o Tailwind "cru": cada tela escolhia
suas classes utilitárias na hora (`bg-gray-900` aqui, `bg-gray-800` ali, botões
`bg-blue-600`), sem um vocabulário comum. O resultado era um visual inconsistente
entre telas e sem identidade — e a tela de Orçamentos chegou a ser apontada
explicitamente pelo desenvolvedor como visualmente ruim.

Havia ainda um problema concreto de legibilidade: o `globals.css` do scaffold
alternava o tema por `prefers-color-scheme`. Num sistema operacional em tema
claro, os campos de formulário herdavam texto claro sobre fundo claro e ficavam
praticamente invisíveis.

O desenvolvedor então trouxe um mockup pronto — um componente React único de
~1.400 linhas com o layout completo do hub — e pediu para **imitar aquele
layout**. O mockup já vinha com uma paleta batizada de **"cofre"** (grafite
profundo + jade para crescimento, âmbar para alerta, vermelho para estouro),
ícones `lucide-react` e uma composição de dashboard definida.

A decisão a tomar era: adotar uma biblioteca de componentes pronta, ou extrair
os tokens do mockup e construir o design system em cima do Tailwind que já
estava no projeto?

## Decisão

Criar um **design system próprio, mínimo, baseado em tokens de cor no Tailwind**,
derivado do mockup de referência.

- Os tokens `COLORS` do mockup viram a paleta `cofre.*` em
  `tailwind.config.ts` (`bg`, `panel`, `card`, `border`, `borderlight`, `text`,
  `muted`, `faint`, `jade`, `jadedim`, `amber`, `amberdim`, `red`, `reddim`,
  `blue`). A partir daí **toda cor de UI é escrita como `*-cofre-*`** — nenhuma
  tela usa `gray-*`/`blue-*` do Tailwind padrão.
- O **tema é escuro e fixo**. O `prefers-color-scheme` saiu do `globals.css`;
  no lugar ficam o backdrop grafite em `:root`, um `color-scheme: dark` (para os
  controles nativos — date picker, dropdown, scrollbar — renderizarem legíveis)
  e um default de `background-color`/`color` para `input`, `select` e `textarea`,
  que sem isso herdariam a página e sumiriam.
- **`lucide-react`** como única biblioteca de ícones (é a do mockup).
- O mockup fica **versionado** em `reference/HubFinanceiro.jsx` como referência
  visual congelada. Ele **não é código do app**: nada o importa, ele não entra
  no build e não deve ser editado para mudar comportamento.
- Cores que vêm do **banco** (o `color` de categoria, marcador e conta, escolhido
  pelo usuário) continuam aplicadas como **inline style** — são dados, não tokens.

A conversão foi feita tela a tela, uma branch por tela (PRs #34–#36 e #41), o
que manteve cada diff auditável como troca de classes.

## Alternativas consideradas

- **Uma lib de componentes (shadcn/ui, MUI, Chakra)** — descartada. O objetivo
  era **imitar um layout específico** que já existia; partir de componentes
  prontos significaria lutar contra os defaults deles para chegar no mesmo
  resultado. Some-se a isso o custo de aprendizado (o desenvolvedor está
  aprendendo Next.js) e uma dependência grande num app de escopo pequeno.
- **Continuar com Tailwind cru, sem tokens** — descartada: era exatamente o
  estado que gerou a inconsistência. Sem nomes semânticos, cada tela reinventa
  a paleta e nada garante que "a borda dos cards" seja a mesma cor em dois
  lugares.
- **Usar o mockup como código de produção** (portar `HubFinanceiro.jsx` para o
  app) — descartada: é um componente monolítico com dados fictícios embutidos e
  sem Server Components, Prisma ou Server Actions. Reescrever as telas existentes
  em cima da nova paleta preservou toda a lógica já testada.
- **Suportar tema claro e escuro** — descartada por ora. Dobra a superfície de
  teste visual num app single-user cujo dono usa o modo escuro; o
  `prefers-color-scheme` do scaffold só tinha produzido campos ilegíveis.

## Consequências

- **Facilita:** um vocabulário único de cor (`text-cofre-muted` diz *o que* a
  cor é, não *qual* cor é); trocar a paleta inteira é editar um objeto em
  `tailwind.config.ts`; telas novas nascem coerentes por copiar as classes das
  existentes.
- **Dificulta:** não há componentes prontos — cada botão, campo e cartão é
  escrito à mão, e padrões repetidos (a const `field` dos formulários, por
  exemplo) hoje são **duplicados** entre arquivos em vez de compartilhados. Se a
  repetição incomodar, o caminho é extrair componentes em `components/ui/`
  (como já foi feito com `modal.tsx`).
- **Atenção no futuro:** (1) usar `cofre-*` em qualquer tela nova — um
  `gray-500` solto volta a destoar; (2) a Fase 2 (Investimentos) vai precisar de
  cores para gráficos de alocação — estendê-las na paleta `cofre`, não inventar
  hex soltos; (3) se algum dia o tema claro entrar, ele terá de ser desenhado,
  não herdado do SO.
