// Unit tests for the goal helpers.
//
// Pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import { goalProgress, monthsUntil, suggestedMonthlyContribution } from '@/lib/goal'

describe('goalProgress', () => {
  it('reports partial progress', () => {
    const p = goalProgress(2500, 10000) // 25%
    expect(p.percent).toBe(25)
    expect(p.remaining).toBe(7500)
    expect(p.complete).toBe(false)
  })

  it('rounds the percentage to an integer', () => {
    expect(goalProgress(3333, 10000).percent).toBe(33)
  })

  it('marks a fully funded goal as complete', () => {
    const p = goalProgress(10000, 10000)
    expect(p.percent).toBe(100)
    expect(p.remaining).toBe(0)
    expect(p.complete).toBe(true)
  })

  it('caps percent at 100 and remaining at 0 when over-funded', () => {
    const p = goalProgress(12000, 10000)
    expect(p.percent).toBe(100)
    expect(p.remaining).toBe(0)
    expect(p.complete).toBe(true)
  })

  it('handles a zero target without dividing by zero', () => {
    expect(goalProgress(0, 0)).toEqual({ percent: 100, remaining: 0, complete: true })
  })
})

describe('monthsUntil', () => {
  const now = new Date('2026-06-13T00:00:00.000Z')

  it('counts whole calendar months ahead', () => {
    expect(monthsUntil(new Date('2026-12-01T00:00:00.000Z'), now)).toBe(6)
  })

  it('rolls across a year boundary', () => {
    expect(monthsUntil(new Date('2027-06-01T00:00:00.000Z'), now)).toBe(12)
  })

  it('floors at 1 for the current month', () => {
    expect(monthsUntil(new Date('2026-06-30T00:00:00.000Z'), now)).toBe(1)
  })

  it('floors at 1 for a past deadline', () => {
    expect(monthsUntil(new Date('2026-01-01T00:00:00.000Z'), now)).toBe(1)
  })
})

describe('suggestedMonthlyContribution', () => {
  const now = new Date('2026-06-13T00:00:00.000Z')

  it('spreads the remaining amount over the months left', () => {
    // remaining 60000 over 6 months = 10000/month
    const s = suggestedMonthlyContribution(60000, 0, new Date('2026-12-01T00:00:00.000Z'), now)
    expect(s).toBe(10000)
  })

  it('only spreads what is still missing', () => {
    // remaining 30000 over 6 months = 5000/month
    const s = suggestedMonthlyContribution(60000, 30000, new Date('2026-12-01T00:00:00.000Z'), now)
    expect(s).toBe(5000)
  })

  it('rounds up so the goal is funded by the deadline', () => {
    // remaining 10000 over 3 months = 3333.33 -> 3334
    const s = suggestedMonthlyContribution(10000, 0, new Date('2026-09-01T00:00:00.000Z'), now)
    expect(s).toBe(3334)
  })

  it('returns 0 once the goal is reached', () => {
    expect(suggestedMonthlyContribution(10000, 10000, new Date('2026-12-01T00:00:00.000Z'), now)).toBe(0)
  })

  it('suggests the whole remainder when the deadline is now or past', () => {
    expect(suggestedMonthlyContribution(10000, 0, new Date('2026-06-20T00:00:00.000Z'), now)).toBe(10000)
  })
})
