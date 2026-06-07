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
