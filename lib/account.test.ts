// Unit tests for the account balance helper.
//
// Pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import { computeAccountBalances, type AccountInfo } from '@/lib/account'

const accounts: AccountInfo[] = [
  { id: 'a', name: 'Conta A', initialBalance: 100000, color: '#111' },
  { id: 'b', name: 'Conta B', initialBalance: 0, color: '#222' },
]

describe('computeAccountBalances', () => {
  it('balance = initial + income − expense per account', () => {
    const { accounts: rows, total } = computeAccountBalances(accounts, [
      { accountId: 'a', type: 'income', amount: 50000 },
      { accountId: 'a', type: 'expense', amount: 20000 },
      { accountId: 'b', type: 'income', amount: 30000 },
    ])
    // A: 100000 + 50000 − 20000 = 130000; B: 0 + 30000 = 30000.
    expect(rows.find((r) => r.id === 'a')?.balance).toBe(130000)
    expect(rows.find((r) => r.id === 'b')?.balance).toBe(30000)
    expect(total).toBe(160000)
  })

  it('an account with no transactions keeps its initial balance', () => {
    const { accounts: rows, total } = computeAccountBalances(accounts, [])
    expect(rows.map((r) => r.balance)).toEqual([100000, 0])
    expect(total).toBe(100000)
  })

  it('can go negative when expenses exceed initial + income', () => {
    const { total } = computeAccountBalances(
      [{ id: 'a', name: 'A', initialBalance: 0, color: '#000' }],
      [{ accountId: 'a', type: 'expense', amount: 5000 }],
    )
    expect(total).toBe(-5000)
  })

  it('preserves the account order and totals zero with no accounts', () => {
    const { accounts: rows, total } = computeAccountBalances([], [])
    expect(rows).toEqual([])
    expect(total).toBe(0)
  })
})
