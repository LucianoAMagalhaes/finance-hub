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

import type { AssetType } from '@/lib/constants'
import type { YahooQuote } from '@/lib/yahoo'

/** The market-data sources this app knows how to call. */
export type QuoteProvider = 'yahoo'

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
    case 'stock_intl':
    case 'crypto':
    case 'fixed_income':
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
  if (quoteProviderFor(type) === null) return null
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
 * The one-line report the refresh button shows after a run.
 *
 * Lives here, and not inside the component, so the wording can be tested without
 * rendering anything — the same reason formatScore sits in lib/scoring.ts.
 *
 * @param outcomes - One entry per ticker the run tried to price.
 */
export function summarizeQuoteRun(outcomes: QuoteOutcome[]): string {
  if (outcomes.length === 0) {
    return 'Nenhum ativo com cotação automática.'
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

  return parts.join(' · ')
}
