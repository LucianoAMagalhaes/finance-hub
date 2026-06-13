# ADR-004: App local, single-user, sem deploy e sem autenticação complexa

**Data:** 2026-06-13
**Status:** accepted

## Contexto

O Finra nasce como ferramenta de finanças pessoais para um único usuário (o
próprio desenvolvedor), rodando na máquina dele. Não há, no escopo das Fases 1–3,
intenção de servir múltiplos usuários, hospedar na nuvem ou expor o app na
internet. Introduzir autenticação real (login, hash de senha, sessões, OAuth) e
infraestrutura de deploy agora seria custo sem benefício e desviaria o foco do
domínio (orçamento, investimentos, calculadoras).

Ainda assim, o modelo de dados precisa de um "dono" para cada registro, porque as
queries são escritas como se um dia pudessem existir vários usuários.

## Decisão

Tratar o app como **local-only e single-user**, sem deploy e sem fluxo de
autenticação:

- Existe **um usuário fixo**, criado pelo seed (`local@finra.app`).
- `lib/user.ts` expõe `getLocalUser()`, que toda query server-side usa para obter
  o `id` do dono. Se o seed não rodou, a função lança um erro claro.
- Mesmo sem login, **todas as mutações são escopadas ao dono** via
  `where: { id, userId }` (`updateMany`/`deleteMany`), mantendo o padrão que já
  funcionaria num cenário multi-user.
- Sem pipeline de deploy: o app roda com `npm run dev` e o banco via Docker
  Compose ([ADR-002](ADR-002-postgresql-docker.md)).

## Alternativas consideradas

- **Autenticação real desde já (NextAuth/Auth.js, etc.)** — descartada: complexa
  e desnecessária para um app local de um usuário; pode ser adicionada depois sem
  reescrever o modelo, já que tudo é escopado por `userId`.
- **Sem conceito de usuário (registros "soltos")** — descartada: deixaria o
  schema preso ao caso single-user e dificultaria uma eventual evolução
  multi-user; o custo de carregar um `userId` é baixo.
- **Deploy em nuvem desde o início** — fora de escopo (ver "O que não construir"
  no CLAUDE.md): custo, credenciais e superfície de segurança sem retorno agora.

## Consequências

- **Facilita:** desenvolvimento rápido, sem telas de login nem gestão de sessão;
  o código fica focado no domínio financeiro.
- **Dificulta:** o app **não** está pronto para múltiplos usuários nem para ser
  exposto publicamente — não há controle de acesso real, apenas o escopo lógico
  por `userId`. Subir isso na internet sem antes adicionar autenticação seria
  inseguro.
- **Atenção no futuro:** como tudo já é escopado por `userId`, introduzir
  autenticação depois é principalmente trocar `getLocalUser()` pela identidade da
  sessão. O padrão de ownership nas actions é o que torna essa evolução barata.
