# Finra — Hub Financeiro Pessoal

## Visão geral

Aplicativo web de finanças pessoais desenvolvido em fases. O foco inicial é orçamento doméstico completo. Investimentos e calculadoras entram nas fases seguintes.

---

## Estado atual e próximos passos

**Atualizado em:** 2026-06-06

### Concluído
- [x] **Scaffold** Next.js 14 (App Router, TypeScript, Tailwind, ESLint) — `main`, commit `chore: scaffold Next.js 14 project...`. App roda em `http://localhost:3000`.
- [x] **Setup do banco** — branch `chore/database-setup`
  - `docker-compose.yml`, `.env` / `.env.example`, `.gitignore` ajustados
  - `prisma/schema.prisma` com modelos da Fase 1 (User, Category, Transaction, Budget, Goal) — validado
  - Banco no ar (`docker compose up -d`) e migration inicial aplicada (`prisma/migrations/.../init`) — 5 tabelas criadas
  - Prisma Client singleton em `lib/prisma.ts`

- [x] **Modelo de categorias + seed** — branch `feat/category-model-and-seed`
  - Adotado o método dos **6 potes** (Custos Fixos, Conforto, Prazeres, Metas, Liberdade Financeira, Conhecimento) — ver "Modelo de dados (Fase 1)" abaixo
  - Novos modelos `Subcategory` (livre, sem pai fixo) e `Tag` (marcador reutilizável, 1 por transação); `Transaction` ganhou `subcategoryId?` e `tagId?`
  - Migration `add_subcategories_and_tags` aplicada (7 tabelas)
  - `prisma/seed.ts` idempotente (`tsx`) registrado em `package.json` (`npm run db:seed`): usuário local + 10 categorias + 8 subcategorias + 4 marcadores

### Em andamento
- [ ] Nada em andamento — pronto para iniciar `feat/transactions`

### Próximos passos (Fase 1 — uma branch por funcionalidade)
1. `feat/transactions` — CRUD de transações + filtros + busca
2. `feat/budgets` — orçamentos com alertas visuais 80% / 100%
3. `feat/goals` — metas com progresso e aporte mensal sugerido
4. `feat/dashboard` — saldo do mês, gráfico de 6 meses, resumos
5. `feat/settings` — perfil, categorias, subcategorias e marcadores personalizados
6. `docs/initial-adrs` — ADRs 001–005

### Método de trabalho
Cada funcionalidade em sua própria branch (`<tipo>/<descricao-kebab>`). Ir **por partes**: construir um pedaço pequeno, **ver funcionando** na aplicação, e só então commitar/mergear. Esta seção é atualizada a cada milestone.

---

## Stack

- **Framework:** Next.js 14 (App Router)
- **Banco de dados:** PostgreSQL rodando em container Docker
- **ORM:** Prisma
- **Estilo:** Tailwind CSS
- **Gráficos:** Recharts
- **Ambiente:** app roda local (`npm run dev`), banco isolado via Docker Compose

## Ambiente de desenvolvimento

O banco de dados roda em container Docker, o app Next.js roda diretamente na máquina.

```bash
# Subir o banco
docker compose up -d

# Rodar o app
npm run dev
```

`docker-compose.yml` mínimo:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: finra
      POSTGRES_PASSWORD: finra
      POSTGRES_DB: finra
    ports:
      - "5432:5432"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
```

---

## Fases de desenvolvimento

### ✅ Fase 1 — Orçamento doméstico (MVP)

**Objetivo:** controle completo de receitas e despesas do dia a dia.

#### Funcionalidades

**Transações**
- Criar, editar e excluir transação
- Campos obrigatórios: descrição, valor, data, tipo (receita/despesa), categoria, tipo de pagamento
- Tipos de pagamento: dinheiro, débito, crédito, Pix, transferência, boleto
- Filtros: por tipo, categoria, tipo de pagamento, período
- Busca por descrição

**Orçamentos**
- Criar orçamento por categoria (pote) e período (mensal por padrão)
- Definir limite de gasto por categoria (ex: Conforto R$ 800/mês)
- Acompanhar quanto já foi gasto vs o limite definido
- Alertas visuais ao atingir 80% e 100% do limite
- Visão geral de todos os orçamentos do mês

**Categorias, subcategorias e marcadores** (método dos 6 potes)
- **Categoria** (obrigatória): o "pote". Despesa usa os 6 potes — Custos Fixos, Conforto, Prazeres, Metas, Liberdade Financeira, Conhecimento. Receita usa fontes — Salário, Freela, Rendimentos, Outras Receitas. Tem ícone e cor.
- **Subcategoria** (opcional): área de gasto/receita escolhida **livremente**, sem pai fixo — Alimentação, Moradia, Transporte, Saúde, Lazer, Educação, Utilidades, Outros. A mesma subcategoria pode aparecer em potes diferentes.
- **Marcador / Tag** (opcional, **1 por transação**): etiqueta reutilizável criada uma vez e reaproveitada em receitas e despesas — ex: combustível, assinatura, viagem, presente.
- Exemplo: gasolina → Categoria **Conforto** + Subcategoria **Transporte** + Marcador **combustível**.
- Tudo personalizável em Configurações.

**Dashboard (Fase 1)**
- Saldo do mês (receitas − despesas)
- Total de receitas e despesas no período
- Gráfico de evolução do saldo (últimos 6 meses)
- Resumo dos orçamentos: quantos estão no limite, quantos passaram
- Últimas 5 transações

**Metas financeiras**
- Criar meta com nome, valor alvo, prazo e valor atual
- Barra de progresso por meta
- Aporte mensal sugerido calculado automaticamente

#### Modelo de dados (Fase 1)

```
users
  id, email, name, created_at

categories
  id, user_id, name, icon, color, type (income|expense)

subcategories
  id, user_id, name, icon, color, type (income|expense)

tags
  id, user_id, name, color?   -- unique (user_id, name)

transactions
  id, user_id, category_id, subcategory_id?, tag_id?,
  description, amount, date,
  type (income|expense), payment_method
  (cash|debit|credit|pix|transfer|boleto), notes, created_at

budgets
  id, user_id, category_id, amount_limit, month, year, created_at

goals
  id, user_id, name, target_amount, current_amount,
  deadline, monthly_contribution, created_at
```

#### Telas (Fase 1)

1. **Login / Cadastro**
2. **Dashboard** — resumo do mês
3. **Transações** — lista com filtros + formulário de criação/edição
4. **Orçamentos** — lista de orçamentos com progresso + criação
5. **Metas** — lista de metas com progresso + criação
6. **Configurações** — perfil, categorias personalizadas

---

### 🔒 Fase 2 — Investimentos (após Fase 1 concluída)

**Objetivo:** carteira de investimentos com cotações via API.

#### Funcionalidades planejadas

- Cadastro manual de ativos (ação, FII, ETF, BDR, renda fixa, cripto)
- Cotações automáticas via **brapi.dev** (B3) e **CoinGecko** (cripto)
- Câmbio via **AwesomeAPI** e indicadores macro via **API Banco Central (SGS)**
- Rentabilidade por ativo e total da carteira
- Histórico de aportes por ativo
- Gráfico de alocação por tipo de ativo (donut)
- Dividendos recebidos

#### Modelo de dados adicional (Fase 2)

```
assets
  id, user_id, ticker, name, type
  (stock|fii|etf|bdr|fixed_income|crypto),
  quantity, avg_price, created_at

asset_transactions
  id, asset_id, user_id, type (buy|sell|dividend),
  quantity, price, date, created_at
```

---

### 🔒 Fase 3 — Calculadoras (após Fase 2 concluída)

**Objetivo:** ferramentas de simulação financeira.

#### Calculadoras planejadas

- **Juros compostos** — capital inicial + aportes mensais + taxa + período → valor final
- **Aporte necessário** — objetivo + prazo + taxa → aporte mensal
- **Correção IPCA** — valor original + anos → valor corrigido
- **Independência financeira** — renda desejada + taxa de retirada → patrimônio necessário

---

## Convenções de código

### Idiomas
- Todo código (variáveis, funções, componentes, classes) em **inglês**
- Comentários e docstrings em **inglês**
- Documentação (este arquivo e outros `.md`) em **português**, mantendo termos técnicos em inglês

### Nomenclatura
- Componentes React em `PascalCase`
- Funções e variáveis em `camelCase`
- Arquivos de componente em `kebab-case.tsx`
- Constantes globais em `UPPER_SNAKE_CASE`

### Qualidade
- Toda chamada à API com tratamento de erro explícito
- Formulários com validação no cliente (Zod) e no servidor (Prisma + validação manual)
- Valores monetários armazenados em **centavos** (inteiro) no banco; formatados no frontend
- Datas em ISO 8601 no banco; exibidas no formato brasileiro (dd/mm/aaaa) no frontend

### Exemplo de comentário correto

```ts
/**
 * Converts a value in cents to a formatted BRL string.
 * @param cents - Integer value in cents (e.g. 150000 = R$ 1.500,00)
 */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
```

---

## Git

### Commits — Conventional Commits (em inglês)

```
feat: add budget alert when limit reaches 80%
fix: correct transaction amount rounding
chore: update prisma schema for goals table
refactor: extract formatBRL to shared utils
docs: update phase 1 data model
```

Tipos aceitos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`, `perf`

### Branches (em inglês)

```
feat/transaction-filters
feat/budget-overview
fix/goal-progress-calculation
chore/docker-compose-setup
refactor/category-form
```

Padrão: `<tipo>/<descricao-em-kebab-case>`

---

## Variáveis de ambiente

```env
# Database
DATABASE_URL="postgresql://finra:finra@localhost:5432/finra"

# Phase 2 — market data APIs
BRAPI_TOKEN=           # brapi.dev — B3 quotes
COINGECKO_API_KEY=     # CoinGecko Demo (free tier)
```

---

## O que não construir

- Importação de extratos (OFX, CSV) — fora do escopo
- Relatórios e exportação de PDF/Excel — fora do escopo
- Integração com Open Finance / bancos — fora do escopo
- Deploy em nuvem — app é local
- Qualquer funcionalidade de Fase 2 ou 3 antes da Fase 1 estar concluída

---

## Explicações de código

Como o desenvolvedor não tem experiência prévia com Next.js, todo código gerado deve:

- Ter comentários claros explicando **o que** cada bloco faz e **por que** está estruturado assim
- Explicar conceitos do Next.js na primeira vez que aparecerem (ex: o que é um Server Component, o que é uma Server Action, o que é o App Router)
- Evitar abreviações ou "mágicas" sem explicação — se o Next.js faz algo implicitamente, comentar o que está acontecendo nos bastidores
- Ao criar um arquivo novo, comentar no topo qual é o papel daquele arquivo dentro da arquitetura

### Exemplo de comentário esperado

```tsx
// This is a Server Component — it runs only on the server, never in the browser.
// That means we can safely access the database directly here, without exposing
// credentials to the client. Next.js renders this to HTML before sending to the user.
export default async function DashboardPage() {
  // Prisma queries run server-side. The result is passed as props to child components.
  const transactions = await prisma.transaction.findMany({ ... })

  return <TransactionList items={transactions} />
}
```

---

## ADRs — Architecture Decision Records

Cada decisão técnica relevante deve ser documentada como um ADR na pasta `docs/adr/`.

### O que é um ADR

Um ADR é um registro curto que responde três perguntas:
- **O quê:** qual decisão foi tomada
- **Por quê:** quais foram os motivos e alternativas consideradas
- **Consequências:** o que essa decisão implica no futuro

### Quando criar um ADR

Criar um ADR sempre que houver uma decisão sobre:
- Escolha de biblioteca ou ferramenta
- Estrutura de pastas ou arquitetura
- Padrão de código que será seguido em todo o projeto
- Trade-off consciente (escolher A sabendo que abre mão de B)

Não precisa de ADR para decisões triviais (ex: nome de variável, cor de botão).

### Formato padrão

Arquivo: `docs/adr/NNN-titulo-em-kebab-case.md`

```markdown
# ADR-001: Título da decisão

**Data:** YYYY-MM-DD
**Status:** accepted | deprecated | superseded by ADR-XXX

## Contexto

Explica o problema ou situação que gerou a necessidade de uma decisão.
Escreve como se o leitor não tivesse acompanhado o projeto desde o início.

## Decisão

Descreve claramente o que foi decidido.

## Alternativas consideradas

- **Alternativa A** — por que foi descartada
- **Alternativa B** — por que foi descartada

## Consequências

O que essa decisão facilita, o que ela dificulta, e o que o time
precisa ter em mente ao trabalhar com isso no futuro.
```

### ADRs iniciais a criar no início do projeto

| Arquivo | Decisão |
|---|---|
| `ADR-001-next-js-framework.md` | Por que Next.js e não React puro ou outro framework |
| `ADR-002-postgresql-docker.md` | Por que PostgreSQL em Docker e não SQLite ou nuvem |
| `ADR-003-prisma-orm.md` | Por que Prisma e não queries SQL diretas |
| `ADR-004-local-only-no-deploy.md` | Por que app roda só local e sem autenticação complexa |
| `ADR-005-cents-for-money.md` | Por que valores monetários são armazenados em centavos |
