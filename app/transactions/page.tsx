// Transactions page — route "/transactions".
//
// This is a Server Component (no "use client"): it runs on the server, queries
// the database directly with Prisma, and passes plain data down to the form
// (Client Component) and the list (Server Component). Credentials never reach
// the browser.
//
// Filtering is driven by the URL query string (?type=...&q=...). Next.js passes
// it to this component as the `searchParams` prop, and re-renders the page
// whenever it changes, so each filter change re-runs the query below.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { Money } from '@/components/money'
import {
  parseTransactionFilters,
  buildTransactionWhere,
  hasActiveFilters,
} from '@/lib/transaction-filters'
import { TransactionForm } from './transaction-form'
import { TransactionFilters } from './transaction-filters'
import { TransactionList, type TransactionRow } from './transaction-list'

// Always render fresh data (don't cache this page), since transactions change
// often and we revalidate after each create.
export const dynamic = 'force-dynamic'

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const user = await getLocalUser()

  // Turn the URL query into validated filters and a Prisma `where` clause.
  const filters = parseTransactionFilters(searchParams)
  const where = buildTransactionWhere(user.id, filters)

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
      where, // <- filtered query
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

  // Summary of the currently filtered set (income, expense, balance in cents).
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  const balance = income - expense

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
        <p className="text-sm text-gray-400">
          Registre receitas e despesas do dia a dia.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* List + filters on the left, form on the right (stacks on mobile). */}
        <section className="order-2 lg:order-1">
          <TransactionFilters categories={categories} />

          {/* Result count + totals for the filtered set. */}
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-400">
              {transactions.length}{' '}
              {transactions.length === 1 ? 'transação' : 'transações'}
              {hasActiveFilters(filters) ? ' (filtrado)' : ''}
            </span>
            <span className="ml-auto flex gap-4">
              <span className="text-gray-400">
                Receitas: <Money cents={income} colored />
              </span>
              <span className="text-gray-400">
                Despesas: <Money cents={-expense} colored />
              </span>
              <span className="font-medium text-gray-200">
                Saldo: <Money cents={balance} colored />
              </span>
            </span>
          </div>

          <TransactionList
            items={transactions as TransactionRow[]}
            filtered={hasActiveFilters(filters)}
          />
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
