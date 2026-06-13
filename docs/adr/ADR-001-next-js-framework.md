# ADR-001: Next.js 14 (App Router) como framework

**Data:** 2026-06-13
**Status:** accepted

## Contexto

O Finra é um hub financeiro pessoal que precisa de telas interativas (formulários
de transações, orçamentos, metas) **e** de acesso direto ao banco de dados para
ler e gravar esses registros. Como o app roda localmente e é single-user (ver
[ADR-004](ADR-004-local-only-no-deploy.md)), não há necessidade de uma separação
física entre um backend e um frontend: queremos uma stack única, com baixa
cerimônia, que permita escrever a UI e a lógica de servidor no mesmo projeto.

O desenvolvedor também não tem experiência prévia com Next.js, então a escolha
precisa de boa documentação e um modelo mental que dê para aprender enquanto se
constrói.

## Decisão

Usar **Next.js 14 com o App Router** (TypeScript, Tailwind, ESLint).

Pontos que pesaram:

- **Server Components por padrão** — páginas como `app/transactions/page.tsx`
  rodam só no servidor e consultam o Prisma diretamente, sem expor credenciais ao
  browser nem precisar de uma camada de API REST/GraphQL separada.
- **Server Actions** (`'use server'`) — mutações (criar/editar/excluir) são
  funções chamadas direto do Client Component, mas executadas no servidor. Isso
  elimina o boilerplate de rotas de API para cada operação.
- **Roteamento por arquivos** (App Router) — a estrutura de pastas em `app/` já é
  o roteamento, o que mantém o projeto previsível.
- Ecossistema grande, documentação oficial forte e integração natural com React,
  o que ajuda no aprendizado.

## Alternativas consideradas

- **React puro (Vite/CRA) + backend separado (Express/Fastify)** — descartado:
  obrigaria a manter dois projetos, definir e versionar uma API entre eles e
  lidar com CORS/serialização, complexidade sem retorno para um app local.
- **Remix** — bom modelo de dados no servidor, mas comunidade/material menores e
  sem vantagem decisiva sobre Next.js para este caso.
- **SvelteKit / outros** — exigiriam aprender um framework de UI novo além da
  lógica de servidor; React + Next.js concentra o aprendizado em uma stack só.

## Consequências

- **Facilita:** escrever UI e acesso a dados no mesmo lugar; menos código de
  encanamento (sem camada de API manual); deploy futuro simples caso um dia saia
  do local.
- **Dificulta:** a fronteira Server/Client Component é uma fonte recorrente de
  confusão (o que pode rodar no browser, o que não pode). Mitigamos com
  comentários explicativos no código (ver convenção em CLAUDE.md) e mantendo
  componentes de apresentação como Server Components sempre que possível.
- **Atenção no futuro:** Server Actions chamadas fora de um request (ex.: scripts
  de verificação com `tsx`) fazem `revalidatePath` lançar; nesses casos a escrita
  no banco ainda se aplica e devemos validar pelo estado do banco, não pelo
  retorno da action.
