import { describe, it, expect } from 'vitest'
import { allocationTargetsSchema, toTargetMap } from '@/lib/allocation'
import { sumPercents } from '@/lib/category-percent'
import { ASSET_TYPES } from '@/lib/constants'

describe('allocationTargetsSchema', () => {
  it('accepts a plan that covers every type', () => {
    const plan = [
      { type: 'stock_br', percent: 40 },
      { type: 'stock_intl', percent: 10 },
      { type: 'fii', percent: 30 },
      { type: 'crypto', percent: 5 },
      { type: 'fixed_income', percent: 15 },
    ]

    const parsed = allocationTargetsSchema.safeParse(plan)
    expect(parsed.success).toBe(true)
    // Nothing here forces the sum to 100 — the UI warns, the calculation
    // normalizes, and a half-finished plan is still savable.
    expect(sumPercents(plan)).toBe(100)
  })

  it('accepts a plan that does not add up to 100', () => {
    expect(allocationTargetsSchema.safeParse([{ type: 'fii', percent: 90 }]).success).toBe(true)
  })

  it('rejects an unknown type', () => {
    const parsed = allocationTargetsSchema.safeParse([{ type: 'nft', percent: 10 }])
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Tipo de ativo inválido')
  })

  it('rejects a percentage out of range or fractional', () => {
    expect(allocationTargetsSchema.safeParse([{ type: 'fii', percent: -1 }]).success).toBe(false)
    expect(allocationTargetsSchema.safeParse([{ type: 'fii', percent: 101 }]).success).toBe(false)
    expect(allocationTargetsSchema.safeParse([{ type: 'fii', percent: 12.5 }]).success).toBe(false)
  })

  it('rejects an empty submission', () => {
    expect(allocationTargetsSchema.safeParse([]).success).toBe(false)
  })
})

describe('toTargetMap', () => {
  it('fills every type, defaulting the missing ones to 0', () => {
    const map = toTargetMap([
      { type: 'fii', targetPercent: 30 },
      { type: 'stock_br', targetPercent: 40 },
    ])

    expect(map.fii).toBe(30)
    expect(map.stock_br).toBe(40)
    expect(map.crypto).toBe(0)
    expect(Object.keys(map).sort()).toEqual([...ASSET_TYPES].sort())
  })

  it('returns all zeros for a user with no plan yet', () => {
    const map = toTargetMap([])
    expect(ASSET_TYPES.every((type) => map[type] === 0)).toBe(true)
  })
})
