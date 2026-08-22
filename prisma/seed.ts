// Database seed script.
//
// Role in the architecture: this file populates the database with the data the
// app needs to work out of the box:
//   - a single local user (Phase 1 has no real auth, see ADR-004);
//   - the default Categories (the 6 "jars"/potes for expenses + income sources);
//   - a small starter set of Tags (markers/marcadores);
//   - a default bank account (transactions require one);
//   - a starting checklist of scoring questions (Phase 2).
//
// How it runs: `prisma db seed` (configured in package.json) executes this file
// with `tsx`, which runs TypeScript directly without a separate compile step.
//
// Why it is idempotent: every write uses `upsert` (update-or-insert) or guards
// against duplicates, so running the seed twice never creates duplicate rows.
// That matters because we re-run it during development.

import { PrismaClient, TransactionType, ScoreScope } from '@prisma/client'

// The seed is a standalone script (not part of the Next.js request lifecycle),
// so we create a plain client here instead of importing the app singleton.
const prisma = new PrismaClient()

// The fixed local user. Phase 1 is single-user and local-only, so we keep a
// stable, well-known identity instead of a sign-up flow.
const LOCAL_USER = {
  email: 'local@finra.app',
  name: 'Local User',
}

// --- Categories ("jars"/potes) -------------------------------------------
// Expenses follow the 6-jars budgeting method. Income uses its own sources,
// because the jars describe HOW you spend, not HOW you earn.
// `targetPercent` is the share of monthly income for each expense jar; the six
// defaults sum to 100. Income categories keep 0 (the share is a spending plan).
const CATEGORIES: Array<{
  name: string
  icon: string
  color: string
  type: TransactionType
  targetPercent: number
}> = [
  // Expenses — the 6 jars (percentages sum to 100)
  { name: 'Custos Fixos', icon: '🏠', color: '#ef4444', type: 'expense', targetPercent: 55 },
  { name: 'Conforto', icon: '🛋️', color: '#f97316', type: 'expense', targetPercent: 10 },
  { name: 'Prazeres', icon: '🎉', color: '#ec4899', type: 'expense', targetPercent: 10 },
  { name: 'Metas', icon: '🎯', color: '#8b5cf6', type: 'expense', targetPercent: 5 },
  { name: 'Liberdade Financeira', icon: '📈', color: '#22c55e', type: 'expense', targetPercent: 10 },
  { name: 'Conhecimento', icon: '📚', color: '#3b82f6', type: 'expense', targetPercent: 10 },
  // Income — sources (no target share)
  { name: 'Salário', icon: '💰', color: '#16a34a', type: 'income', targetPercent: 0 },
  { name: 'Freela', icon: '💼', color: '#14b8a6', type: 'income', targetPercent: 0 },
  { name: 'Rendimentos', icon: '🪙', color: '#0ea5e9', type: 'income', targetPercent: 0 },
  { name: 'Outras Receitas', icon: '➕', color: '#6b7280', type: 'income', targetPercent: 0 },
  // Carry-over ("saldo transportado") — a dedicated category, kept separate from
  // the six real jars, used to move a month's leftover into the next month as a
  // manual pair: an EXPENSE that zeroes the closing month + an INCOME that opens
  // the next month. The two cancel out in "Total em conta" (no double-counting),
  // while the income side feeds the next month's budget so the leftover can be
  // spent without blowing the jars. It exists for both types and takes 0% so it
  // never competes for budget share with the real jars.
  { name: 'Saldo transportado', icon: '🔄', color: '#64748b', type: 'expense', targetPercent: 0 },
  { name: 'Saldo transportado', icon: '🔄', color: '#64748b', type: 'income', targetPercent: 0 },
]

// --- Tags (markers/marcadores) -------------------------------------------
// Reusable free-form labels. We seed a few common ones; the user creates more
// on the fly while adding transactions.
const TAGS: Array<{ name: string; color: string }> = [
  { name: 'combustível', color: '#eab308' },
  { name: 'assinatura', color: '#8b5cf6' },
  { name: 'viagem', color: '#06b6d4' },
  { name: 'presente', color: '#ec4899' },
]

// --- Scoring checklist (Phase 2) -----------------------------------------
// A STARTING set of yes/no questions used to grade stocks and FIIs (ADR-009).
// These are only a starting point: the user edits, reorders, adds and removes
// them in Configurações, and the seed never touches a scope that already has
// questions (see the guard in main()).
//
// The order here is the order they get on screen — `position` is the index.

const STOCK_QUESTIONS: { text: string; hint: string | null }[] = [
  {
    text: 'Empresas: Dívida Líquida/EBITDA é menor que 2,5x? (Bancos: Índice de Basileia é maior ou igual a 14%?)',
    hint: 'Histórico: 5 anos',
  },
  { text: 'ROE médio é maior ou igual a 15%?', hint: 'Histórico: 5 anos' },
  { text: 'Teve lucro líquido positivo em todos os anos?', hint: 'Histórico: 5 anos' },
  { text: 'A margem líquida está estável ou crescendo?', hint: 'Histórico: 5 anos' },
  { text: 'O payout está entre 25% e 80%?', hint: 'Nem retém tudo, nem distribui além do que ganha' },
  { text: 'O dividend yield médio é maior ou igual a 4% ao ano?', hint: 'Histórico: 5 anos' },
  { text: 'A receita cresce acima da inflação?', hint: 'Histórico: 5 anos' },
  { text: 'O P/L está abaixo da média histórica da própria empresa?', hint: null },
  { text: 'A liquidez diária é maior ou igual a R$ 1 milhão?', hint: 'Dá para sair da posição sem derrubar o preço' },
  { text: 'Está no Novo Mercado ou Nível 2? (Internacional: sem histórico de fraude contábil)', hint: 'Governança' },
]

const FII_QUESTIONS: { text: string; hint: string | null }[] = [
  { text: 'A vacância física é menor que 10%?', hint: null },
  { text: 'A vacância financeira é menor que 10%?', hint: null },
  { text: 'O P/VP é menor ou igual a 1,05?', hint: 'Não está pagando ágio sobre o patrimônio' },
  { text: 'O dividend yield é maior ou igual a 8% ao ano?', hint: 'Histórico: 12 meses' },
  { text: 'O patrimônio líquido é maior ou igual a R$ 500 milhões?', hint: null },
  { text: 'A liquidez diária é maior ou igual a R$ 1 milhão?', hint: null },
  { text: 'Tem pelo menos 10 imóveis (ou 10 devedores, se for de papel)?', hint: 'Diversificação' },
  { text: 'Nenhum inquilino representa mais de 25% da receita?', hint: 'Concentração' },
  { text: 'Os contratos são majoritariamente atípicos ou de longo prazo?', hint: null },
  { text: 'A distribuição está estável ou crescendo?', hint: 'Histórico: 24 meses' },
]

const CHECKLISTS: { scope: ScoreScope; questions: { text: string; hint: string | null }[] }[] = [
  { scope: ScoreScope.stocks, questions: STOCK_QUESTIONS },
  { scope: ScoreScope.fiis, questions: FII_QUESTIONS },
]

async function main() {
  // 1) Ensure the local user exists. `upsert` looks up by the unique `email`:
  //    if found it leaves it as-is (update {}), otherwise it creates it.
  const user = await prisma.user.upsert({
    where: { email: LOCAL_USER.email },
    update: {},
    create: LOCAL_USER,
  })
  console.log(`✓ Local user ready: ${user.name} <${user.email}> (${user.id})`)

  // 2) Categories. There is no unique constraint on (userId, name), so we
  //    check-then-create to stay idempotent without altering the schema.
  //
  //    IMPORTANT: when a category already exists we leave it completely
  //    untouched. `targetPercent` is USER-OWNED — it's edited in Configurações
  //    ("Metas dos potes") and must sum to the user's own plan. An earlier
  //    version re-applied the default targetPercent here, which meant re-running
  //    the seed (e.g. to add a new default category) silently overwrote the
  //    user's customized percentages back to the defaults. So the seed only ever
  //    CREATES missing categories; it never edits existing ones.
  let categoriesCreated = 0
  for (const category of CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { userId: user.id, name: category.name, type: category.type },
    })
    if (existing) continue
    await prisma.category.create({ data: { ...category, userId: user.id } })
    categoriesCreated++
  }
  console.log(
    `✓ Categories: ${categoriesCreated} created, ` +
      `${CATEGORIES.length - categoriesCreated} left untouched`,
  )

  // 3) Tags. Tag has a unique (userId, name) constraint, so a real `upsert`
  //    works here. The composite unique key is named `userId_name` by Prisma.
  //    Upsert is naturally idempotent: existing tags are left untouched.
  for (const tag of TAGS) {
    await prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: tag.name } },
      update: {},
      create: { ...tag, userId: user.id },
    })
  }
  console.log(`✓ Tags ready: ${TAGS.length} present`)

  // 4) Default bank account. Transactions require an account, so every user needs
  //    at least one. We use a deterministic id ('acct_' + userId) — the same the
  //    add_bank_accounts migration used to back-fill — so seeding stays
  //    idempotent and never creates a second default.
  await prisma.bankAccount.upsert({
    where: { id: `acct_${user.id}` },
    update: {},
    create: {
      id: `acct_${user.id}`,
      name: 'Conta principal',
      initialBalance: 0,
      userId: user.id,
    },
  })
  console.log('✓ Default bank account ready: Conta principal')

  // 5) Scoring checklists. Same rule the categories learned the hard way: the
  //    seed only ever CREATES what is missing, never edits what is there. Here
  //    the guard is per SCOPE — once a checklist has any question at all, it
  //    belongs to the user (they may have deleted the ones they disagreed with),
  //    so re-seeding must not resurrect the defaults.
  for (const checklist of CHECKLISTS) {
    const existing = await prisma.scoreQuestion.count({
      where: { userId: user.id, scope: checklist.scope },
    })
    if (existing > 0) {
      console.log(
        `✓ Checklist "${checklist.scope}": ${existing} question(s) already there, left untouched`,
      )
      continue
    }

    await prisma.scoreQuestion.createMany({
      data: checklist.questions.map((question, index) => ({
        userId: user.id,
        scope: checklist.scope,
        text: question.text,
        hint: question.hint,
        position: index,
      })),
    })
    console.log(
      `✓ Checklist "${checklist.scope}": ${checklist.questions.length} starter question(s) created`,
    )
  }

  console.log('🌱 Seed complete.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    // Always surface the error and disconnect cleanly, then exit non-zero so a
    // failed seed is visible in CI / the terminal.
    console.error('Seed failed:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
