// Dashboard — the home page, served at the "/" route.
//
// In the Next.js App Router, app/page.tsx is the "/" route. With no "use client"
// directive this is a Server Component: it runs only on the server, so it can
// query Prisma directly and send finished HTML to the browser. It gathers the
// current month's numbers and hands plain data to presentational components.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { monthRange, derivedLimit, MONTH_LABELS } from '@/lib/budget'
import {
  lastNMonths,
  buildMonthlySeries,
  type SeriesTransaction,
} from '@/lib/dashboard'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import {
  DashboardBudget,
  type JarRow,
} from '@/components/dashboard/dashboard-budget'
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
  //  - the expense jars with their target share (limits are derived, not stored);
  //  - this month's expense transactions (used both for spending totals and for
  //    the per-jar drill-down on the dashboard budget section);
  //  - the latest 5 transactions.
  const [totalsByType, expenseCategories, monthExpenseTxns, recent, chartTxns] =
    await Promise.all([
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId: user.id, date: { gte, lt } },
      _sum: { amount: true },
    }),
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
    prisma.transaction.findMany({
      where: { userId: user.id, type: 'expense', date: { gte, lt } },
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        categoryId: true,
        tag: { select: { name: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
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

  // Group this month's expense transactions by category, so each jar can show
  // its total spent and the drill-down list. One pass over the rows.
  const txnsByCategory = new Map<string, JarRow['transactions']>()
  const spentMap = new Map<string, number>()
  for (const t of monthExpenseTxns) {
    spentMap.set(t.categoryId, (spentMap.get(t.categoryId) ?? 0) + t.amount)
    const list = txnsByCategory.get(t.categoryId) ?? []
    list.push({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      tagName: t.tag?.name ?? null,
    })
    txnsByCategory.set(t.categoryId, list)
  }

  // Build one jar row per expense category, with its derived limit and the
  // transactions that make up its spending this month.
  const jars: JarRow[] = expenseCategories.map((c) => ({
    categoryId: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    percent: c.targetPercent,
    limit: derivedLimit(income, c.targetPercent),
    spent: spentMap.get(c.id) ?? 0,
    transactions: txnsByCategory.get(c.id) ?? [],
  }))

  // The type cast is safe: the select above returns exactly RecentRow's shape.
  const recentRows = recent as RecentRow[]

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400">
          Resumo de {MONTH_LABELS[month]} de {year}.
        </p>
      </header>

      <SummaryCards income={income} expense={expense} />

      <BalanceChart data={series} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardBudget jars={jars} income={income} />
        <RecentTransactions items={recentRows} />
      </div>
    </main>
  )
}
