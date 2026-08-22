// Unit tests for the investments schemas.
//
// Pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import {
  assetSchema,
  assetOperationInputSchema,
  purchaseSchema,
  quoteSchema,
} from '@/lib/asset-schema'

const validAsset = { ticker: 'petr4', type: 'stock_br' }
const validPurchase = {
  ticker: 'petr4',
  type: 'stock_br',
  quantity: 10,
  unitPriceCents: 3850,
  date: '2026-08-21',
}
const validOperation = {
  type: 'buy',
  quantity: 10,
  totalCents: 30000,
  date: '2026-08-21',
}

describe('assetSchema', () => {
  it('trims and uppercases the ticker', () => {
    const parsed = assetSchema.parse({ ...validAsset, ticker: '  petr4 ' })
    expect(parsed.ticker).toBe('PETR4')
  })

  it('defaults a missing price to null', () => {
    expect(assetSchema.parse(validAsset).currentPriceCents).toBeNull()
  })

  it('accepts a fractional price in cents', () => {
    // R$ 0,000071 per unit = 0.0071 cents.
    const parsed = assetSchema.parse({ ...validAsset, currentPriceCents: 0.0071 })
    expect(parsed.currentPriceCents).toBe(0.0071)
  })

  it('rejects an empty ticker, an unknown class and a non-positive price', () => {
    expect(assetSchema.safeParse({ ...validAsset, ticker: '  ' }).success).toBe(false)
    expect(assetSchema.safeParse({ ...validAsset, type: 'nft' }).success).toBe(false)
    expect(assetSchema.safeParse({ ...validAsset, currentPriceCents: 0 }).success).toBe(
      false,
    )
  })
})

describe('assetOperationInputSchema', () => {
  it('accepts a fractional quantity down to 8 decimals', () => {
    const parsed = assetOperationInputSchema.parse({
      ...validOperation,
      quantity: 0.00123456,
    })
    expect(parsed.quantity).toBe(0.00123456)
  })

  it('rejects more than 8 decimals', () => {
    const result = assetOperationInputSchema.safeParse({
      ...validOperation,
      quantity: 0.123456789,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero or negative amounts and quantities', () => {
    expect(
      assetOperationInputSchema.safeParse({ ...validOperation, quantity: 0 }).success,
    ).toBe(false)
    expect(
      assetOperationInputSchema.safeParse({ ...validOperation, totalCents: -1 }).success,
    ).toBe(false)
  })

  it('rejects a non-integer amount of cents', () => {
    expect(
      assetOperationInputSchema.safeParse({ ...validOperation, totalCents: 10.5 })
        .success,
    ).toBe(false)
  })

  it('rejects a malformed date and normalizes empty notes to null', () => {
    expect(
      assetOperationInputSchema.safeParse({ ...validOperation, date: '21/08/2026' })
        .success,
    ).toBe(false)
    expect(
      assetOperationInputSchema.parse({ ...validOperation, notes: '   ' }).notes,
    ).toBeNull()
  })
})

describe('quoteSchema', () => {
  it('accepts a price, an explicit null and a missing field', () => {
    expect(quoteSchema.parse({ currentPriceCents: 3842 }).currentPriceCents).toBe(3842)
    expect(quoteSchema.parse({ currentPriceCents: null }).currentPriceCents).toBeNull()
    expect(quoteSchema.parse({}).currentPriceCents).toBeNull()
  })

  it('rejects a non-positive price', () => {
    expect(quoteSchema.safeParse({ currentPriceCents: 0 }).success).toBe(false)
    expect(quoteSchema.safeParse({ currentPriceCents: -1 }).success).toBe(false)
  })
})

describe('purchaseSchema', () => {
  it('accepts what the purchase form sends', () => {
    const parsed = purchaseSchema.parse({ ...validPurchase, ticker: ' petr4 ' })
    expect(parsed.ticker).toBe('PETR4')
    expect(parsed.quantity).toBe(10)
    expect(parsed.unitPriceCents).toBe(3850)
  })

  it('accepts a fractional unit price (crypto trades below one cent)', () => {
    const parsed = purchaseSchema.parse({ ...validPurchase, unitPriceCents: 0.0071 })
    expect(parsed.unitPriceCents).toBe(0.0071)
  })

  it('has no totalCents — the server derives it from quantity x price', () => {
    const parsed = purchaseSchema.parse(validPurchase)
    expect('totalCents' in parsed).toBe(false)
  })

  it('rejects an empty ticker, a zero quantity and a zero price', () => {
    expect(purchaseSchema.safeParse({ ...validPurchase, ticker: ' ' }).success).toBe(
      false,
    )
    expect(purchaseSchema.safeParse({ ...validPurchase, quantity: 0 }).success).toBe(
      false,
    )
    expect(purchaseSchema.safeParse({ ...validPurchase, unitPriceCents: 0 }).success).toBe(
      false,
    )
  })

  it('rejects a malformed date', () => {
    expect(purchaseSchema.safeParse({ ...validPurchase, date: '21/08/2026' }).success).toBe(
      false,
    )
  })
})
