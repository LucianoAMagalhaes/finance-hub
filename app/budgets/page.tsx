// Budgets page — route "/budgets".
//
// A Server Component: it runs on the server, queries the database with Prisma,
// and passes plain data to the form (Client) and the list (Server). For each
// budget it also computes how much was already spent in that category this
// month, so the list can show progress and the 80% / 100% alerts.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { monthRange, parseBudgetPeriod, budgetStatus } from '@/lib/budget'
import { BudgetForm } from './budget-form'
import { BudgetList, type BudgetRow } from './budget-list'
import { BudgetPeriodNav } from './budget-period-nav'
import { BudgetOverview } from './budget-overview'

// Always render fresh data: spending changes as transactions are added.
export const dynamic = 'force-dynamic'

// A page in the App Router receives the URL's query string as `searchParams`.
// We read the period (?month=&year=) from it so the month navigation works and
// the URL stays shareable; missing/invalid values fall back to the current month.
export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const user = await getLocalUser()

  const { month, year } = parseBudgetPeriod(searchParams, new Date())
  const { gte, lt } = monthRange(year, month)

  // Fetch in parallel:
  //  - expense categories (the "jars") for the form's dropdown;
  //  - this month's budgets with their category;
  //  - total spent per category this month (one grouped query, not N queries).
  const [categories, budgets, spentByCategory] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id, type: 'expense' },
      select: { id: true, name: true, icon: true },
      orderBy: { name: 'asc' },
    }),
    prisma.budget.findMany({
      where: { userId: user.id, month, year },
      select: {
        id: true,
        amountLimit: true,
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    }),
    // groupBy sums the expense transactions of each category in one round-trip.
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId: user.id, type: 'expense', date: { gte, lt } },
      _sum: { amount: true },
    }),
  ])

  // Turn the grouped result into a quick lookup: categoryId -> cents spent.
  const spentMap = new Map<string, number>()
  for (const row of spentByCategory) {
    spentMap.set(row.categoryId, row._sum.amount ?? 0)
  }

  // Attach the spent amount to each budget. Sort the most-used budgets first by
  // sorting on spending ratio (descending), so the ones needing attention float
  // to the top.
  const rows: BudgetRow[] = budgets
    .map((b) => ({
      id: b.id,
      amountLimit: b.amountLimit,
      spent: spentMap.get(b.category.id) ?? 0,
      category: b.category,
    }))
    .sort((a, b) => b.spent / b.amountLimit - a.spent / a.amountLimit)

  // Categories that already have a budget this month shouldn't appear again in
  // the form (one budget per category per month).
  const usedCategoryIds = new Set(budgets.map((b) => b.category.id))
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id))

  // Period totals for the header summary.
  const totalLimit = rows.reduce((sum, r) => sum + r.amountLimit, 0)
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0)

  // Count budgets by alert level for the overview band. Reusing budgetStatus
  // keeps the thresholds identical to what each card shows.
  const counts = { ok: 0, warning: 0, over: 0 }
  for (const r of rows) {
    counts[budgetStatus(r.spent, r.amountLimit).level] += 1
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-gray-400">Limites de gasto por pote.</p>
        </div>
        {/* Move between months — the period lives in the URL. */}
        <BudgetPeriodNav month={month} year={year} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="order-2 space-y-4 lg:order-1">
          <BudgetOverview
            ok={counts.ok}
            warning={counts.warning}
            over={counts.over}
            unbudgeted={availableCategories.length}
          />
          <BudgetList items={rows} totalLimit={totalLimit} totalSpent={totalSpent} />
        </section>
        <aside className="order-1 lg:order-2">
          <BudgetForm
            categories={availableCategories}
            month={month}
            year={year}
          />
        </aside>
      </div>
    </main>
  )
}
