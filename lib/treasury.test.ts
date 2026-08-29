// Unit tests for the Tesouro Direto helpers.
//
// Pure-function tests: no DOM, no network, no database.

import { describe, it, expect } from 'vitest'
import { TREASURY_KINDS, TREASURY_KIND_NAMES } from '@/lib/constants'
import {
  treasuryTicker,
  treasuryKindFromName,
  paysCoupons,
  treasuryNetValue,
  irRateForDays,
  iofRateForDays,
  SELIC_CUSTODY_EXEMPTION_CENTS,
} from '@/lib/treasury'

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

// --- Valor líquido -----------------------------------------------------------

const lot = (day: string, quantity: number, totalCents: number) => ({
  quantity,
  totalCents,
  date: new Date(`${day}T00:00:00.000Z`),
})

describe('irRateForDays', () => {
  it('follows the regressive table at its boundaries', () => {
    expect(irRateForDays(1)).toBe(0.225)
    expect(irRateForDays(180)).toBe(0.225)
    expect(irRateForDays(181)).toBe(0.2)
    expect(irRateForDays(360)).toBe(0.2)
    expect(irRateForDays(361)).toBe(0.175)
    expect(irRateForDays(720)).toBe(0.175)
    expect(irRateForDays(721)).toBe(0.15)
    expect(irRateForDays(5000)).toBe(0.15)
  })
})

describe('iofRateForDays', () => {
  it('is gone from day 30 on', () => {
    expect(iofRateForDays(30)).toBe(0)
    expect(iofRateForDays(674)).toBe(0)
  })

  it('bites hardest on the first days', () => {
    expect(iofRateForDays(1)).toBe(0.96)
    expect(iofRateForDays(10)).toBe(0.66)
    expect(iofRateForDays(29)).toBe(0.03)
  })
})

describe('treasuryNetValue — against a real Tesouro statement', () => {
  // The statement, verbatim: applied 23/10/2024, 0,50 títulos at R$ 2.203,82
  // (R$ 1.101,91 invested), 674 calendar days, gross R$ 1.223,43, IR 17,50%
  // = R$ 21,26, IOF R$ 0,00, B3 R$ 4,18, net R$ 1.197,99.
  const asOf = new Date('2026-08-28T00:00:00.000Z')
  const puCents = 244686 // gross 1223,43 / 0,50

  const result = treasuryNetValue('ipca', [lot('2024-10-23', 0.5, 110191)], puCents, asOf)!

  it('reproduces the invested amount and the gross value', () => {
    expect(result.investedCents).toBe(110191)
    expect(result.grossCents).toBe(122343)
  })

  it('counts the same 674 calendar days and picks the same 17,5%', () => {
    expect(result.lots[0].days).toBe(674)
    expect(result.lots[0].irRate).toBe(0.175)
  })

  it('withholds the same income tax, to the cent', () => {
    // Statement: R$ 21,26. One cent apart is their rounding, not a different rule.
    expect(Math.abs(result.irCents - 2126)).toBeLessThanOrEqual(1)
  })

  it('charges no IOF after two years', () => {
    expect(result.iofCents).toBe(0)
  })

  it('estimates the custody fee close to what was actually charged', () => {
    // Statement: R$ 4,18. The estimate cannot be exact — the real fee accrues
    // daily on a price that moved — so this asserts the ORDER, not equality.
    expect(result.custodyCents).toBeGreaterThan(390)
    expect(result.custodyCents).toBeLessThan(450)
  })

  it('lands within pennies of the statement net value', () => {
    // Statement: R$ 1.197,99. The gap is the custody estimate alone.
    expect(Math.abs(result.netCents - 119799)).toBeLessThan(30)
  })
})

describe('treasuryNetValue — edge cases', () => {
  const asOf = new Date('2026-08-28T00:00:00.000Z')

  it('taxes nothing on a lot that is under water, but still charges custody', () => {
    // Bought at R$ 100, now worth R$ 80.
    const result = treasuryNetValue('ipca', [lot('2025-08-28', 1, 10000)], 8000, asOf)!
    expect(result.gainCents).toBe(-2000)
    expect(result.irCents).toBe(0)
    expect(result.iofCents).toBe(0)
    // The fee is on the value held, not on the gain — it is owed either way.
    expect(result.custodyCents).toBeGreaterThan(0)
    expect(result.netCents).toBeLessThan(result.grossCents)
  })

  it('applies IOF before income tax on a fresh purchase', () => {
    // 10 days: IOF takes 66% of the gain, IR 22,5% of what survives.
    const result = treasuryNetValue('ipca', [lot('2026-08-18', 1, 10000)], 11000, asOf)!
    expect(result.lots[0].days).toBe(10)
    expect(result.iofCents).toBe(660) // 66% of the R$ 10,00 gain
    // 22,5% of (1000 - 660), NOT of the full gain.
    expect(result.irCents).toBe(77)
  })

  it('exempts a small Tesouro Selic position from the custody fee', () => {
    const result = treasuryNetValue('selic', [lot('2024-08-28', 1, 500000)], 600000, asOf)!
    expect(result.grossCents).toBeLessThan(SELIC_CUSTODY_EXEMPTION_CENTS)
    expect(result.custodyCents).toBe(0)
  })

  it('charges a big Selic position only on what exceeds the exemption', () => {
    // R$ 20.000 held: half of it is exempt, so the fee is half of the full one.
    const selic = treasuryNetValue('selic', [lot('2024-08-28', 1, 1800000)], 2000000, asOf)!
    const other = treasuryNetValue('ipca', [lot('2024-08-28', 1, 1800000)], 2000000, asOf)!
    expect(selic.custodyCents).toBeGreaterThan(0)
    expect(Math.abs(selic.custodyCents - other.custodyCents / 2)).toBeLessThanOrEqual(1)
  })

  it('ages each purchase on its own, so one position can span two IR brackets', () => {
    const result = treasuryNetValue(
      'ipca',
      [lot('2020-01-10', 1, 10000), lot('2026-08-01', 1, 10000)],
      12000,
      asOf,
    )!
    expect(result.lots.map((l) => l.irRate).sort()).toEqual([0.15, 0.225])
    // The totals are the sum of the lots, not one rate applied to the average.
    expect(result.irCents).toBe(result.lots[0].irCents + result.lots[1].irCents)
  })

  it('has nothing to say without a price', () => {
    expect(treasuryNetValue('ipca', [lot('2024-10-23', 0.5, 110191)], null, asOf)).toBeNull()
    expect(treasuryNetValue('ipca', [], 100, asOf)).toBeNull()
  })
})
