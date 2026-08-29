// Unit tests for the pure half of the Yahoo client.
//
// Only pickCloseOnOrBefore is tested here: everything else in lib/yahoo.ts is
// the fetch itself, which needs a network and therefore belongs in a manual
// check, not in the suite. The rule this file protects is the one that decides
// which exchange rate a purchase gets — see ADR-013.

import { describe, it, expect } from 'vitest'
import { pickCloseOnOrBefore } from '@/lib/yahoo'

// Yahoo timestamps are UTC seconds; these are the midnights of each day.
const day = (iso: string) => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / 1000)

function history(rows: [string, number | null][]) {
  return {
    chart: {
      result: [
        {
          timestamp: rows.map(([iso]) => day(iso)),
          indicators: { quote: [{ close: rows.map(([, close]) => close) }] },
        },
      ],
    },
  }
}

// A real week: Friday 2025-01-17 through Wednesday 2025-01-22, with the
// weekend missing the way an FX series actually reports it.
const WEEK = history([
  ['2025-01-16', 6.0512],
  ['2025-01-17', 6.0324],
  ['2025-01-20', 6.0101],
  ['2025-01-21', 6.0188],
  ['2025-01-22', 6.0205],
])

describe('pickCloseOnOrBefore', () => {
  it('takes the close of the day asked for, when there is one', () => {
    expect(pickCloseOnOrBefore(WEEK, new Date('2025-01-22T00:00:00Z'))).toBe(6.0205)
    expect(pickCloseOnOrBefore(WEEK, new Date('2025-01-17T00:00:00Z'))).toBe(6.0324)
  })

  it('falls back to Friday for a purchase made on the weekend', () => {
    // The whole reason the fallback exists: a Saturday has no rate of its own,
    // and refusing to record the purchase would be absurd.
    expect(pickCloseOnOrBefore(WEEK, new Date('2025-01-18T00:00:00Z'))).toBe(6.0324)
    expect(pickCloseOnOrBefore(WEEK, new Date('2025-01-19T00:00:00Z'))).toBe(6.0324)
  })

  it('never reaches FORWARD for a rate that did not exist yet', () => {
    // Picking Monday's rate for a Friday purchase would be using information
    // from the future — a different number, and the wrong one.
    expect(pickCloseOnOrBefore(WEEK, new Date('2025-01-15T00:00:00Z'))).toBeNull()
  })

  it('skips a day the series reports as null', () => {
    // A holiday inside the window shows up as a null close, not as a gap.
    const withHoliday = history([
      ['2025-01-16', 6.0512],
      ['2025-01-17', null],
    ])
    expect(pickCloseOnOrBefore(withHoliday, new Date('2025-01-17T00:00:00Z'))).toBe(6.0512)
  })

  it('refuses a close that is not a usable rate', () => {
    expect(
      pickCloseOnOrBefore(history([['2025-01-16', 0]]), new Date('2025-01-16T00:00:00Z')),
    ).toBeNull()
  })

  it('returns null for an empty or malformed payload instead of throwing', () => {
    const when = new Date('2025-01-22T00:00:00Z')
    expect(pickCloseOnOrBefore({}, when)).toBeNull()
    expect(pickCloseOnOrBefore({ chart: { result: [] } }, when)).toBeNull()
    expect(pickCloseOnOrBefore(history([]), when)).toBeNull()
  })
})
