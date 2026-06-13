// Database seed script.
//
// Role in the architecture: this file populates the database with the data the
// app needs to work out of the box:
//   - a single local user (Phase 1 has no real auth, see ADR-004);
//   - the default Categories (the 6 "jars"/potes for expenses + income sources);
//   - the default Subcategories (free spending areas);
//   - a small starter set of Tags (markers/marcadores).
//
// How it runs: `prisma db seed` (configured in package.json) executes this file
// with `tsx`, which runs TypeScript directly without a separate compile step.
//
// Why it is idempotent: every write uses `upsert` (update-or-insert) or guards
// against duplicates, so running the seed twice never creates duplicate rows.
// That matters because we re-run it during development.

import { PrismaClient, TransactionType } from '@prisma/client'

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
const CATEGORIES: Array<{
  name: string
  icon: string
  color: string
  type: TransactionType
}> = [
  // Expenses — the 6 jars
  { name: 'Custos Fixos', icon: '🏠', color: '#ef4444', type: 'expense' },
  { name: 'Conforto', icon: '🛋️', color: '#f97316', type: 'expense' },
  { name: 'Prazeres', icon: '🎉', color: '#ec4899', type: 'expense' },
  { name: 'Metas', icon: '🎯', color: '#8b5cf6', type: 'expense' },
  { name: 'Liberdade Financeira', icon: '📈', color: '#22c55e', type: 'expense' },
  { name: 'Conhecimento', icon: '📚', color: '#3b82f6', type: 'expense' },
  // Income — sources
  { name: 'Salário', icon: '💰', color: '#16a34a', type: 'income' },
  { name: 'Freela', icon: '💼', color: '#14b8a6', type: 'income' },
  { name: 'Rendimentos', icon: '🪙', color: '#0ea5e9', type: 'income' },
  { name: 'Outras Receitas', icon: '➕', color: '#6b7280', type: 'income' },
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
      `${CATEGORIES.length - categoriesCreated} already existed`,
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
