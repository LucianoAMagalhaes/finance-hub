// Unit tests for the portfolio math.
//
// Pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import {
  buildPosition,
  buildPositions,
  summarizePortfolio,
  allocationByType,
  isPriceStale,
  operationUnitPriceCents,
  type AssetInfo,
  type Operation,
} from '@/lib/portfolio'

// A plain asset with a quote of R$ 40,00 per unit (4000 cents).
const petr: AssetInfo = {
  id: 'a1',
  ticker: 'PETR4',
  type: 'stock_br',
  currentPriceCents: 4000,
  priceUpdatedAt: new Date('2026-08-20T00:00:00Z'),
  treasuryKind: null,
  maturityDate: null,
}

const buy = (quantity: number, totalCents: number, day: string): Operation => ({
  type: 'buy',
  quantity,
  totalCents,
  date: new Date(`${day}T00:00:00Z`),
})

const sell = (quantity: number, totalCents: number, day: string): Operation => ({
  type: 'sell',
  quantity,
  totalCents,
  date: new Date(`${day}T00:00:00Z`),
})

describe('buildPosition', () => {
  it('computes quantity, cost and average price from a single buy', () => {
    // 10 units for R$ 300,00 -> average price R$ 30,00.
    const p = buildPosition(petr, [buy(10, 30000, '2026-01-10')])

    expect(p.quantity).toBe(10)
    expect(p.investedCents).toBe(30000)
    expect(p.avgPriceCents).toBe(3000)
    expect(p.isClosed).toBe(false)
  })

  it('averages two buys by weight, not by simple mean', () => {
    // 10 @ R$ 10 + 10 @ R$ 20 = 20 units for R$ 300,00 -> R$ 15,00 each.
    const p = buildPosition(petr, [
      buy(10, 10000, '2026-01-10'),
      buy(10, 20000, '2026-02-10'),
    ])

    expect(p.quantity).toBe(20)
    expect(p.investedCents).toBe(30000)
    expect(p.avgPriceCents).toBe(1500)
  })

  it('keeps the average price unchanged after a partial sell', () => {
    // 20 units at R$ 15,00 average; sell 5 for R$ 100,00 (R$ 20,00 each).
    // Cost taken out: 30000 * 5/20 = 7500. Realized: 10000 - 7500 = 2500.
    const p = buildPosition(petr, [
      buy(10, 10000, '2026-01-10'),
      buy(10, 20000, '2026-02-10'),
      sell(5, 10000, '2026-03-10'),
    ])

    expect(p.quantity).toBe(15)
    expect(p.investedCents).toBe(22500)
    expect(p.avgPriceCents).toBe(1500)
    expect(p.realizedProfitCents).toBe(2500)
  })

  it('closes the position when everything is sold', () => {
    const p = buildPosition(petr, [
      buy(10, 30000, '2026-01-10'),
      sell(10, 35000, '2026-03-10'),
    ])

    expect(p.quantity).toBe(0)
    expect(p.investedCents).toBe(0)
    expect(p.avgPriceCents).toBeNull()
    expect(p.realizedProfitCents).toBe(5000)
    expect(p.isClosed).toBe(true)
    expect(p.currentValueCents).toBe(0)
  })

  it('clamps a sell bigger than the position instead of going negative', () => {
    const p = buildPosition(petr, [
      buy(10, 30000, '2026-01-10'),
      sell(999, 40000, '2026-03-10'),
    ])

    expect(p.quantity).toBe(0)
    expect(p.investedCents).toBe(0)
    expect(p.realizedProfitCents).toBe(10000)
  })

  it('sorts operations internally, so array order does not matter', () => {
    const ordered = buildPosition(petr, [
      buy(10, 10000, '2026-01-10'),
      sell(5, 10000, '2026-03-10'),
    ])
    const shuffled = buildPosition(petr, [
      sell(5, 10000, '2026-03-10'),
      buy(10, 10000, '2026-01-10'),
    ])

    expect(shuffled).toEqual(ordered)
  })

  it('handles fractional crypto quantities with a single rounding', () => {
    // 0.00123456 BTC bought for R$ 500,00, now worth R$ 450.000,00 per unit.
    const btc: AssetInfo = {
      id: 'a2',
      ticker: 'BTC',
      type: 'crypto',
      currentPriceCents: 45000000,
      priceUpdatedAt: null,
      treasuryKind: null,
      maturityDate: null,
    }
    const p = buildPosition(btc, [buy(0.00123456, 50000, '2026-01-10')])

    expect(p.quantity).toBe(0.00123456)
    // 0.00123456 * 45000000 = 55555.2 cents -> rounded once, to the cent.
    expect(p.currentValueCents).toBe(55555)
    expect(p.profitCents).toBe(5555)
  })

  it('treats floating-point dust as a closed position', () => {
    // 0.1 + 0.2 - 0.3 leaves 5.5e-17 in IEEE-754, which is not a holding.
    const p = buildPosition(petr, [
      buy(0.1, 100, '2026-01-10'),
      buy(0.2, 200, '2026-01-11'),
      sell(0.3, 400, '2026-01-12'),
    ])

    expect(p.isClosed).toBe(true)
    expect(p.quantity).toBe(0)
  })

  it('returns nulls (not zeros) when the asset has no quote', () => {
    const unpriced: AssetInfo = { ...petr, currentPriceCents: null }
    const p = buildPosition(unpriced, [buy(10, 30000, '2026-01-10')])

    expect(p.currentValueCents).toBeNull()
    expect(p.profitCents).toBeNull()
    expect(p.profitPercent).toBeNull()
    expect(p.investedCents).toBe(30000)
  })

  it('computes profit and percentage against the quote', () => {
    // 10 units at R$ 30,00 cost, quoted at R$ 40,00 -> +R$ 100,00 (+33,33%).
    const p = buildPosition(petr, [buy(10, 30000, '2026-01-10')])

    expect(p.currentValueCents).toBe(40000)
    expect(p.profitCents).toBe(10000)
    expect(p.profitPercent).toBe(33.33)
  })

  it('never divides by zero when there is no cost', () => {
    const p = buildPosition(petr, [])

    expect(p.quantity).toBe(0)
    expect(p.avgPriceCents).toBeNull()
    expect(p.profitPercent).toBeNull()
    expect(p.isClosed).toBe(true)
  })
})

describe('buildPositions', () => {
  it('groups the operations by asset', () => {
    const btc: AssetInfo = { ...petr, id: 'a2', ticker: 'BTC', type: 'crypto' }
    const positions = buildPositions(
      [petr, btc],
      [
        { ...buy(10, 30000, '2026-01-10'), assetId: 'a1' },
        { ...buy(2, 20000, '2026-01-11'), assetId: 'a2' },
      ],
    )

    expect(positions.map((p) => p.quantity)).toEqual([10, 2])
    expect(positions[0].operationCount).toBe(1)
  })
})

describe('summarizePortfolio', () => {
  it('falls back to the invested amount for assets without a quote', () => {
    const priced = buildPosition(petr, [buy(10, 30000, '2026-01-10')]) // worth 40000
    const unpriced = buildPosition({ ...petr, id: 'a2', currentPriceCents: null }, [
      buy(1, 10000, '2026-01-10'),
    ])

    const summary = summarizePortfolio([priced, unpriced])

    expect(summary.investedCents).toBe(40000)
    expect(summary.currentValueCents).toBe(50000) // 40000 + 10000 (cost fallback)
    expect(summary.profitCents).toBe(10000)
    expect(summary.profitPercent).toBe(25)
    expect(summary.openCount).toBe(2)
    expect(summary.unpricedCount).toBe(1)
  })

  it('returns a null percentage for an empty portfolio', () => {
    const summary = summarizePortfolio([])

    expect(summary.investedCents).toBe(0)
    expect(summary.profitPercent).toBeNull()
    expect(summary.assetCount).toBe(0)
  })
})

describe('allocationByType', () => {
  it('groups by class, sorts by value and shares add up to 100', () => {
    const stock = buildPosition(petr, [buy(10, 30000, '2026-01-10')]) // 40000
    const fii = buildPosition(
      { ...petr, id: 'a2', ticker: 'HGLG11', type: 'fii', currentPriceCents: 1000 },
      [buy(10, 9000, '2026-01-10')], // 10000
    )

    const slices = allocationByType([stock, fii])

    expect(slices.map((s) => s.type)).toEqual(['stock_br', 'fii'])
    expect(slices.map((s) => s.percent)).toEqual([80, 20])
    expect(slices[0].label).toBe('Ação Nacional')
  })

  it('leaves closed positions out and returns [] for an empty portfolio', () => {
    const closed = buildPosition(petr, [
      buy(10, 30000, '2026-01-10'),
      sell(10, 30000, '2026-02-10'),
    ])

    expect(allocationByType([closed])).toEqual([])
    expect(allocationByType([])).toEqual([])
  })
})

describe('isPriceStale', () => {
  const now = new Date('2026-08-21T12:00:00Z')

  it('is false for a quote typed today and for no quote at all', () => {
    expect(isPriceStale(new Date('2026-08-21T09:00:00Z'), now)).toBe(false)
    expect(isPriceStale(null, now)).toBe(false)
  })

  it('is true past the staleness window', () => {
    expect(isPriceStale(new Date('2026-08-10T12:00:00Z'), now)).toBe(true)
    expect(isPriceStale(new Date('2026-08-19T12:00:00Z'), now, 1)).toBe(true)
  })
})

describe('operationUnitPriceCents', () => {
  it('derives the price paid per unit from the total and the quantity', () => {
    expect(operationUnitPriceCents(buy(10, 38500, '2026-08-01'))).toBe(3850)
  })

  it('keeps the fraction of a cent a crypto buy produces', () => {
    // 1.000.000 units for R$ 71,00 = 0,0071 cents each.
    expect(operationUnitPriceCents(buy(1_000_000, 7100, '2026-08-01'))).toBeCloseTo(
      0.0071,
      6,
    )
  })

  it('stays total when the quantity is zero', () => {
    expect(operationUnitPriceCents(buy(0, 1000, '2026-08-01'))).toBe(0)
  })
})
