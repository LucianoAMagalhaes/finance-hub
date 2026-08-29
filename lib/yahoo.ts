// Yahoo Finance client — the ONLY place in the app that talks to a quote
// provider.
//
// Role in the architecture: this file is deliberately dumb. It knows how to ask
// Yahoo for a price and how to tell a broken request from a missing ticker, and
// nothing else. Every decision about what to do with the answer (which symbol to
// ask for, convert to cents, compare with what is stored, write or not write)
// lives in lib/quotes.ts and in the refreshQuotes Server Action, where it can be
// unit-tested without a network.
//
// This module is SERVER-ONLY. Its only importer is a "use server" file, which is
// what keeps it off the browser — never import it from a Client Component.
//
// About the endpoint (see ADR-010): this is Yahoo's own internal chart API, not
// a public product. There is no key and no signup, and it covers everything the
// B3 lists — shares, FIIs, Brazilian ETFs and BDRs — but Yahoo can change it
// without notice. That is the trade accepted in the ADR, and it is why every
// failure here comes back as a sentence the user can read instead of a crash.
//
// Three things learned by testing the live endpoint (2026-08-27):
//   * It throttles BURSTS with a 429 that clears within seconds. A dozen tickets
//     fired four-at-a-time was enough to trip it, so this client keeps two
//     connections and retries a 429 once after a pause. Only a second refusal is
//     reported to the user.
//   * The User-Agent matters and not in the obvious direction: curl's default UA
//     is refused outright, while Node's fetch is answered fine either way. The
//     header below is a plain, honest identifier — claiming to be Chrome without
//     Chrome's TLS fingerprint is what anti-bot checks look for.
//   * An unknown symbol answers 404 with { chart: { error: {...} } }, which is
//     about that symbol alone and must not sink the rest of the run.

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'

// An honest identifier. Some clients (curl's default UA among them) are refused
// outright, so the header has to be there — but it does not pretend to be a
// browser it is not.
const USER_AGENT = 'finance-hub/1.0 (personal portfolio app)'

// How many requests are in flight at once. Two, not more: the endpoint throttles
// bursts, and a dozen tickers still finish in a few seconds.
const CONCURRENCY = 2

// A hung provider must not hold the Server Action open forever.
const TIMEOUT_MS = 8000

// How long to wait before retrying a throttled request. The 429 clears within
// seconds, so one pause is usually the whole fix.
const RETRY_DELAY_MS = 1500

/**
 * Raised when the whole run cannot proceed (rate limited, network down, Yahoo
 * changed the shape of the answer). A single symbol that simply is not found
 * does NOT raise this — it comes back null, so one bad ticker never sinks the
 * other eleven.
 *
 * The message is user-facing Portuguese: it is shown as-is under the button.
 */
export class YahooError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'YahooError'
  }
}

/**
 * True when the error came from this module, i.e. its message is already a
 * finished sentence for the user.
 *
 * Duck-typed on `name` instead of `instanceof`, the same defensive choice
 * isPrismaError makes in the portfolio actions: `instanceof` across a module
 * boundary is one bundling accident away from silently returning false.
 *
 * @param error - Anything caught in a try/catch.
 */
export function isYahooError(error: unknown): error is YahooError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'YahooError'
  )
}

/**
 * One quote as Yahoo reports it. The currency travels WITH the price on purpose:
 * this app stores quotes in cents of BRL, and Yahoo answers AAPL in USD and
 * SHEL.L in pence. Handing the price over without its currency is how a
 * portfolio ends up believing bitcoin costs eighty thousand reais.
 */
export type YahooQuote = {
  price: number
  /** ISO-ish code as Yahoo writes it: "BRL", "USD", "EUR", "GBp". */
  currency: string
}

/** The slice of Yahoo's response this app reads. Everything else is ignored. */
type YahooChartResponse = {
  chart?: {
    result?: { meta?: { regularMarketPrice?: number; currency?: string } }[] | null
    error?: { code?: string; description?: string } | null
  }
}

/**
 * Fetches the current quote of each symbol.
 *
 * @param symbols - Yahoo symbols, already suffixed (e.g. "PETR4.SA"). Build them
 *                  with yahooSymbolFor in lib/quotes.ts — this module does not
 *                  know what an asset type is.
 * @returns One entry per requested symbol; null means Yahoo had no usable quote
 *          for it, and the caller must keep the stored price.
 * @throws YahooError when the run as a whole cannot proceed.
 */
export async function fetchYahooQuotes(
  symbols: string[],
): Promise<Map<string, YahooQuote | null>> {
  const results = new Map<string, YahooQuote | null>()
  if (symbols.length === 0) return results

  // Hand-rolled worker pool: CONCURRENCY loops pulling from one shared cursor.
  // Simpler than a dependency, and firing all twelve at once is exactly the
  // burst that gets an unofficial endpoint to start refusing.
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < symbols.length) {
      const symbol = symbols[cursor++]
      results.set(symbol, await fetchOne(symbol))
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, () => worker()),
  )

  return results
}

/** The slice of Yahoo's historical response this app reads. */
type YahooHistoryResponse = {
  chart?: {
    result?:
      | {
          timestamp?: number[] | null
          indicators?: { quote?: { close?: (number | null)[] | null }[] | null }
        }[]
      | null
    error?: { code?: string; description?: string } | null
  }
}

// How far back to look for a close when the requested day has none. Ten days
// covers a long weekend plus a holiday stretch without pulling a whole year.
const HISTORY_LOOKBACK_DAYS = 10

// Reads a timestamp as the calendar day Yahoo means by it.
function utcDay(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

/**
 * The closing value of a symbol on a given day — or on the most recent trading
 * day before it.
 *
 * The fallback is the point: a purchase made on a Saturday has no exchange rate
 * of its own, and refusing to record it would be absurd. Friday's close is what
 * the market last said, and it is what any broker would use.
 *
 * Used for USDBRL=X, to convert a purchase made in dollars at the rate of the day
 * it happened (see ADR-013) — which is what makes the return shown in reais
 * include the dollar's own movement.
 *
 * @param symbol - A Yahoo symbol, e.g. "USDBRL=X".
 * @param date - The day wanted.
 * @returns The close, or null when the window holds no usable value.
 * @throws YahooError when the request itself cannot be made.
 */
export async function fetchYahooCloseOn(
  symbol: string,
  date: Date,
): Promise<number | null> {
  // The window ends the day AFTER the target, because period2 is exclusive of
  // the day it lands in for daily candles.
  const end = new Date(date.getTime() + 86_400_000)
  const start = new Date(date.getTime() - HISTORY_LOOKBACK_DAYS * 86_400_000)
  const period1 = Math.floor(start.getTime() / 1000)
  const period2 = Math.floor(end.getTime() / 1000)

  let response: Response
  try {
    response = await fetch(
      `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}`,
      {
        headers: { 'User-Agent': USER_AGENT },
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'TimeoutError' ? 'demorou demais' : 'falhou'
    throw new YahooError(
      `Não foi possível buscar a cotação do dólar (a conexão ${reason}). Verifique sua internet e tente de novo.`,
    )
  }

  if (response.status === 404) return null
  if (!response.ok) {
    throw new YahooError(
      `O Yahoo Finance respondeu com erro ${response.status} ao buscar o câmbio.`,
    )
  }

  let payload: YahooHistoryResponse
  try {
    payload = (await response.json()) as YahooHistoryResponse
  } catch {
    throw new YahooError('O Yahoo Finance respondeu algo que não é JSON.')
  }

  return pickCloseOnOrBefore(payload, date)
}

/**
 * The last close at or before `date` in a historical payload.
 *
 * Split out from the fetch so the "weekend falls back to Friday" rule can be
 * tested against a fixture, with no network — the same split as everything else
 * in lib/quotes.ts.
 *
 * @param payload - Yahoo's chart response.
 * @param date - The day wanted.
 */
export function pickCloseOnOrBefore(
  payload: YahooHistoryResponse,
  date: Date,
): number | null {
  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.quote?.[0]?.close
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return null

  const wanted = date.toISOString().slice(0, 10)
  let best: number | null = null

  // Yahoo returns the window in chronological order, so the last candle that is
  // still on or before the target day is the one wanted. A null close means the
  // market was shut that day and the next candidate back should win.
  for (let i = 0; i < timestamps.length; i += 1) {
    if (utcDay(timestamps[i]) > wanted) break
    const close = closes[i]
    if (typeof close === 'number' && Number.isFinite(close) && close > 0) best = close
  }

  return best
}

/**
 * One symbol, with one retry if the endpoint throttles the first attempt.
 *
 * @param symbol - The Yahoo symbol to price.
 * @param retriesLeft - How many more times a 429 may be forgiven.
 */
async function fetchOne(symbol: string, retriesLeft = 1): Promise<YahooQuote | null> {
  let response: Response
  try {
    response = await fetch(
      `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: { 'User-Agent': USER_AGENT },
        // The whole point of the button is to bypass any cache and read the
        // market as it is right now.
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    )
  } catch (error) {
    // Timeout, DNS failure, offline. Fatal for the run: if the network is down
    // for one symbol it is down for all of them.
    const reason =
      error instanceof Error && error.name === 'TimeoutError' ? 'demorou demais' : 'falhou'
    throw new YahooError(
      `Não foi possível falar com o Yahoo Finance (a conexão ${reason}). Verifique sua internet e tente de novo.`,
    )
  }

  // 404 is about THIS symbol (delisted, renamed, typo in the ticker), so the
  // other assets carry on and this one is reported as "sem retorno".
  if (response.status === 404) return null

  // A throttled burst clears in seconds, so the first 429 buys a pause rather
  // than an error message. Only a second refusal reaches the user.
  if (response.status === 429) {
    if (retriesLeft > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      return fetchOne(symbol, retriesLeft - 1)
    }
    throw new YahooError(
      'O Yahoo Finance recusou as requisições (limite temporário). Espere um minuto e tente de novo.',
    )
  }

  if (!response.ok) {
    throw new YahooError(`O Yahoo Finance respondeu com erro ${response.status}.`)
  }

  let payload: YahooChartResponse
  try {
    payload = (await response.json()) as YahooChartResponse
  } catch {
    throw new YahooError('O Yahoo Finance respondeu algo que não é JSON.')
  }

  // A 200 carrying an error object happens for some symbols; treat it as "no
  // quote for this one" rather than trusting an absent field.
  if (payload.chart?.error) return null

  const meta = payload.chart?.result?.[0]?.meta
  if (typeof meta?.regularMarketPrice !== 'number' || typeof meta.currency !== 'string') {
    return null
  }

  return { price: meta.regularMarketPrice, currency: meta.currency }
}
