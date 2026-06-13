// Dashboard domain helpers — pure functions, no I/O.
//
// Role in the architecture: turns a flat list of transactions into the monthly
// series the 6-month chart needs. Kept free of React and Prisma so it can be
// unit-tested directly (see dashboard.test.ts) and so the page only has to fetch
// rows and hand them over. Money stays in integer cents (see CLAUDE.md).

import { SHORT_MONTH_LABELS, shiftPeriod, type BudgetPeriod } from '@/lib/budget'

// One bar/line group in the chart: a calendar month with its totals in cents.
export type MonthlyPoint = {
  month: number // 1-12
  year: number
  label: string // short month name for the X axis, e.g. "Jun"
  income: number // cents
  expense: number // cents
  balance: number // income - expense, cents (can be negative)
}

// The minimal transaction shape the aggregation needs. The page selects exactly
// these fields, so we don't depend on the full Prisma model here.
export type SeriesTransaction = {
  type: 'income' | 'expense'
  amount: number // cents
  date: Date
}

/**
 * Lists the `count` consecutive periods ending at (and including) `end`, oldest
 * first. For the dashboard chart this is the last 6 months up to the current one.
 *
 * @param end - The most recent period to include (e.g. the current month).
 * @param count - How many months to return (e.g. 6).
 */
export function lastNMonths(end: BudgetPeriod, count: number): BudgetPeriod[] {
  const months: BudgetPeriod[] = []
  // Walk backwards from `end`, then reverse so the result reads left-to-right
  // (oldest → newest), which is how the chart's X axis is drawn.
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftPeriod(end, -i))
  }
  return months
}

/**
 * Aggregates transactions into one MonthlyPoint per period in `months`. Every
 * requested month appears in the output even with no transactions (zeros), so
 * the chart never has gaps.
 *
 * @param transactions - Rows with type/amount/date; dates are UTC midnight.
 * @param months - The periods to produce, oldest first (from lastNMonths).
 */
export function buildMonthlySeries(
  transactions: SeriesTransaction[],
  months: BudgetPeriod[],
): MonthlyPoint[] {
  // Seed an accumulator for each requested month, keyed "year-month", so a
  // single pass over the transactions can find its bucket in O(1).
  const key = (year: number, month: number) => `${year}-${month}`
  const buckets = new Map<string, { income: number; expense: number }>()
  for (const p of months) {
    buckets.set(key(p.year, p.month), { income: 0, expense: 0 })
  }

  for (const tx of transactions) {
    // Dates are stored at UTC midnight, so read the month/year in UTC to match.
    const k = key(tx.date.getUTCFullYear(), tx.date.getUTCMonth() + 1)
    const bucket = buckets.get(k)
    // Ignore anything outside the requested window (defensive: the query should
    // already scope to it).
    if (!bucket) continue
    bucket[tx.type] += tx.amount
  }

  return months.map((p) => {
    const { income, expense } = buckets.get(key(p.year, p.month))!
    return {
      month: p.month,
      year: p.year,
      label: SHORT_MONTH_LABELS[p.month],
      income,
      expense,
      balance: income - expense,
    }
  })
}
