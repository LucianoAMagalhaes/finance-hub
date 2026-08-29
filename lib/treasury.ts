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

// --- Valor líquido: IR, IOF e taxa de custódia -------------------------------
//
// What a Tesouro position is worth GROSS is the same arithmetic as any other
// asset (quantity × quote), and lib/portfolio.ts already does it. What follows
// is the part that is particular to fixed income: the money that does NOT reach
// the holder on a redemption.
//
// Why this cannot reuse buildPosition: the income-tax rate depends on the age of
// EACH application, not on the position's average. Two purchases of the same
// bond made a year apart are taxed at different rates, so the cost basis has to
// stay split by lot instead of being averaged. Since selling was cut from the UI
// (see CLAUDE.md), every lot is still held and there is no FIFO to resolve.
//
// Everything here is an ESTIMATE and the UI says so. Two reasons it cannot be
// exact: the custody fee accrues daily on a price that moved every one of those
// days (reproducing it would need the full PU history), and an inflation-linked
// bond's final value depends on an index that is not published yet.

/** The regressive income-tax table, by how many calendar days the money stayed. */
const IR_BRACKETS: { upToDays: number; rate: number }[] = [
  { upToDays: 180, rate: 0.225 },
  { upToDays: 360, rate: 0.2 },
  { upToDays: 720, rate: 0.175 },
  { upToDays: Infinity, rate: 0.15 },
]

// IOF eats the yield of anything redeemed in under 30 days, on a fixed scale:
// 96% on day 1 down to 0% on day 30. Index 0 is day 1.
const IOF_RATES = [
  0.96, 0.93, 0.9, 0.86, 0.83, 0.8, 0.76, 0.73, 0.7, 0.66, 0.63, 0.6, 0.56, 0.53, 0.5,
  0.46, 0.43, 0.4, 0.36, 0.33, 0.3, 0.26, 0.23, 0.2, 0.16, 0.13, 0.1, 0.06, 0.03, 0,
]

/** B3's custody fee: 0,20% a year on the value held. */
const CUSTODY_ANNUAL_RATE = 0.002

/**
 * How much Tesouro Selic is exempt from the custody fee, in cents.
 *
 * The exemption is per INVESTOR across all their Selic holdings; this app applies
 * it per position, which is the same number for anyone holding a single Selic
 * bond and slightly generous for anyone holding several.
 */
export const SELIC_CUSTODY_EXEMPTION_CENTS = 10_000_00

/**
 * The income-tax rate for money that stayed invested for `days`.
 *
 * @param days - Calendar days between the purchase and the redemption.
 */
export function irRateForDays(days: number): number {
  return IR_BRACKETS.find((bracket) => days <= bracket.upToDays)!.rate
}

/**
 * The share of the yield IOF takes from money redeemed in under 30 days.
 *
 * @param days - Calendar days between the purchase and the redemption.
 */
export function iofRateForDays(days: number): number {
  if (days >= 30) return 0
  // Day 0 (bought and redeemed the same day) is charged like day 1.
  return IOF_RATES[Math.max(0, days - 1)] ?? 0
}

/** One purchase, with what would be withheld if it were redeemed today. */
export type TreasuryLotTax = {
  date: Date
  quantity: number
  investedCents: number
  /** Calendar days the money has been invested. */
  days: number
  grossCents: number
  gainCents: number
  irRate: number
  iofCents: number
  irCents: number
  custodyCents: number
  netCents: number
}

/** What a Tesouro position would be worth if it were redeemed today. */
export type TreasuryNetValue = {
  investedCents: number
  grossCents: number
  gainCents: number
  iofCents: number
  irCents: number
  custodyCents: number
  netCents: number
  lots: TreasuryLotTax[]
}

/** One purchase, as this calculation needs to see it. */
export type TreasuryLot = {
  quantity: number
  totalCents: number
  date: Date
}

// Whole calendar days between two moments — "dias corridos", which is what both
// the tax table and the statement count.
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000))
}

/**
 * What a Tesouro position would actually pay out if redeemed today.
 *
 * Lot by lot: each purchase is aged on its own, taxed on its own gain, and the
 * results are added up. A lot at a loss is not taxed (and does not generate a
 * credit against the others — that is not how withholding works).
 *
 * The order of the deductions is the legal one: IOF comes off the yield first,
 * and income tax applies to what is left of it.
 *
 * @param kind - Which bond it is; only used for the Selic custody exemption.
 * @param lots - The purchases still held.
 * @param currentPriceCents - The bond's unit price today, or null when unknown.
 * @param asOf - The moment to age the lots against (the "redemption" date).
 * @returns The breakdown, or null when there is no price to value the position.
 */
export function treasuryNetValue(
  kind: TreasuryKind,
  lots: TreasuryLot[],
  currentPriceCents: number | null,
  asOf: Date,
): TreasuryNetValue | null {
  if (currentPriceCents === null || lots.length === 0) return null

  const grossTotal = lots.reduce(
    (sum, lot) => sum + Math.round(lot.quantity * currentPriceCents),
    0,
  )
  if (grossTotal <= 0) return null

  // The Selic exemption covers a slice of the position, so it is spread across
  // the lots in proportion rather than being charged to whichever came first.
  const exemptCents =
    kind === 'selic' ? Math.min(SELIC_CUSTODY_EXEMPTION_CENTS, grossTotal) : 0
  const chargeableShare = (grossTotal - exemptCents) / grossTotal

  const detailed: TreasuryLotTax[] = lots.map((lot) => {
    const days = daysBetween(lot.date, asOf)
    const grossCents = Math.round(lot.quantity * currentPriceCents)
    const gainCents = grossCents - lot.totalCents

    // A lot underwater owes nothing: no yield, no IOF, no income tax.
    const taxableBase = Math.max(0, gainCents)
    const iofCents = Math.round(taxableBase * iofRateForDays(days))
    const irRate = irRateForDays(days)
    const irCents = Math.round((taxableBase - iofCents) * irRate)

    // The custody fee is charged on the VALUE held, not on the gain, so it is
    // owed even by a lot at a loss. Estimated on the average of what went in and
    // what it is worth now, pro-rated over the days held: the real fee accrues
    // daily on a value that grew, which lands between the two. Measured against
    // a real statement this came out at R$ 4,29 against R$ 4,18 charged.
    const averageValue = (lot.totalCents + grossCents) / 2
    const custodyCents = Math.round(
      averageValue * CUSTODY_ANNUAL_RATE * (days / 365) * chargeableShare,
    )

    return {
      date: lot.date,
      quantity: lot.quantity,
      investedCents: lot.totalCents,
      days,
      grossCents,
      gainCents,
      irRate,
      iofCents,
      irCents,
      custodyCents,
      netCents: grossCents - iofCents - irCents - custodyCents,
    }
  })

  const total = <K extends keyof TreasuryLotTax>(key: K) =>
    detailed.reduce((sum, lot) => sum + (lot[key] as number), 0)

  return {
    investedCents: total('investedCents'),
    grossCents: total('grossCents'),
    gainCents: total('gainCents'),
    iofCents: total('iofCents'),
    irCents: total('irCents'),
    custodyCents: total('custodyCents'),
    netCents: total('netCents'),
    lots: detailed,
  }
}
