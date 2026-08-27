import { describe, it, expect } from 'vitest'
import {
  brlQuoteToCents,
  quoteProviderFor,
  realsToCents,
  summarizeQuoteRun,
  yahooSymbolFor,
  type QuoteOutcome,
} from '@/lib/quotes'

// --- helpers ----------------------------------------------------------------

const updated = (ticker: string): QuoteOutcome => ({
  ticker,
  status: 'updated',
  priceCents: 1000,
})
const unchanged = (ticker: string): QuoteOutcome => ({ ticker, status: 'unchanged' })
const missing = (ticker: string): QuoteOutcome => ({ ticker, status: 'missing' })

describe('quoteProviderFor', () => {
  it('sends what trades on the B3 to Yahoo', () => {
    expect(quoteProviderFor('stock_br')).toBe('yahoo')
    expect(quoteProviderFor('fii')).toBe('yahoo')
  })

  it('leaves the types that do not trade in reais on the manual cell', () => {
    // Yahoo CAN price these — it just answers in dollars, and the column is
    // cents of BRL with no currency beside it (ADR-010).
    expect(quoteProviderFor('stock_intl')).toBeNull()
    expect(quoteProviderFor('crypto')).toBeNull()
    expect(quoteProviderFor('fixed_income')).toBeNull()
  })
})

describe('yahooSymbolFor', () => {
  it('adds the B3 suffix to what is fetched', () => {
    expect(yahooSymbolFor('PETR4', 'stock_br')).toBe('PETR4.SA')
    expect(yahooSymbolFor('XPML11', 'fii')).toBe('XPML11.SA')
  })

  it('covers ETFs and BDRs without a type of their own', () => {
    // BOVA11 and AAPL34 are stored as stock_br like any other B3 line, and the
    // suffix is all Yahoo needs to price them.
    expect(yahooSymbolFor('BOVA11', 'stock_br')).toBe('BOVA11.SA')
    expect(yahooSymbolFor('AAPL34', 'stock_br')).toBe('AAPL34.SA')
  })

  it('normalises what the user typed', () => {
    expect(yahooSymbolFor(' petr4 ', 'stock_br')).toBe('PETR4.SA')
  })

  it('has no symbol for a type that is not fetched', () => {
    expect(yahooSymbolFor('BTC', 'crypto')).toBeNull()
    expect(yahooSymbolFor('AAPL', 'stock_intl')).toBeNull()
    expect(yahooSymbolFor('IPCA+ 2035', 'fixed_income')).toBeNull()
  })
})

describe('brlQuoteToCents', () => {
  it('converts a quote that came back in reais', () => {
    expect(brlQuoteToCents({ price: 42.72, currency: 'BRL' })).toBe(4272)
  })

  it('REFUSES a quote in any other currency', () => {
    // The safety net of ADR-010: the column means cents of BRL and has no
    // currency beside it, so writing 80218 for BTC-USD would claim bitcoin is
    // worth R$ 802,18. Refusing keeps the stored price instead.
    expect(brlQuoteToCents({ price: 80218.89, currency: 'USD' })).toBeNull()
    expect(brlQuoteToCents({ price: 1486.4, currency: 'EUR' })).toBeNull()
    // GBp is pence, not pounds — the trap that makes "just multiply" wrong.
    expect(brlQuoteToCents({ price: 3311, currency: 'GBp' })).toBeNull()
  })

  it('passes a missing quote straight through', () => {
    expect(brlQuoteToCents(null)).toBeNull()
  })

  it('refuses a BRL quote that is not a usable price', () => {
    expect(brlQuoteToCents({ price: 0, currency: 'BRL' })).toBeNull()
  })
})

describe('realsToCents', () => {
  it('converts reais to cents', () => {
    expect(realsToCents(42.72)).toBe(4272)
    expect(realsToCents(1)).toBe(100)
  })

  it('kills the float noise instead of storing it', () => {
    // 42.72 * 100 is not exactly 4272 in IEEE 754, and 8.29 * 100 is not
    // exactly 829 — without the rounding these would reach the DECIMAL column
    // with a tail of garbage digits.
    expect(realsToCents(8.29)).toBe(829)
    expect(realsToCents(139.97)).toBe(13997)
  })

  it('keeps a price finer than a cent (ADR-007)', () => {
    // A coin worth R$ 0,0000071 is 0,00071 cents — the whole reason the column
    // is DECIMAL(20,6) and not an integer.
    expect(realsToCents(0.0000071)).toBe(0.00071)
  })

  it('rounds at the sixth decimal place, the limit of the column', () => {
    // 0,0000005 cents rounds up to the smallest storable quote...
    expect(realsToCents(0.000000005)).toBe(0.000001)
    // ...but anything below that has no representation, and a stored 0 would
    // read as "this is worthless", so it counts as no answer at all.
    expect(realsToCents(0.0000000012)).toBeNull()
  })

  it('refuses anything that is not a usable price', () => {
    expect(realsToCents(0)).toBeNull()
    expect(realsToCents(-3)).toBeNull()
    expect(realsToCents(Number.NaN)).toBeNull()
    expect(realsToCents(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('summarizeQuoteRun', () => {
  it('says so when there was nothing to price', () => {
    expect(summarizeQuoteRun([])).toBe('Nenhum ativo com cotação automática.')
  })

  it('counts a clean run', () => {
    expect(summarizeQuoteRun([updated('PETR4'), updated('VALE3')])).toBe(
      '2 cotações atualizadas',
    )
  })

  it('keeps the singular readable', () => {
    expect(summarizeQuoteRun([updated('PETR4')])).toBe('1 cotação atualizada')
  })

  it('separates what did not move', () => {
    expect(summarizeQuoteRun([updated('PETR4'), unchanged('VALE3')])).toBe(
      '1 cotação atualizada · 1 sem mudança',
    )
  })

  it('names the tickers the API did not answer', () => {
    // Counting them would leave the user hunting through the table for which.
    expect(summarizeQuoteRun([updated('PETR4'), missing('XPML11'), missing('TGAR11')])).toBe(
      '1 cotação atualizada · 2 sem retorno (XPML11, TGAR11)',
    )
  })

  it('reports a run where nothing came back at all', () => {
    expect(summarizeQuoteRun([missing('BBAS3')])).toBe('1 sem retorno (BBAS3)')
  })
})
