// Unit tests for the transaction validation schema.

import { describe, it, expect } from 'vitest'
import { transactionInputSchema } from '@/lib/transaction-schema'

// A minimal valid input we can tweak per test.
const valid = {
  description: 'Mercado',
  amount: 15000,
  date: '2026-06-07',
  type: 'expense' as const,
  paymentMethod: 'pix' as const,
  categoryId: 'cat_1',
}

describe('transactionInputSchema', () => {
  it('accepts a valid minimal input', () => {
    const result = transactionInputSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('normalizes empty optional relations to null', () => {
    const result = transactionInputSchema.parse({
      ...valid,
      tagId: '',
      notes: '',
    })
    expect(result.tagId).toBeNull()
    expect(result.notes).toBeNull()
  })

  it('keeps provided optional relations', () => {
    const result = transactionInputSchema.parse({
      ...valid,
      tagId: 'tag_1',
    })
    expect(result.tagId).toBe('tag_1')
  })

  it('rejects an empty description', () => {
    const result = transactionInputSchema.safeParse({ ...valid, description: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive amount', () => {
    expect(transactionInputSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false)
    expect(transactionInputSchema.safeParse({ ...valid, amount: -100 }).success).toBe(false)
  })

  it('rejects a non-integer amount (must be cents)', () => {
    expect(transactionInputSchema.safeParse({ ...valid, amount: 10.5 }).success).toBe(false)
  })

  it('rejects an invalid date format', () => {
    expect(transactionInputSchema.safeParse({ ...valid, date: '07/06/2026' }).success).toBe(false)
  })

  it('rejects an unknown payment method', () => {
    expect(transactionInputSchema.safeParse({ ...valid, paymentMethod: 'crypto' }).success).toBe(false)
  })

  it('rejects a missing category', () => {
    expect(transactionInputSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false)
  })
})
