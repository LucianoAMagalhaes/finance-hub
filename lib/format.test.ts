// Unit tests for the money helpers.
//
// These are pure-function tests: no DOM, no database — just input/output.

import { describe, it, expect } from 'vitest'
import { formatBRL, parseBRLToCents } from '@/lib/format'

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
