// Bank account domain helpers — pure functions, no I/O.
//
// Role in the architecture: computing each account's current balance lives here,
// isolated from React and Prisma, so it can be unit-tested directly (see
// account.test.ts) and reused. Money is in integer cents (see CLAUDE.md).
//
// An account's current balance = initialBalance + sum(income) − sum(expense)
// over ALL of its transactions (it's a running total, not period-scoped).

export type AccountInfo = {
  id: string
  name: string
  initialBalance: number // cents
  color: string
}

// One row from a Prisma groupBy(['accountId', 'type']) over the transactions.
export type AccountTypeSum = {
  accountId: string
  type: 'income' | 'expense'
  amount: number // cents (the _sum.amount)
}

export type AccountBalance = {
  id: string
  name: string
  color: string
  balance: number // cents
}

/**
 * Computes the current balance of each account plus the grand total.
 *
 * @param accounts - The user's accounts (with their initial balances).
 * @param sums - Per-account, per-type transaction sums (income/expense).
 * @returns The per-account balances (same order as `accounts`) and their total.
 */
export function computeAccountBalances(
  accounts: AccountInfo[],
  sums: AccountTypeSum[],
): { accounts: AccountBalance[]; total: number } {
  // Index the sums by account → { income, expense } for O(1) lookup.
  const byAccount = new Map<string, { income: number; expense: number }>()
  for (const s of sums) {
    const entry = byAccount.get(s.accountId) ?? { income: 0, expense: 0 }
    if (s.type === 'income') entry.income += s.amount
    else entry.expense += s.amount
    byAccount.set(s.accountId, entry)
  }

  const rows = accounts.map((a) => {
    const { income, expense } = byAccount.get(a.id) ?? { income: 0, expense: 0 }
    return {
      id: a.id,
      name: a.name,
      color: a.color,
      balance: a.initialBalance + income - expense,
    }
  })

  const total = rows.reduce((sum, r) => sum + r.balance, 0)
  return { accounts: rows, total }
}

/**
 * Computes the "carry-in" balance for a month: the money already available at
 * the start of the selected period, i.e. what carried over from the previous
 * months. It's the same running-total formula as an account balance, but using
 * only the transactions dated BEFORE the month.
 *
 * This lets the dashboard show last month's leftover as extra money to spend,
 * WITHOUT anyone entering it by hand (which would double-count it against the
 * already-cumulative "total em conta").
 *
 * @param initialBalanceTotal - Sum of every account's initial balance (cents).
 * @param incomeBefore - Sum of income transactions dated before the month (cents).
 * @param expenseBefore - Sum of expense transactions dated before the month (cents).
 * @returns The balance carried into the month (cents; may be negative).
 */
export function carryInBalance(
  initialBalanceTotal: number,
  incomeBefore: number,
  expenseBefore: number,
): number {
  return initialBalanceTotal + incomeBefore - expenseBefore
}
