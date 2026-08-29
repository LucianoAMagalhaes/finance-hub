// Automatic quotes — the pure half. No fetch, no Prisma, no React.
//
// Role in the architecture: everything about refreshing a quote that can be
// decided WITHOUT talking to the network lives here, so it can be unit-tested in
// Vitest and reused by the Server Action and the button alike. The half that
// does talk to the network is lib/yahoo.ts, and it is deliberately dumb.
//
// Same split as lib/portfolio.ts (pure math) versus the page that queries the
// database: what is testable stays pure, what touches the outside world stays
// thin.
//
// Tests live in lib/quotes.test.ts.

import { PURCHASE_CURRENCIES } from '@/lib/constants'
import type { AssetType, TreasuryKind, PurchaseCurrency } from '@/lib/constants'
import type { YahooQuote } from '@/lib/yahoo'
import { treasuryKindFromName } from '@/lib/treasury'

/** The market-data sources this app knows how to call. */
export type QuoteProvider = 'yahoo' | 'tesouro'

// How each provider is named when a run has to report that it was unreachable.
const PROVIDER_LABELS: Record<QuoteProvider, string> = {
  yahoo: 'Yahoo Finance',
  tesouro: 'Tesouro Direto',
}

/** What happened to one ticker in one refresh run. */
export type QuoteOutcome =
  // The API returned a price and it differs from what was stored.
  | { ticker: string; status: 'updated'; priceCents: number }
  // The API returned the very same price we already had — nothing written, so
  // priceUpdatedAt stays where it was (see refreshQuotes).
  | { ticker: string; status: 'unchanged' }
  // The API had nothing usable for this ticker. The stored quote is KEPT: an
  // old price is closer to the truth than no price at all.
  | { ticker: string; status: 'missing' }

/**
 * Which source can price an asset of this type, or null when the type has no
 * automatic quote and stays hand-typed in the table cell.
 *
 * The line drawn here is CURRENCY, not coverage (see ADR-010). Yahoo can price
 * far more than this — AAPL, VOO, BTC — but it answers those in dollars, and
 * `Asset.currentPriceCents` is cents of BRL with no currency column beside it.
 * So only what already trades in reais is fetched: everything on the B3, which
 * covers shares, FIIs, Brazilian ETFs (BOVA11, IVVB11) and BDRs (AAPL34) alike.
 * Crypto, foreign-listed shares and Tesouro stay on the manual cell.
 *
 * The exhaustive switch is on purpose: adding a value to AssetType breaks the
 * build here until someone decides how the new type gets priced. Same shape as
 * scoreScopeFor in lib/scoring.ts.
 *
 * @param type - The asset's type as stored in the DB.
 */
export function quoteProviderFor(type: AssetType): QuoteProvider | null {
  switch (type) {
    case 'stock_br':
    case 'fii':
      return 'yahoo'
    case 'fixed_income':
      // Tesouro Direto publishes a daily price file with every bond in it, and
      // bonds are priced in reais like everything else fetched here.
      return 'tesouro'
    case 'stock_intl':
    case 'crypto':
      return null
  }
}

/**
 * The symbol to ask Yahoo for, or null when this type is not fetched at all.
 *
 * Tickers are stored bare ("PETR4", "XPML11") because that is what the user
 * types and what the table shows; the exchange suffix is Yahoo's addressing
 * scheme, not part of the asset's identity. Everything quoted today is on the
 * B3, so the suffix is always ".SA" — the function exists so that the day a
 * second market is added, the mapping has one obvious home instead of being
 * string-concatenated inside the Server Action.
 *
 * @param ticker - The ticker as stored on the asset row.
 * @param type - The asset's type, which decides the market.
 */
export function yahooSymbolFor(ticker: string, type: AssetType): string | null {
  // Note the check: `!== 'yahoo'`, NOT `=== null`. Fixed income now has a
  // provider of its own, and the looser check would happily hand Yahoo a symbol
  // like "TESOURO IPCA+ 2035.SA".
  if (quoteProviderFor(type) !== 'yahoo') return null
  return `${ticker.trim().toUpperCase()}.SA`
}

/**
 * Converts a price in REAIS (what the API speaks) to CENTS (what the DB stores).
 *
 * Two conventions meet here. Money that actually moved is an integer of cents
 * (ADR-005), but a QUOTE may be finer than a cent (ADR-007) — hence the
 * DECIMAL(20,6) column — so this rounds to 6 decimal places instead of to an
 * integer. The rounding also cleans up float noise: 42.72 * 100 does not land
 * exactly on 4272 in IEEE 754.
 *
 * Returns null for anything that is not a usable price — zero, negative, NaN,
 * Infinity, or a value so small it rounds away to nothing in six decimal places
 * — so the caller can treat "the API answered garbage" the same as "the API
 * answered nothing" and keep the stored quote.
 *
 * @param reais - Unit price in reais, as returned by the provider.
 */
export function realsToCents(reais: number): number | null {
  if (!Number.isFinite(reais) || reais <= 0) return null
  const cents = Math.round(reais * 100 * 1e6) / 1e6
  // A positive price that rounds to zero cannot be stored as a quote: the column
  // stops at six decimals, and a stored 0 would read as "this is worthless".
  return cents === 0 ? null : cents
}

/**
 * The foreign currencies this app knows how to convert into reais.
 *
 * A CLOSED list, and it has to stay closed. Yahoo reports the currency of every
 * symbol, and converting whatever comes back by "the rate for that code" is one
 * step away from being wrong by a factor of 100: London quotes in **GBp** —
 * pence, not pounds — and Johannesburg in ZAc. Anything not listed here is
 * refused rather than guessed, which costs the user a quote and never costs them
 * a wrong number.
 */
// Derived from the purchase currencies rather than written out again: the two
// are the same promise seen from two sides — what the user may type in, and what
// a provider may answer in — and letting them drift would mean accepting a
// purchase the quote refresh could not price.
export const SUPPORTED_FX = PURCHASE_CURRENCIES.filter(
  (currency): currency is Exclude<PurchaseCurrency, 'BRL'> => currency !== 'BRL',
)
export type SupportedCurrency = (typeof SUPPORTED_FX)[number]

/**
 * True when this app can convert amounts in that currency into reais.
 *
 * @param currency - A currency code as a provider reports it.
 */
export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return (SUPPORTED_FX as readonly string[]).includes(currency)
}

/**
 * Converts an amount in a foreign currency's cents into cents of BRL.
 *
 * Money that actually moved is an INTEGER of cents everywhere in this app
 * (ADR-005), so the result is rounded to an integer — once, at the end, which is
 * the only rounding in the whole conversion.
 *
 * @param amountCents - The amount, in cents of the foreign currency (US$ 96,59
 *                      is 9659).
 * @param rate - How many reais one unit of that currency is worth (5.2054).
 * @returns The same amount in cents of BRL, or null when the rate is unusable.
 */
export function foreignToBrlCents(amountCents: number, rate: number): number | null {
  if (!Number.isFinite(amountCents) || !Number.isFinite(rate) || rate <= 0) return null
  return Math.round(amountCents * rate)
}

/**
 * Turns one provider quote into cents, REFUSING anything that is not in reais.
 *
 * This is the safety net for the decision in ADR-010. Yahoo answers whatever
 * currency the symbol trades in, and a wrong suffix (or a ticker that also
 * exists on another exchange) could hand back USD for a symbol we assumed was
 * Brazilian. Since the column stores cents of BRL with no currency beside it,
 * writing that number would silently claim an asset is worth five times less
 * than it is. Refusing means the ticker is reported as "sem retorno" and keeps
 * the price it had — the same treatment as a symbol Yahoo never found.
 *
 * @param quote - The price and currency as the provider reported them.
 */
export function brlQuoteToCents(quote: YahooQuote | null): number | null {
  if (quote === null) return null
  if (quote.currency !== 'BRL') return null
  return realsToCents(quote.price)
}

/**
 * The prices of every Tesouro bond on offer, as of one date.
 *
 * The key is built by tesouroPriceKey, not by the bond's full maturity date —
 * see that function for why.
 */
export type TesouroPrices = {
  /** The "Data Base" of the rows read: the morning the prices are from. */
  dataBase: Date
  /** Bond key -> unit price (PU) in cents. */
  prices: Map<string, number>
}

/**
 * The key a bond is looked up by: its kind plus the YEAR it matures.
 *
 * Not the full date, on purpose. No kind offers two maturities in the same year
 * (verified against all 58 bonds on offer), so the year is enough to name one
 * bond — and it is forgiving of a maturity whose day the user typed from memory.
 * "Tesouro IPCA+ 2035" is the bond; whether they wrote 15/05 or 15/06 is not
 * something the app should punish with a missing quote.
 *
 * @param kind - Which Tesouro bond it is.
 * @param maturityDate - Its maturity, stored at UTC midnight.
 */
export function tesouroPriceKey(kind: TreasuryKind, maturityDate: Date): string {
  return `${kind}:${maturityDate.getUTCFullYear()}`
}

// "28/08/2026" -> its three numbers, or null when it is not a date.
//
// The two dates in this file are turned into Date objects DIFFERENTLY, which is
// why the parsing stops here instead of returning one:
//   * the maturity only ever gives up its YEAR, so UTC midnight is right and
//     matches how maturities are stored everywhere else in the app;
//   * the Data Base is written to `priceUpdatedAt`, which is a MOMENT that gets
//     rendered in local time by formatRelativeDay. Stored at UTC midnight it
//     would land on the previous calendar day anywhere west of Greenwich, and a
//     price from yesterday would read "há 2 dias".
function parseBrDateParts(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim())
  if (match === null) return null
  const [, day, month, year] = match
  const parts = { year: Number(year), month: Number(month), day: Number(day) }
  // Rejects 31/02 and friends: the Date would roll over into the next month.
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return probe.getUTCMonth() === parts.month - 1 && probe.getUTCDate() === parts.day
    ? parts
    : null
}

// A maturity, at UTC midnight — only its year is ever read.
function parseMaturity(value: string): Date | null {
  const parts = parseBrDateParts(value)
  return parts === null
    ? null
    : new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

// The Data Base as a moment on that calendar day, LOCAL time.
//
// Noon, not midnight: the file publishes the MORNING price of that day, so any
// time inside the day is closer to the truth than midnight — and noon is the
// one point that stays on the right day under every timezone and DST shift.
function parseDataBase(value: string): Date | null {
  const parts = parseBrDateParts(value)
  return parts === null ? null : new Date(parts.year, parts.month - 1, parts.day, 12)
}

// "2458,57" -> 2458.57. The file writes money the Brazilian way.
function parseBrNumber(value: string): number | null {
  const parsed = Number(value.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Reads the Tesouro's daily price file into the prices of the most recent date.
 *
 * The file carries the entire history, so this keeps ONLY the rows of the latest
 * "Data Base" it can see. It scans for the maximum date rather than trusting the
 * first row: the file happens to be sorted newest-first (which is what lets
 * lib/tesouro hang up after 32 KB), but relying on that ordering for
 * CORRECTNESS as well as for speed would make a re-sorted file silently price
 * the portfolio with last year's numbers.
 *
 * Which column: **PU Venda**, the price the Tesouro buys the bond back at — what
 * the holder would actually receive. Checked against a real statement: 1,10 ×
 * 2.458,57 = 2.704,43 against the bank's 2.704,41. PU Compra would have given
 * 2.730,65, R$ 26 too high.
 *
 * No currency check here, unlike brlQuoteToCents: this file is Brazilian
 * government data about Brazilian bonds and has no currency column to check
 * against. The absence is deliberate, not an oversight.
 *
 * Rows that cannot be understood — a truncated last line, a bond name the app
 * does not know, a malformed price — are skipped in silence. One odd row must
 * not cost the other 57 their quote.
 *
 * @param csv - The beginning of the price file, header included.
 * @returns The prices of the newest date, or null when the text held no usable row.
 */
export function parseTesouroPrices(csv: string): TesouroPrices | null {
  type Row = { key: string; dataBase: Date; priceCents: number }
  const rows: Row[] = []

  // The header is skipped by the field checks below, so there is no special
  // case for it: "Tipo Titulo" is not a bond name and "Data Base" is not a date.
  for (const line of csv.split('\n')) {
    const fields = line.split(';')
    if (fields.length < 8) continue // truncated last line, or not a data row

    const kind = treasuryKindFromName(fields[0])
    if (kind === null) continue

    const maturity = parseMaturity(fields[1])
    const dataBase = parseDataBase(fields[2])
    if (maturity === null || dataBase === null) continue

    const puVenda = parseBrNumber(fields[6])
    if (puVenda === null) continue

    const priceCents = realsToCents(puVenda)
    if (priceCents === null) continue

    rows.push({ key: tesouroPriceKey(kind, maturity), dataBase, priceCents })
  }

  if (rows.length === 0) return null

  const newest = rows.reduce(
    (max, row) => (row.dataBase.getTime() > max.getTime() ? row.dataBase : max),
    rows[0].dataBase,
  )

  const prices = new Map<string, number>()
  const ambiguous = new Set<string>()

  for (const row of rows) {
    if (row.dataBase.getTime() !== newest.getTime()) continue

    // Two bonds landing on one key would mean the "no repeated year within a
    // kind" assumption broke. Rather than pick one and price the other wrong,
    // drop both: they become "sem retorno" and keep the quote they had, which
    // is a visible, harmless outcome instead of a silent, wrong number.
    if (prices.has(row.key)) {
      ambiguous.add(row.key)
      continue
    }
    prices.set(row.key, row.priceCents)
  }

  // Array.from (instead of iterating the Set directly) keeps this compatible
  // with the project's TypeScript target — same reason allocationByType uses it.
  for (const key of Array.from(ambiguous)) prices.delete(key)

  return { dataBase: newest, prices }
}

/**
 * The one-line report the refresh button shows after a run.
 *
 * Lives here, and not inside the component, so the wording can be tested without
 * rendering anything — the same reason formatScore sits in lib/scoring.ts.
 *
 * @param outcomes - One entry per ticker the run tried to price.
 * @param failedProviders - Providers that could not be reached at all. Their
 *                          assets show up among `outcomes` as `missing`, but the
 *                          reason belongs in the sentence: "sem retorno" reads
 *                          like a problem with the ticker, not with the source.
 */
export function summarizeQuoteRun(
  outcomes: QuoteOutcome[],
  failedProviders: QuoteProvider[] = [],
): string {
  const failures = failedProviders.map(
    (provider) => `${PROVIDER_LABELS[provider]} indisponível`,
  )

  if (outcomes.length === 0) {
    return failures.length > 0
      ? failures.join(' · ')
      : 'Nenhum ativo com cotação automática.'
  }

  const updated = outcomes.filter((outcome) => outcome.status === 'updated').length
  const unchanged = outcomes.filter((outcome) => outcome.status === 'unchanged').length
  const missing = outcomes.filter((outcome) => outcome.status === 'missing')

  const parts: string[] = []

  if (updated > 0) {
    parts.push(
      `${updated} cotaç${updated === 1 ? 'ão' : 'ões'} atualizada${updated === 1 ? '' : 's'}`,
    )
  }
  if (unchanged > 0) {
    parts.push(`${unchanged} sem mudança`)
  }
  if (missing.length > 0) {
    // The tickers are named, not just counted: "3 sem retorno" leaves the user
    // hunting through the table for which three.
    parts.push(
      `${missing.length} sem retorno (${missing.map((outcome) => outcome.ticker).join(', ')})`,
    )
  }

  return [...parts, ...failures].join(' · ')
}
