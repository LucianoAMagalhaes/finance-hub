// Budget domain helpers — pure functions, no I/O.
//
// Role in the architecture: the rules that decide "how is this budget doing?"
// live here, isolated from React and Prisma so they can be unit-tested directly
// (see budget.test.ts) and reused by any component. Money is in integer cents
// (see CLAUDE.md), so every amount here is a whole number of cents.

// A budget crosses these thresholds as spending grows. The UI turns them into
// colors: ok = green, warning = amber (>=80%), over = red (>=100%).
export const BUDGET_WARNING_RATIO = 0.8

export type BudgetLevel = 'ok' | 'warning' | 'over'

export type BudgetStatus = {
  // Spent as a percentage of the limit, rounded to an integer (can exceed 100).
  percent: number
  // limit - spent, in cents. Negative once the budget is exceeded.
  remaining: number
  level: BudgetLevel
}

/**
 * Computes how a budget is doing given what was spent against its limit.
 *
 * @param spent - Amount spent so far, in integer cents (>= 0).
 * @param limit - Budget limit, in integer cents (> 0).
 */
export function budgetStatus(spent: number, limit: number): BudgetStatus {
  // Guard against a zero/negative limit so we never divide by zero. With no
  // real limit, any spending is already "over".
  if (limit <= 0) {
    return { percent: spent > 0 ? 100 : 0, remaining: -spent, level: spent > 0 ? 'over' : 'ok' }
  }

  const ratio = spent / limit
  const level: BudgetLevel =
    ratio >= 1 ? 'over' : ratio >= BUDGET_WARNING_RATIO ? 'warning' : 'ok'

  return {
    percent: Math.round(ratio * 100),
    remaining: limit - spent,
    level,
  }
}

/**
 * Returns the UTC date range [gte, lt) covering a whole calendar month, suitable
 * for a Prisma `where: { date: { gte, lt } }` filter.
 *
 * Transaction dates are stored at UTC midnight (see the transactions Server
 * Action), so we build the bounds in UTC too. Using a half-open range (< first
 * day of next month) avoids any time-of-day edge cases at month end.
 *
 * @param year - Full year, e.g. 2026.
 * @param month - Month 1-12 (1 = January).
 */
export function monthRange(year: number, month: number): { gte: Date; lt: Date } {
  // Date.UTC handles the December → January rollover for us: month index 12
  // (0-based) becomes January of the next year.
  const gte = new Date(Date.UTC(year, month - 1, 1))
  const lt = new Date(Date.UTC(year, month, 1))
  return { gte, lt }
}

// A calendar period a budget page is showing.
export type BudgetPeriod = { month: number; year: number }

/**
 * Reads and validates the period (?month=&year=) from raw searchParams, falling
 * back to the given "current" date when missing or malformed. Keeping this pure
 * (no `new Date()` inside) makes it directly unit-testable and lets the page
 * decide what "now" means.
 *
 * @param searchParams - Raw query params from the URL.
 * @param now - The date to default to (the page passes `new Date()`).
 */
export function parseBudgetPeriod(
  searchParams: Record<string, string | string[] | undefined>,
  now: Date,
): BudgetPeriod {
  // searchParams values can be string | string[]; take the first one.
  const raw = (key: string): string | undefined => {
    const v = searchParams[key]
    return Array.isArray(v) ? v[0] : v
  }

  const month = Number(raw('month'))
  const year = Number(raw('year'))

  // Drop anything out of range or non-integer — a tampered URL falls back to the
  // current month instead of breaking the query.
  const validMonth = Number.isInteger(month) && month >= 1 && month <= 12
  const validYear = Number.isInteger(year) && year >= 2000 && year <= 2100

  if (validMonth && validYear) return { month, year }

  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() }
}

/**
 * Returns the period `delta` months away, rolling the year over as needed.
 * Used for the previous/next month navigation.
 *
 * @param period - The current { month, year }.
 * @param delta - Months to add (e.g. -1 for previous, +1 for next).
 */
export function shiftPeriod(period: BudgetPeriod, delta: number): BudgetPeriod {
  // Convert to a 0-based absolute month count, shift, then convert back. This
  // handles December → January (and the reverse) without special cases.
  const zeroBased = period.year * 12 + (period.month - 1) + delta
  return {
    year: Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1,
  }
}

// Brazilian month names, indexed 1-12 (index 0 is unused) for display.
export const MONTH_LABELS = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const
