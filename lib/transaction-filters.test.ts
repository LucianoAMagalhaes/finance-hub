// Unit tests for the transaction filtering logic.

import { describe, it, expect } from 'vitest'
import {
  parseTransactionFilters,
  buildTransactionWhere,
  hasActiveFilters,
} from '@/lib/transaction-filters'

describe('parseTransactionFilters', () => {
  it('returns empty filters for empty params', () => {
    expect(parseTransactionFilters({})).toEqual({})
  })

  it('keeps valid values', () => {
    const f = parseTransactionFilters({
      type: 'expense',
      paymentMethod: 'pix',
      categoryId: 'cat_1',
      from: '2026-06-01',
      to: '2026-06-30',
      q: 'mercado',
    })
    expect(f).toEqual({
      type: 'expense',
      paymentMethod: 'pix',
      categoryId: 'cat_1',
      from: '2026-06-01',
      to: '2026-06-30',
      q: 'mercado',
    })
  })

  it('drops invalid type and payment method', () => {
    const f = parseTransactionFilters({ type: 'bogus', paymentMethod: 'crypto' })
    expect(f.type).toBeUndefined()
    expect(f.paymentMethod).toBeUndefined()
  })

  it('drops malformed dates', () => {
    const f = parseTransactionFilters({ from: '01/06/2026', to: '2026-6-1' })
    expect(f.from).toBeUndefined()
    expect(f.to).toBeUndefined()
  })

  it('ignores empty strings', () => {
    expect(parseTransactionFilters({ q: '   ', categoryId: '' })).toEqual({})
  })

  it('takes the first value when an array is given', () => {
    expect(parseTransactionFilters({ type: ['expense', 'income'] }).type).toBe('expense')
  })
})

describe('buildTransactionWhere', () => {
  it('always scopes to the user', () => {
    expect(buildTransactionWhere('u1', {})).toEqual({ userId: 'u1' })
  })

  it('maps simple equality filters', () => {
    const where = buildTransactionWhere('u1', {
      type: 'income',
      paymentMethod: 'debit',
      categoryId: 'c1',
    })
    expect(where).toMatchObject({
      userId: 'u1',
      type: 'income',
      paymentMethod: 'debit',
      categoryId: 'c1',
    })
  })

  it('builds an inclusive UTC date range', () => {
    const where = buildTransactionWhere('u1', { from: '2026-06-01', to: '2026-06-30' })
    expect(where.date).toEqual({
      gte: new Date('2026-06-01T00:00:00.000Z'),
      lte: new Date('2026-06-30T23:59:59.999Z'),
    })
  })

  it('supports an open-ended range (only from)', () => {
    const where = buildTransactionWhere('u1', { from: '2026-06-01' })
    expect(where.date).toEqual({ gte: new Date('2026-06-01T00:00:00.000Z') })
  })

  it('does case-insensitive description search', () => {
    const where = buildTransactionWhere('u1', { q: 'Mercado' })
    expect(where.description).toEqual({ contains: 'Mercado', mode: 'insensitive' })
  })
})

describe('hasActiveFilters', () => {
  it('is false when empty, true otherwise', () => {
    expect(hasActiveFilters({})).toBe(false)
    expect(hasActiveFilters({ q: 'x' })).toBe(true)
  })
})
