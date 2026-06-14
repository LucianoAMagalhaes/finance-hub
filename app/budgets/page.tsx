// Budgets page — route "/budgets".
//
// A Server Component: it runs on the server, queries the database with Prisma,
// and passes plain data to the (presentational) list. In the redesigned 6-jars
// model this screen is READ-ONLY: there are no manual budget limits anymore.
// Each expense category (jar) has a target share of monthly income (set on the
// "Metas" screen); here we show, for the selected month, how much was spent in
// each jar against its DERIVED limit = (target percent) × (income this month).

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import {
  monthRange,
  parseBudgetPeriod,
  derivedLimit,
  budgetStatus,
} from '@/lib/budget'
import { BudgetList, type BudgetRow } from './budget-list'
import { BudgetPeriodNav } from './budget-period-nav'

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

  // Fetch in parallel (independent queries, one round-trip each):
  //  - the expense categories (jars) with their target share;
  //  - this month's total income (the base the limits are derived from);
  //  - total spent per category this month (one grouped query, not N queries).
  const [categories, incomeAgg, spentByCategory] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id, type: 'expense' },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        targetPercent: true,
      },
      orderBy: [{ targetPercent: 'desc' }, { name: 'asc' }],
    }),
    // Sum of all income transactions in the month → the income base.
    prisma.transaction.aggregate({
      where: { userId: user.id, type: 'income', date: { gte, lt } },
      _sum: { amount: true },
    }),
    // groupBy sums the expense transactions of each category in one round-trip.
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId: user.id, type: 'expense', date: { gte, lt } },
      _sum: { amount: true },
    }),
  ])

  const income = incomeAgg._sum.amount ?? 0

  // Turn the grouped result into a quick lookup: categoryId -> cents spent.
  const spentMap = new Map<string, number>()
  for (const row of spentByCategory) {
    spentMap.set(row.categoryId, row._sum.amount ?? 0)
  }

  // Build one row per jar: its derived limit and what was spent. Sort the jars
  // that need attention first (highest spending ratio), keeping the Metas order
  // (percent desc) as the tie-breaker for jars without spending yet.
  const rows: BudgetRow[] = categories
    .map((c) => {
      const spent = spentMap.get(c.id) ?? 0
      const limit = derivedLimit(income, c.targetPercent)
      return {
        categoryId: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        percent: c.targetPercent,
        limit,
        spent,
      }
    })
    .sort((a, b) => {
      const ra = a.limit > 0 ? a.spent / a.limit : a.spent > 0 ? Infinity : 0
      const rb = b.limit > 0 ? b.spent / b.limit : b.spent > 0 ? Infinity : 0
      return rb - ra || b.percent - a.percent
    })

  // Period totals for the header summary.
  const totalLimit = rows.reduce((sum, r) => sum + r.limit, 0)
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0)

  // Count jars by alert level for the overview band. Only jars with a real
  // limit (target > 0 and income > 0) carry an alert; 0%/no-income jars are
  // shown neutrally and don't count here.
  const counts = { ok: 0, warning: 0, over: 0 }
  for (const r of rows) {
    if (r.limit > 0) counts[budgetStatus(r.spent, r.limit).level] += 1
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-gray-400">
            Gasto do mês por pote vs o limite derivado da sua meta de renda.
          </p>
        </div>
        {/* Move between months — the period lives in the URL. */}
        <BudgetPeriodNav month={month} year={year} />
      </header>

      <BudgetList
        items={rows}
        income={income}
        totalLimit={totalLimit}
        totalSpent={totalSpent}
        counts={counts}
      />
    </main>
  )
}
