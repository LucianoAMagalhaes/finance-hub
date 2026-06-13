# ADR-003: Prisma como ORM e camada de acesso ao banco

**Data:** 2026-06-13
**Status:** accepted

## Contexto

Com Next.js ([ADR-001](ADR-001-next-js-framework.md)) consultando PostgreSQL
([ADR-002](ADR-002-postgresql-docker.md)) diretamente de Server Components e
Server Actions, precisamos de uma forma de: definir o schema, evoluí-lo de modo
versionado, e escrever queries com segurança de tipos. O desenvolvedor é novo em
Next.js e não quer escrever SQL manual nem gerenciar migrations à mão.

As consultas do app são, na maioria, CRUD com filtros e algumas agregações
(`groupBy` para totais por tipo/categoria, contagens para o dashboard). Não há,
por ora, necessidade de SQL muito sofisticado.

## Decisão

Usar **Prisma** como ORM:

- `prisma/schema.prisma` é a **fonte única de verdade** da estrutura do banco;
  dele são gerados as migrations (`prisma migrate`) e um **client TypeScript
  totalmente tipado** (`@prisma/client`).
- O client é exposto como singleton em `lib/prisma.ts` para evitar múltiplas
  conexões em desenvolvimento (hot reload).
- Convenção: campos do modelo em inglês camelCase, mapeados (`@map`/`@@map`) para
  as colunas/tabelas snake_case documentadas no modelo de dados da Fase 1.

Pontos que pesaram:

- **Type-safety de ponta a ponta** — o resultado das queries já vem tipado, o que
  reduz erros e combina com o TypeScript do resto do projeto.
- **Migrations versionadas** — cada mudança de schema vira um arquivo SQL em
  `prisma/migrations/`, então o histórico do banco fica no Git.
- **Ergonomia** — `findMany`/`create`/`updateMany`/`deleteMany`/`groupBy` cobrem
  bem o CRUD; o padrão de segurança "escopar ao dono" (`where: { id, userId }`)
  fica natural e legível.
- **Seed** — `prisma/seed.ts` (via `tsx`) popula usuário, categorias,
  subcategorias e tags de forma idempotente.

## Alternativas consideradas

- **SQL puro (pg / postgres.js)** — controle total, mas obrigaria a escrever e
  manter queries e tipos à mão e a gerenciar migrations manualmente; mais atrito
  para quem está aprendendo a stack.
- **Drizzle ORM** — também type-safe e mais próximo do SQL, mas com ecossistema e
  material de aprendizado menores na época da decisão; Prisma tem documentação
  mais acessível para iniciantes.
- **TypeORM / Sequelize** — APIs mais antigas, type-safety mais fraca e DX
  inferior à do Prisma.

## Consequências

- **Facilita:** evoluir o schema com migrations rastreáveis; escrever queries
  tipadas e seguras; manter o padrão de ownership; popular o banco com o seed.
- **Dificulta:** queries muito específicas/otimizadas podem esbarrar nas
  abstrações do Prisma — quando necessário, recorrer a `$queryRaw`. Há também o
  passo de `prisma generate` após mudar o schema.
- **Atenção no futuro:** a detecção de erros conhecidos (ex.: violação de
  `UNIQUE`, P2002) deve ser feita pelo **código do erro** (`error.code`) em vez
  de `instanceof PrismaClientKnownRequestError`, que pode falhar quando há mais de
  uma cópia de `@prisma/client` carregada (fronteira de módulos). As ações de
  Settings já seguem essa abordagem.
