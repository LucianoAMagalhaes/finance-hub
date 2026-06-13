# ADR-002: PostgreSQL em Docker como banco de dados

**Data:** 2026-06-13
**Status:** accepted

## Contexto

O Finra precisa persistir transações, orçamentos, metas, categorias,
subcategorias e marcadores, com relacionamentos entre eles (uma transação
pertence a uma categoria, opcionalmente a uma subcategoria e a um marcador) e
restrições de integridade (chaves únicas, ações de `ON DELETE`). O app roda
localmente, mas queremos um banco que se comporte como o de produção e que seja
fácil de subir e descartar durante o desenvolvimento.

O ambiente de desenvolvimento é WSL, então depender de instalar e configurar um
serviço de banco direto na máquina seria frágil e difícil de reproduzir.

## Decisão

Usar **PostgreSQL 16** rodando em um container **Docker**, orquestrado por
`docker-compose.yml`. Os dados ficam num volume local (`./data/postgres`) e a
conexão é configurada via `DATABASE_URL` no `.env`.

Pontos que pesaram:

- **Recursos relacionais completos** — chaves estrangeiras com `ON DELETE
  RESTRICT`/`SET NULL`, constraints `UNIQUE` compostas e tipos `ENUM` reais, que
  o app efetivamente usa (ex.: categoria com RESTRICT, tag única por usuário).
- **Reprodutibilidade** — `docker compose up -d` sobe o mesmo Postgres em
  qualquer máquina, sem instalar nada no host; `down` + apagar o volume zera tudo.
- **Paridade com produção** — se um dia o app sair do local, o mesmo SGBD já está
  em uso, sem surpresas de dialeto SQL.

## Alternativas consideradas

- **SQLite** — mais simples (arquivo único, sem container), mas tem suporte mais
  fraco a tipos `ENUM` e a algumas ações de integridade referencial, e diverge do
  que se usaria em produção. Descartado para não limitar o modelo de dados.
- **Postgres instalado direto no host/WSL** — funcionaria, mas é trabalhoso de
  configurar de forma reproduzível no WSL e "suja" a máquina com um serviço
  sempre ativo. O container isola isso.
- **Banco gerenciado na nuvem (Supabase, Neon, RDS)** — contraria a decisão de
  manter o app **local-only** ([ADR-004](ADR-004-local-only-no-deploy.md)) e
  adicionaria latência, custo e necessidade de credenciais externas.

## Consequências

- **Facilita:** subir/derrubar o banco em segundos; usar todo o poder relacional
  do Postgres via Prisma; manter o estado isolado em um volume versionável de
  fato (ignorado no Git).
- **Dificulta:** exige Docker funcionando (no WSL, a integração do Docker Desktop
  precisa estar ativa). Sem o container no ar, o app e os scripts de seed/verify
  não conectam.
- **Atenção no futuro:** valores monetários são inteiros em centavos (ver
  [ADR-005](ADR-005-cents-for-money.md)) e datas são timestamps ISO; o schema é
  gerido por migrations do Prisma ([ADR-003](ADR-003-prisma-orm.md)), então toda
  mudança de estrutura passa por uma migration versionada.
