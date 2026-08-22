// Unit tests for the money helpers.
//
// These are pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import {
  formatBRL,
  parseBRLToCents,
  parseQuantity,
  formatQuantity,
  parsePriceToCents,
  formatPriceBRL,
  formatRelativeDay,
} from '@/lib/format'

// Intl puts a non-breaking space (U+00A0) between "R$" and the number. Tests
// shouldn't care about which kind of space it is, so we normalize it first.
const normalize = (s: string) => s.replace(/ /g, ' ')

describe('formatBRL', () => {
  it('formats whole values in cents as BRL', () => {
    expect(normalize(formatBRL(150000))).toBe('R$ 1.500,00')
  })

  it('formats values with cents', () => {
    expect(normalize(formatBRL(1999))).toBe('R$ 19,99')
  })

  it('formats zero', () => {
    expect(normalize(formatBRL(0))).toBe('R$ 0,00')
  })

  it('formats negative values', () => {
    expect(normalize(formatBRL(-2550))).toBe('-R$ 25,50')
  })
})

describe('parseBRLToCents', () => {
  it('parses a full BRL string with prefix and thousands separator', () => {
    expect(parseBRLToCents('R$ 1.500,00')).toBe(150000)
  })

  it('parses a plain decimal with comma', () => {
    expect(parseBRLToCents('19,99')).toBe(1999)
  })

  it('parses a value without decimals', () => {
    expect(parseBRLToCents('1500')).toBe(150000)
  })

  it('avoids floating-point drift', () => {
    // 19.99 * 100 is 1998.9999... in IEEE-754; we must round to 1999.
    expect(parseBRLToCents('19,99')).toBe(1999)
  })

  it('returns null for non-numeric input', () => {
    expect(parseBRLToCents('abc')).toBeNull()
    expect(parseBRLToCents('')).toBeNull()
    expect(parseBRLToCents('R$')).toBeNull()
  })
})

describe('parseQuantity', () => {
  it('parses Brazilian and plain notation the same way', () => {
    expect(parseQuantity('0,00123456')).toBe(0.00123456)
    expect(parseQuantity('0.00123456')).toBe(0.00123456)
  })

  it('treats dots as thousands separators when a comma is present', () => {
    expect(parseQuantity('1.000,5')).toBe(1000.5)
  })

  it('keeps a bare dot as the decimal separator', () => {
    expect(parseQuantity('1.5')).toBe(1.5)
  })

  it('rounds to the 8 decimals the column stores', () => {
    expect(parseQuantity('0,123456789')).toBe(0.12345679)
  })

  it('returns null for empty or non-numeric input', () => {
    expect(parseQuantity('')).toBeNull()
    expect(parseQuantity('   ')).toBeNull()
    expect(parseQuantity('abc')).toBeNull()
  })
})

describe('formatQuantity', () => {
  it('drops trailing zeros', () => {
    expect(formatQuantity(10)).toBe('10')
  })

  it('shows up to 8 decimals', () => {
    expect(formatQuantity(0.00123456)).toBe('0,00123456')
  })
})

describe('parsePriceToCents', () => {
  it('parses a normal price into whole cents', () => {
    expect(parsePriceToCents('R$ 38,50')).toBe(3850)
  })

  it('keeps fractions of a cent (unlike parseBRLToCents)', () => {
    // R$ 0,000071 is 0.0071 cents — parseBRLToCents would round it to 0.
    expect(parsePriceToCents('0,000071')).toBeCloseTo(0.0071, 6)
    expect(parseBRLToCents('0,000071')).toBe(0)
  })

  it('returns null for non-numeric input', () => {
    expect(parsePriceToCents('R$')).toBeNull()
    expect(parsePriceToCents('')).toBeNull()
  })
})

describe('formatPriceBRL', () => {
  it('uses two decimals for ordinary prices', () => {
    expect(normalize(formatPriceBRL(3850))).toBe('R$ 38,50')
  })

  it('falls back to six decimals below one cent', () => {
    expect(normalize(formatPriceBRL(0.0071))).toBe('R$ 0,000071')
  })

  it('keeps two decimals for zero', () => {
    expect(normalize(formatPriceBRL(0))).toBe('R$ 0,00')
  })
})

describe('formatRelativeDay', () => {
  const now = new Date(2026, 7, 22, 12, 0, 0) // 22/08/2026, local time

  it('reads today and yesterday by calendar day, not by elapsed hours', () => {
    expect(formatRelativeDay(new Date(2026, 7, 22, 1, 0, 0), now)).toBe('hoje')
    expect(formatRelativeDay(new Date(2026, 7, 21, 23, 0, 0), now)).toBe('ontem')
  })

  it('counts days inside the first month', () => {
    expect(formatRelativeDay(new Date(2026, 7, 19), now)).toBe('há 3 dias')
  })

  it('falls back to the plain date after a month', () => {
    expect(formatRelativeDay(new Date(2026, 5, 10), now)).toBe('10/06/2026')
  })
})
