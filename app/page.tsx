// Dashboard — the home page, served at the "/" route.
//
// In the Next.js App Router, app/page.tsx is the "/" route. With no "use client"
// directive this is a Server Component: it runs only on the server, so it can
// query Prisma directly and send finished HTML to the browser. It gathers the
// current month's numbers and hands plain data to presentational components.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { monthRange, parseBudgetPeriod, derivedLimit, MONTH_LABELS } from '@/lib/budget'
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
  ResumoPotesTable,
  type PoteSummaryRow,
} from '@/components/dashboard/resumo-potes-table'
import { BarList, type Bar } from '@/components/dashboard/bar-list'
import { PeriodSelector } from '@/components/dashboard/period-selector'
import { AccountsBalanceCard } from '@/components/dashboard/accounts-balance-card'
import { computeAccountBalances, carryInBalance } from '@/lib/account'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_COLORS,
  type PaymentMethod,
} from '@/lib/constants'

// Color/label for expenses that have no marker, shown as one "Sem tag" bar.
const UNTAGGED_COLOR = '#6b7280' // gray-500
const UNTAGGED_LABEL = 'Sem tag'

// How many months the evolution chart looks back (including the current month).
const CHART_MONTHS = 6

// Always render fresh data: the dashboard reflects the latest transactions.
export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const user = await getLocalUser()

  // The period (?month=&year=) comes from the URL so it's shareable and the
  // selector can change it; missing/invalid values fall back to the current
  // month. parseBudgetPeriod is the same helper the budgets screen used.
  const { month, year } = parseBudgetPeriod(searchParams, new Date())
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
  //  - the accounts and their all-time per-type sums (for the "total em conta"
  //    card, which is a running balance — NOT scoped to the selected month).
  const [
    totalsByType,
    beforeMonthTotals,
    expenseCategories,
    monthExpenseTxns,
    chartTxns,
    accounts,
    accountSums,
  ] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId: user.id, date: { gte, lt } },
      _sum: { amount: true },
    }),
    // Totals per type for everything dated BEFORE this month — feeds the
    // "saldo anterior" (carry-in) card, so last month's leftover shows up as
    // money available now, computed (never entered by hand → no double count).
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId: user.id, date: { lt: gte } },
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
        paymentMethod: true,
        tag: { select: { name: true, color: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    // Raw rows for the 6-month chart: we fetch the minimal fields and aggregate
    // per month in JS (buildMonthlySeries), since Prisma can't group by month.
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: chartStart, lt } },
      select: { type: true, amount: true, date: true },
    }),
    prisma.bankAccount.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, initialBalance: true, color: true },
      orderBy: { name: 'asc' },
    }),
    // All-time income/expense sum per account (no date filter): the running
    // balance ignores the selected period.
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { userId: user.id },
      _sum: { amount: true },
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

  // "Saldo anterior" — the balance carried into this month: every account's
  // initial balance plus all income minus all expenses dated before the month.
  const incomeBefore =
    beforeMonthTotals.find((t) => t.type === 'income')?._sum.amount ?? 0
  const expenseBefore =
    beforeMonthTotals.find((t) => t.type === 'expense')?._sum.amount ?? 0
  const initialBalanceTotal = accounts.reduce(
    (sum, a) => sum + a.initialBalance,
    0,
  )
  const previousBalance = carryInBalance(
    initialBalanceTotal,
    incomeBefore,
    expenseBefore,
  )

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

  // Aggregate this month's expenses two ways from the same rows (no extra
  // queries): by marker (tag) and by payment method. Both feed the bar lists.
  const tagTotals = new Map<string, { color: string; total: number }>()
  const paymentTotals = new Map<PaymentMethod, number>()
  for (const t of monthExpenseTxns) {
    // By tag (untagged expenses share a single "Sem tag" bucket).
    const name = t.tag?.name ?? UNTAGGED_LABEL
    const color = t.tag?.color ?? UNTAGGED_COLOR
    const entry = tagTotals.get(name) ?? { color, total: 0 }
    entry.total += t.amount
    tagTotals.set(name, entry)

    // By payment method.
    const pm = t.paymentMethod
    paymentTotals.set(pm, (paymentTotals.get(pm) ?? 0) + t.amount)
  }

  const tagBars: Bar[] = Array.from(tagTotals, ([name, v]) => ({
    key: name,
    label: name,
    color: v.color,
    value: v.total,
  })).sort((a, b) => b.value - a.value)

  const paymentBars: Bar[] = Array.from(paymentTotals, ([pm, value]) => ({
    key: pm,
    label: PAYMENT_METHOD_LABELS[pm],
    color: PAYMENT_METHOD_COLORS[pm],
    value,
  })).sort((a, b) => b.value - a.value)

  // Rows for the "Resumo por pote" table (one per expense jar, in jar order).
  const poteRows: PoteSummaryRow[] = jars.map((j) => ({
    categoryId: j.categoryId,
    name: j.name,
    icon: j.icon,
    color: j.color,
    limit: j.limit,
    spent: j.spent,
  }))

  // Human-readable period label reused across the cards.
  const periodLabel = `${MONTH_LABELS[month]} ${year}`

  // Current balance per account (initial + income − expense, all-time) + total.
  const { accounts: accountBalances, total: totalInAccounts } =
    computeAccountBalances(
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        initialBalance: a.initialBalance,
        color: a.color ?? UNTAGGED_COLOR,
      })),
      accountSums.map((s) => ({
        accountId: s.accountId,
        type: s.type,
        amount: s._sum.amount ?? 0,
      })),
    )

  return (
    <main className="max-w-[1320px] space-y-5 p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-cofre-muted">Visão geral das suas finanças</p>
        </div>
        {/* Month/year dropdowns — they push the period into the URL. */}
        <PeriodSelector month={month} year={year} />
      </header>

      {/* Row 1: headline figures. Total em conta (running balance) + month totals. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <AccountsBalanceCard total={totalInAccounts} accounts={accountBalances} />
        <SummaryCards
          income={income}
          expense={expense}
          previousBalance={previousBalance}
          periodLabel={periodLabel}
        />
      </div>

      {/* Row 2: balance evolution chart + per-jar summary table. */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <BalanceChart data={series} />
        <ResumoPotesTable
          rows={poteRows}
          totalSpent={expense}
          periodLabel={periodLabel}
        />
      </div>

      {/* Row 3: budget per jar (3-col cards) with drill-down. */}
      <DashboardBudget jars={jars} income={income} />

      {/* Row 4: expenses broken down by tag and by payment method. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Despesas por marcador"
          items={tagBars}
          emptyText="Nenhuma despesa neste mês."
        />
        <BarList
          title="Despesas por forma de pagamento"
          items={paymentBars}
          emptyText="Nenhuma despesa neste mês."
        />
      </div>
    </main>
  )
}
