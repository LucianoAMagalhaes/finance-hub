// Unit tests for the budget helpers.
//
// Pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import { budgetStatus, monthRange } from '@/lib/budget'

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
