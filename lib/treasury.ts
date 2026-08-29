// Tesouro Direto — pure helpers, no I/O.
//
// Role in the architecture: this is the only file in the app that speaks the
// Tesouro's vocabulary. It turns the pair (kind, maturity) — which is what a
// bond actually IS — into the readable name shown in the portfolio, and back
// again from the name the Tesouro publishes in its daily price file.
//
// Why a bond needs this at all, when a stock does not: a stock has a ticker the
// user types ("PETR4"). A Tesouro bond has no such thing. Its identity is the
// pair, and every name you see ("Tesouro IPCA+ 2035") is DERIVED from it — the
// same reasoning as the portfolio positions in lib/portfolio.ts and the budget
// limits in lib/budget.ts: derive, never store a second copy that can drift.
//
// This file must NOT import Prisma: it runs in Vitest and in the browser (the
// purchase form previews the generated name as the user picks the fields).
// Tests live in lib/treasury.test.ts.

import {
  TREASURY_KINDS,
  TREASURY_KIND_NAMES,
  TREASURY_KINDS_WITH_COUPONS,
  type TreasuryKind,
} from '@/lib/constants'

/**
 * The name of one bond: its official name plus the maturity year.
 *
 * "Tesouro IPCA+" + 15/05/2035 becomes "Tesouro IPCA+ 2035" — which is how the
 * Tesouro's own statement, the broker and the user all refer to it.
 *
 * The YEAR alone is enough to tell two bonds of the same kind apart: no kind
 * offers two maturities in the same year (verified against the 58 bonds on
 * offer). The full date is still what gets stored, because it is what the price
 * file is matched on and what a maturity countdown would need.
 *
 * Reads the date in UTC because that is how dates are stored throughout the app
 * (see toUtcMidnight in the portfolio actions): reading it in local time would
 * shift a 01/01 maturity back into the previous year west of Greenwich.
 *
 * @param kind - Which Tesouro bond it is.
 * @param maturityDate - Its maturity, stored at UTC midnight.
 */
export function treasuryTicker(kind: TreasuryKind, maturityDate: Date): string {
  return `${TREASURY_KIND_NAMES[kind]} ${maturityDate.getUTCFullYear()}`
}

/**
 * The reverse: the kind behind an official name, or null when the name is not
 * one the app knows.
 *
 * Used to read the Tesouro's daily price file, whose first column carries these
 * exact strings. Returning null instead of throwing is deliberate — the file is
 * an outside input, and one unrecognized row (a new bond the app has never
 * heard of) must not sink a whole quote refresh.
 *
 * @param name - A bond name as the Tesouro spells it.
 */
export function treasuryKindFromName(name: string): TreasuryKind | null {
  const wanted = name.trim()
  return TREASURY_KINDS.find((kind) => TREASURY_KIND_NAMES[kind] === wanted) ?? null
}

/**
 * True when this bond pays coupons (juros semestrais) before maturity.
 *
 * Worth surfacing in the UI: coupons already received are NOT tracked by this
 * app, so the result shown for one of these bonds is missing the cash that
 * already left it — it reads lower than the truth. Same known gap as dividends
 * on stocks.
 *
 * @param kind - Which Tesouro bond it is.
 */
export function paysCoupons(kind: TreasuryKind): boolean {
  return TREASURY_KINDS_WITH_COUPONS.includes(kind)
}
