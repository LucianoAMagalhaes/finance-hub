// Transactions page — route "/transactions".
//
// This is a Server Component (no "use client"): it runs on the server, queries
// the database directly with Prisma, and passes plain data down to the form
// (Client Component) and the list (Server Component). Credentials never reach
// the browser.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { TransactionForm } from './transaction-form'
import { TransactionList, type TransactionRow } from './transaction-list'

// Always render fresh data (don't cache this page), since transactions change
// often and we revalidate after each create.
export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const user = await getLocalUser()

  // Fetch everything the page needs in parallel for speed.
  const [categories, subcategories, tags, transactions] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, icon: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subcategory.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, icon: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.tag.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        paymentMethod: true,
        notes: true,
        category: { select: { name: true, icon: true, color: true } },
        subcategory: { select: { name: true, icon: true } },
        tag: { select: { name: true } },
      },
    }),
  ])

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
        <p className="text-sm text-gray-500">
          Registre receitas e despesas do dia a dia.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* List on the left, form on the right (stacks on small screens). */}
        <section className="order-2 lg:order-1">
          <TransactionList items={transactions as TransactionRow[]} />
        </section>
        <aside className="order-1 lg:order-2">
          <TransactionForm
            categories={categories}
            subcategories={subcategories}
            tags={tags}
          />
        </aside>
      </div>
    </main>
  )
}
