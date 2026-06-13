// Dashboard — the home page, served at the "/" route.
//
// In the Next.js App Router, app/page.tsx is the "/" route. With no "use client"
// directive this is a Server Component: it runs only on the server, so it can
// query Prisma directly and send finished HTML to the browser. It gathers the
// current month's numbers and hands plain data to presentational components.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { monthRange, budgetStatus, MONTH_LABELS } from '@/lib/budget'
import {
  lastNMonths,
  buildMonthlySeries,
  type SeriesTransaction,
} from '@/lib/dashboard'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { BudgetSummary } from '@/components/dashboard/budget-summary'
import { BalanceChart } from '@/components/dashboard/balance-chart'
import {
  RecentTransactions,
  type RecentRow,
} from '@/components/dashboard/recent-transactions'

// How many months the evolution chart looks back (including the current month).
const CHART_MONTHS = 6

// Always render fresh data: the dashboard reflects the latest transactions.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getLocalUser()

  const now = new Date()
  const month = now.getUTCMonth() + 1
  const year = now.getUTCFullYear()
  const { gte, lt } = monthRange(year, month)

  // The 6-month window for the evolution chart: the months run oldest → newest,
  // so the first one gives the lower bound (gte) and the current month's `lt`
  // (already computed above) gives the exclusive upper bound.
  const chartMonths = lastNMonths({ month, year }, CHART_MONTHS)
  const chartStart = monthRange(chartMonths[0].year, chartMonths[0].month).gte

  // Fetch everything in parallel (independent queries, one round-trip each):
  //  - totals per type this month;
  //  - this month's budgets and the spending per category;
  //  - the latest 5 transactions.
  const [totalsByType, budgets, spentByCategory, recent, chartTxns] =
    await Promise.all([
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId: user.id, date: { gte, lt } },
      _sum: { amount: true },
    }),
    prisma.budget.findMany({
      where: { userId: user.id, month, year },
      select: { categoryId: true, amountLimit: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId: user.id, type: 'expense', date: { gte, lt } },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        category: { select: { name: true, icon: true, color: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    // Raw rows for the 6-month chart: we fetch the minimal fields and aggregate
    // per month in JS (buildMonthlySeries), since Prisma can't group by month.
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: chartStart, lt } },
      select: { type: true, amount: true, date: true },
    }),
  ])

  // Turn the flat rows into one point per month (zeros for empty months). The
  // cast is safe: `type` is always 'income' | 'expense' in our data.
  const series = buildMonthlySeries(chartTxns as SeriesTransaction[], chartMonths)

  // Pull the income/expense sums out of the grouped result.
  const income =
    totalsByType.find((t) => t.type === 'income')?._sum.amount ?? 0
  const expense =
    totalsByType.find((t) => t.type === 'expense')?._sum.amount ?? 0

  // Spending lookup per category, then count budgets by alert level (same
  // thresholds as the budgets screen, via budgetStatus).
  const spentMap = new Map<string, number>()
  for (const row of spentByCategory) {
    spentMap.set(row.categoryId, row._sum.amount ?? 0)
  }
  const counts = { ok: 0, warning: 0, over: 0 }
  for (const b of budgets) {
    counts[budgetStatus(spentMap.get(b.categoryId) ?? 0, b.amountLimit).level] += 1
  }

  // The type cast is safe: the select above returns exactly RecentRow's shape.
  const recentRows = recent as RecentRow[]

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Resumo de {MONTH_LABELS[month]} de {year}.
        </p>
      </header>

      <SummaryCards income={income} expense={expense} />

      <BalanceChart data={series} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BudgetSummary
          total={budgets.length}
          ok={counts.ok}
          warning={counts.warning}
          over={counts.over}
        />
        <RecentTransactions items={recentRows} />
      </div>
    </main>
  )
}
