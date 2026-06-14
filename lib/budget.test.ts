// Unit tests for the budget helpers.
//
// Pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import {
  budgetStatus,
  derivedLimit,
  monthRange,
  parseBudgetPeriod,
  shiftPeriod,
} from '@/lib/budget'

describe('derivedLimit', () => {
  it('takes the target share of the income', () => {
    // 20% of R$ 5.000,00 (500000 cents) = R$ 1.000,00.
    expect(derivedLimit(500000, 20)).toBe(100000)
  })

  it('returns 0 when the target is 0% (no goal set)', () => {
    expect(derivedLimit(500000, 0)).toBe(0)
  })

  it('returns 0 when there is no income', () => {
    expect(derivedLimit(0, 20)).toBe(0)
  })

  it('rounds to the nearest cent', () => {
    // 33% of 10001 = 3300.33 → 3300.
    expect(derivedLimit(10001, 33)).toBe(3300)
    // 33% of 10002 = 3300.66 → 3301.
    expect(derivedLimit(10002, 33)).toBe(3301)
  })
})

describe('budgetStatus', () => {
  it('reports "ok" below 80% of the limit', () => {
    const s = budgetStatus(5000, 10000) // 50%
    expect(s.level).toBe('ok')
    expect(s.percent).toBe(50)
    expect(s.remaining).toBe(5000)
  })

  it('reports "warning" exactly at 80%', () => {
    const s = budgetStatus(8000, 10000)
    expect(s.level).toBe('warning')
    expect(s.percent).toBe(80)
  })

  it('still "warning" between 80% and 100%', () => {
    expect(budgetStatus(9500, 10000).level).toBe('warning')
  })

  it('reports "over" exactly at 100%', () => {
    const s = budgetStatus(10000, 10000)
    expect(s.level).toBe('over')
    expect(s.percent).toBe(100)
    expect(s.remaining).toBe(0)
  })

  it('reports "over" past the limit with a negative remaining', () => {
    const s = budgetStatus(12000, 10000)
    expect(s.level).toBe('over')
    expect(s.percent).toBe(120)
    expect(s.remaining).toBe(-2000)
  })

  it('rounds the percentage to an integer', () => {
    expect(budgetStatus(3333, 10000).percent).toBe(33)
  })

  it('handles a zero limit without dividing by zero', () => {
    expect(budgetStatus(0, 0).level).toBe('ok')
    expect(budgetStatus(500, 0).level).toBe('over')
  })

  it('treats no spending as ok', () => {
    const s = budgetStatus(0, 10000)
    expect(s.level).toBe('ok')
    expect(s.percent).toBe(0)
    expect(s.remaining).toBe(10000)
  })
})

describe('monthRange', () => {
  it('returns a half-open UTC range for a normal month', () => {
    const { gte, lt } = monthRange(2026, 6) // June 2026
    expect(gte.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    expect(lt.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('rolls over December into the next January', () => {
    const { gte, lt } = monthRange(2026, 12)
    expect(gte.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(lt.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('parseBudgetPeriod', () => {
  const now = new Date('2026-06-13T00:00:00.000Z')

  it('reads a valid month/year from the params', () => {
    expect(parseBudgetPeriod({ month: '3', year: '2025' }, now)).toEqual({
      month: 3,
      year: 2025,
    })
  })

  it('falls back to the current month when params are missing', () => {
    expect(parseBudgetPeriod({}, now)).toEqual({ month: 6, year: 2026 })
  })

  it('falls back when the month is out of range', () => {
    expect(parseBudgetPeriod({ month: '13', year: '2026' }, now)).toEqual({
      month: 6,
      year: 2026,
    })
  })

  it('falls back when values are not numbers', () => {
    expect(parseBudgetPeriod({ month: 'abc', year: '2026' }, now)).toEqual({
      month: 6,
      year: 2026,
    })
  })

  it('takes the first value when a param repeats', () => {
    expect(parseBudgetPeriod({ month: ['4'], year: ['2024'] }, now)).toEqual({
      month: 4,
      year: 2024,
    })
  })
})

describe('shiftPeriod', () => {
  it('moves to the next month within the same year', () => {
    expect(shiftPeriod({ month: 6, year: 2026 }, 1)).toEqual({ month: 7, year: 2026 })
  })

  it('moves to the previous month within the same year', () => {
    expect(shiftPeriod({ month: 6, year: 2026 }, -1)).toEqual({ month: 5, year: 2026 })
  })

  it('rolls forward from December to January of the next year', () => {
    expect(shiftPeriod({ month: 12, year: 2026 }, 1)).toEqual({ month: 1, year: 2027 })
  })

  it('rolls back from January to December of the previous year', () => {
    expect(shiftPeriod({ month: 1, year: 2026 }, -1)).toEqual({ month: 12, year: 2025 })
  })
})
