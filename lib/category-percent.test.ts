// Unit tests for the category target-percent helpers.

import { describe, it, expect } from 'vitest'
import { categoryPercentsSchema, sumPercents } from '@/lib/category-percent'

describe('categoryPercentsSchema', () => {
  it('accepts a valid list', () => {
    const r = categoryPercentsSchema.safeParse([
      { id: 'a', percent: 55 },
      { id: 'b', percent: 45 },
    ])
    expect(r.success).toBe(true)
  })

  it('rejects a percent outside 0-100', () => {
    expect(categoryPercentsSchema.safeParse([{ id: 'a', percent: 120 }]).success).toBe(false)
    expect(categoryPercentsSchema.safeParse([{ id: 'a', percent: -5 }]).success).toBe(false)
  })

  it('rejects a non-integer percent', () => {
    expect(categoryPercentsSchema.safeParse([{ id: 'a', percent: 12.5 }]).success).toBe(false)
  })

  it('rejects an empty submission', () => {
    expect(categoryPercentsSchema.safeParse([]).success).toBe(false)
  })
})

describe('sumPercents', () => {
  it('adds the percentages', () => {
    expect(sumPercents([{ percent: 55 }, { percent: 10 }, { percent: 35 }])).toBe(100)
  })

  it('is zero for an empty list', () => {
    expect(sumPercents([])).toBe(0)
  })
})
