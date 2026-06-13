// Unit tests for the dashboard helpers.
//
// Pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import { lastNMonths, buildMonthlySeries, type SeriesTransaction } from '@/lib/dashboard'

describe('lastNMonths', () => {
  it('returns count periods ending at `end`, oldest first', () => {
    const months = lastNMonths({ month: 6, year: 2026 }, 6)
    expect(months).toEqual([
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
      { month: 3, year: 2026 },
      { month: 4, year: 2026 },
      { month: 5, year: 2026 },
      { month: 6, year: 2026 },
    ])
  })

  it('rolls the year backwards across January', () => {
    const months = lastNMonths({ month: 2, year: 2026 }, 4)
    expect(months).toEqual([
      { month: 11, year: 2025 },
      { month: 12, year: 2025 },
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
    ])
  })
})

describe('buildMonthlySeries', () => {
  const months = lastNMonths({ month: 6, year: 2026 }, 3) // Abr, Mai, Jun

  it('sums income and expense into each month and derives balance', () => {
    const txns: SeriesTransaction[] = [
      { type: 'income', amount: 10000, date: new Date(Date.UTC(2026, 3, 10)) }, // Abr
      { type: 'expense', amount: 4000, date: new Date(Date.UTC(2026, 3, 20)) }, // Abr
      { type: 'income', amount: 5000, date: new Date(Date.UTC(2026, 5, 1)) }, // Jun
    ]

    const series = buildMonthlySeries(txns, months)

    expect(series.map((p) => p.label)).toEqual(['Abr', 'Mai', 'Jun'])
    expect(series[0]).toMatchObject({ income: 10000, expense: 4000, balance: 6000 })
    // May has no transactions but still appears with zeros (no gaps in the chart).
    expect(series[1]).toMatchObject({ income: 0, expense: 0, balance: 0 })
    expect(series[2]).toMatchObject({ income: 5000, expense: 0, balance: 5000 })
  })

  it('produces a zeroed point for every requested month even with no data', () => {
    const series = buildMonthlySeries([], months)
    expect(series).toHaveLength(3)
    expect(series.every((p) => p.income === 0 && p.expense === 0 && p.balance === 0)).toBe(true)
  })

  it('ignores transactions outside the requested window', () => {
    const txns: SeriesTransaction[] = [
      { type: 'income', amount: 9999, date: new Date(Date.UTC(2026, 0, 5)) }, // Jan — out of range
    ]
    const series = buildMonthlySeries(txns, months)
    expect(series.every((p) => p.income === 0)).toBe(true)
  })
})
