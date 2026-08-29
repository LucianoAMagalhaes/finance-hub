// Unit tests for the Tesouro Direto helpers.
//
// Pure-function tests: no DOM, no network, no database.

import { describe, it, expect } from 'vitest'
import { TREASURY_KINDS, TREASURY_KIND_NAMES } from '@/lib/constants'
import { treasuryTicker, treasuryKindFromName, paysCoupons } from '@/lib/treasury'

// Maturities are stored at UTC midnight, the way the actions write them.
function maturity(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

describe('treasuryTicker', () => {
  it('names a bond the way the statement does', () => {
    expect(treasuryTicker('ipca', maturity('2035-05-15'))).toBe('Tesouro IPCA+ 2035')
    expect(treasuryTicker('selic', maturity('2029-03-01'))).toBe('Tesouro Selic 2029')
  })

  it('keeps the coupon suffix — it is a DIFFERENT bond, not a footnote', () => {
    // These two mature in the same year and trade at different prices
    // (R$ 2.458,57 vs R$ 4.286,98 on 28/08/2026). Collapsing them would price
    // one with the other's quote.
    const principal = treasuryTicker('ipca', maturity('2035-05-15'))
    const coupon = treasuryTicker('ipca_semiannual', maturity('2035-05-15'))

    expect(principal).toBe('Tesouro IPCA+ 2035')
    expect(coupon).toBe('Tesouro IPCA+ com Juros Semestrais 2035')
    expect(principal).not.toBe(coupon)
  })

  it('reads the year in UTC, so a 01/01 maturity keeps its year', () => {
    // Read in local time west of Greenwich, this would render as 2027.
    expect(treasuryTicker('prefixado', maturity('2028-01-01'))).toBe(
      'Tesouro Prefixado 2028',
    )
  })

  it('produces a distinct name for every kind in the same year', () => {
    const names = TREASURY_KINDS.map((kind) => treasuryTicker(kind, maturity('2035-05-15')))
    expect(new Set(names).size).toBe(TREASURY_KINDS.length)
  })
})

describe('treasuryKindFromName', () => {
  it('round-trips every official name', () => {
    for (const kind of TREASURY_KINDS) {
      expect(treasuryKindFromName(TREASURY_KIND_NAMES[kind])).toBe(kind)
    }
  })

  it('tolerates the surrounding whitespace a CSV column can carry', () => {
    expect(treasuryKindFromName('  Tesouro Selic ')).toBe('selic')
  })

  it('returns null for a bond it has never heard of, instead of throwing', () => {
    // One unknown row in the price file must not sink a whole quote refresh.
    expect(treasuryKindFromName('Tesouro Ouro 2040')).toBeNull()
    expect(treasuryKindFromName('')).toBeNull()
  })

  it('does not match on a prefix — the suffix distinguishes two real bonds', () => {
    expect(treasuryKindFromName('Tesouro IPCA')).toBeNull()
  })
})

describe('paysCoupons', () => {
  it('flags the bonds whose coupons this app does not track', () => {
    expect(paysCoupons('ipca_semiannual')).toBe(true)
    expect(paysCoupons('renda_mais')).toBe(true)
    expect(paysCoupons('ipca')).toBe(false)
    expect(paysCoupons('selic')).toBe(false)
  })
})
