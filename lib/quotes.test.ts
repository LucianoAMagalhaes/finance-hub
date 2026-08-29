import { describe, it, expect } from 'vitest'
import { formatRelativeDay } from '@/lib/format'
import {
  brlQuoteToCents,
  foreignToBrlCents,
  isSupportedCurrency,
  parseTesouroPrices,
  quoteProviderFor,
  realsToCents,
  summarizeQuoteRun,
  tesouroPriceKey,
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

  it('sends Tesouro bonds to their own provider', () => {
    // The Tesouro publishes one daily file with every bond, priced in reais.
    expect(quoteProviderFor('fixed_income')).toBe('tesouro')
  })

  it('sends foreign shares to Yahoo too, now that dollars can be converted', () => {
    // Before ADR-013 this was null: Yahoo answers in dollars and the column is
    // cents of BRL. Now the refresh converts before storing.
    expect(quoteProviderFor('stock_intl')).toBe('yahoo')
  })

  it('leaves crypto on the manual cell', () => {
    // Same mechanics, different symbol shape ("BTC-USD"), and no coin in the
    // portfolio to verify it against.
    expect(quoteProviderFor('crypto')).toBeNull()
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

  it('asks for a foreign listing bare, with no exchange suffix', () => {
    // "IVV.SA" is a different thing (or nothing at all). The US listing is the
    // plain symbol.
    expect(yahooSymbolFor('IVV', 'stock_intl')).toBe('IVV')
    expect(yahooSymbolFor(' aapl ', 'stock_intl')).toBe('AAPL')
  })

  it('has no symbol for a type Yahoo does not price here', () => {
    expect(yahooSymbolFor('BTC', 'crypto')).toBeNull()
    // Fixed income HAS a provider, just not this one — so the guard cannot be
    // "has no provider", or a bond would be asked for as "TESOURO IPCA+ 2035.SA".
    expect(yahooSymbolFor('Tesouro IPCA+ 2035', 'fixed_income')).toBeNull()
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

// --- Tesouro price file -----------------------------------------------------

// Real rows from the Tesouro Transparente file, trimmed to what matters. The
// file is served newest-first, so 28/08 comes before 27/08 here too.
// The calendar day a moment falls on in LOCAL time — what formatRelativeDay
// reads, and therefore what matters for the quote's displayed age.
function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const CSV_HEADER =
  'Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha'

const CSV = [
  CSV_HEADER,
  'Tesouro Selic;01/03/2031;28/08/2026;0,07;0,08;19708,55;19689,47;19689,47',
  'Tesouro IPCA+;15/05/2035;28/08/2026;7,76;7,88;2482,41;2458,57;2458,57',
  'Tesouro IPCA+ com Juros Semestrais;15/05/2035;28/08/2026;7,79;7,91;4318,84;4286,98;4286,98',
  'Tesouro Prefixado;01/01/2029;28/08/2026;14,08;14,20;737,30;735,12;735,12',
  // Yesterday's rows must not win over today's.
  'Tesouro IPCA+;15/05/2035;27/08/2026;7,70;7,82;2490,00;2470,00;2470,00',
].join('\n')

describe('parseTesouroPrices', () => {
  it('reads the most recent date and prices each bond', () => {
    const parsed = parseTesouroPrices(CSV)
    expect(parsed).not.toBeNull()
    // Asserted on LOCAL parts, because the Data Base is stored as a moment
    // inside that local day (see parseDataBase) — toISOString would make this
    // test pass or fail depending on the machine's timezone.
    expect(localDay(parsed!.dataBase)).toBe('2026-08-28')

    const price = parsed!.prices.get(tesouroPriceKey('ipca', new Date('2035-05-15T00:00:00Z')))
    // PU Venda 2458,57 -> 245857 cents.
    expect(price).toBe(245857)
  })

  it('takes PU Venda, not PU Compra', () => {
    // The column choice is worth a test of its own: it is what the holder would
    // receive, and it matched a real bank statement to R$ 0,02. PU Compra
    // (2482,41) would overstate the position.
    const parsed = parseTesouroPrices(CSV)!
    const key = tesouroPriceKey('ipca', new Date('2035-05-15T00:00:00Z'))
    expect(parsed.prices.get(key)).toBe(245857)
    expect(parsed.prices.get(key)).not.toBe(248241)
  })

  it('ignores rows from an older Data Base', () => {
    // 27/08 carried a different price for the same bond; today's must win.
    const parsed = parseTesouroPrices(CSV)!
    expect(parsed.prices.get(tesouroPriceKey('ipca', new Date('2035-05-15T00:00:00Z')))).toBe(
      245857,
    )
  })

  it('keeps the coupon bond apart from the principal one', () => {
    // Same kind-ish name, same year, very different price. Confusing them would
    // value a position at nearly double.
    const parsed = parseTesouroPrices(CSV)!
    const may2035 = new Date('2035-05-15T00:00:00Z')
    expect(parsed.prices.get(tesouroPriceKey('ipca', may2035))).toBe(245857)
    expect(parsed.prices.get(tesouroPriceKey('ipca_semiannual', may2035))).toBe(428698)
  })

  it('finds the newest date even if the file is not sorted', () => {
    const shuffled = [CSV_HEADER, ...CSV.split('\n').slice(1).reverse()].join('\n')
    const parsed = parseTesouroPrices(shuffled)!
    expect(localDay(parsed.dataBase)).toBe('2026-08-28')
    expect(parsed.prices.get(tesouroPriceKey('ipca', new Date('2035-05-15T00:00:00Z')))).toBe(
      245857,
    )
  })

  it('drops BOTH bonds when two land on the same key', () => {
    // Should never happen (no kind offers two maturities in one year), but if
    // it did, pricing one with the other's quote would be silent and wrong.
    // Leaving both unpriced is visible and harmless.
    const ambiguous = [
      CSV_HEADER,
      'Tesouro Selic;01/03/2031;28/08/2026;0,07;0,08;19708,55;19689,47;19689,47',
      'Tesouro Selic;01/09/2031;28/08/2026;0,07;0,08;19700,00;19600,00;19600,00',
    ].join('\n')
    const parsed = parseTesouroPrices(ambiguous)!
    expect(parsed.prices.has(tesouroPriceKey('selic', new Date('2031-03-01T00:00:00Z')))).toBe(
      false,
    )
  })

  it('skips a bond name it does not know without losing the others', () => {
    const withStranger = [
      CSV_HEADER,
      'Tesouro Ouro;01/03/2031;28/08/2026;0,07;0,08;100,00;99,00;99,00',
      'Tesouro Selic;01/03/2031;28/08/2026;0,07;0,08;19708,55;19689,47;19689,47',
    ].join('\n')
    const parsed = parseTesouroPrices(withStranger)!
    expect(parsed.prices.size).toBe(1)
    expect(parsed.prices.get(tesouroPriceKey('selic', new Date('2031-03-01T00:00:00Z')))).toBe(
      1968947,
    )
  })

  it('survives the truncated last line the early hang-up leaves behind', () => {
    // lib/tesouro stops reading after 32 KB, so the text almost always ends
    // mid-row. That row has too few fields and is simply skipped.
    const truncated = CSV + '\nTesouro Prefixado;01/01/2032;28/08/2026;14,49'
    const parsed = parseTesouroPrices(truncated)!
    expect(parsed.prices.size).toBe(4)
  })

  it('returns null when there is nothing usable, instead of throwing', () => {
    expect(parseTesouroPrices('')).toBeNull()
    expect(parseTesouroPrices(CSV_HEADER)).toBeNull()
    expect(parseTesouroPrices('<html>404</html>')).toBeNull()
  })
})

describe('summarizeQuoteRun — provider down', () => {
  it('names the provider that could not be reached', () => {
    const summary = summarizeQuoteRun([updated('PETR4'), missing('Tesouro Selic 2031')], [
      'tesouro',
    ])
    expect(summary).toContain('Tesouro Direto indisponível')
    // The bonds still show as missing, but the sentence says why.
    expect(summary).toContain('1 cotação atualizada')
  })

  it('says only the failure when nothing could be priced', () => {
    expect(summarizeQuoteRun([], ['yahoo'])).toBe('Yahoo Finance indisponível')
  })

  it('is unchanged when every provider answered', () => {
    expect(summarizeQuoteRun([updated('PETR4')])).toBe('1 cotação atualizada')
  })
})

describe('parseTesouroPrices — the Data Base is a local moment', () => {
  it('lands on the file\'s own calendar day, not the one before it', () => {
    // The regression this guards: stored at UTC midnight, 28/08 renders as 27/08
    // anywhere west of Greenwich, and yesterday's price reads "há 2 dias".
    const parsed = parseTesouroPrices(CSV)!
    expect(localDay(parsed.dataBase)).toBe('2026-08-28')
    expect(formatRelativeDay(parsed.dataBase, new Date(2026, 7, 29, 18))).toBe('ontem')
    expect(formatRelativeDay(parsed.dataBase, new Date(2026, 7, 28, 18))).toBe('hoje')
  })

  it('rejects a date that does not exist', () => {
    const impossible = [CSV_HEADER, 'Tesouro Selic;01/03/2031;31/02/2026;0,0;0,0;1;2;2'].join(
      '\n',
    )
    expect(parseTesouroPrices(impossible)).toBeNull()
  })
})

// --- Moeda estrangeira -------------------------------------------------------

describe('foreignToBrlCents', () => {
  it('converts a dollar amount into cents of real', () => {
    // US$ 96,59 at 5,2054 = R$ 502,79.
    expect(foreignToBrlCents(9659, 5.2054)).toBe(50279)
  })

  it('rounds once, at the end', () => {
    // 16,46 x 6,0205 = 99,097... -> R$ 99,10, not 99,09 from a truncated step.
    expect(foreignToBrlCents(1646, 6.0205)).toBe(9910)
  })

  it('refuses a rate that cannot be used, instead of guessing 1', () => {
    // Falling back to 1 is precisely the bug this feature exists to fix: it
    // would record dollars as reais.
    expect(foreignToBrlCents(1000, 0)).toBeNull()
    expect(foreignToBrlCents(1000, -5)).toBeNull()
    expect(foreignToBrlCents(1000, Number.NaN)).toBeNull()
    expect(foreignToBrlCents(1000, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('isSupportedCurrency', () => {
  it('accepts the dollar', () => {
    expect(isSupportedCurrency('USD')).toBe(true)
  })

  it('refuses GBp — the trap that makes the list closed', () => {
    // London quotes in PENCE, not pounds. Converting it by "the pound rate"
    // would be wrong by a factor of 100, and silently so.
    expect(isSupportedCurrency('GBp')).toBe(false)
    expect(isSupportedCurrency('GBP')).toBe(false)
    expect(isSupportedCurrency('EUR')).toBe(false)
    expect(isSupportedCurrency('ZAc')).toBe(false)
  })

  it('does not treat the real as a foreign currency', () => {
    // BRL needs no conversion, so it is not on the list of what can be converted.
    expect(isSupportedCurrency('BRL')).toBe(false)
  })
})

describe('brlQuoteToCents — moeda estrangeira', () => {
  const rates = new Map([['USD', 5.2054]])

  it('passa um preço em reais direto', () => {
    expect(brlQuoteToCents({ price: 42.72, currency: 'BRL' }, rates)).toBe(4272)
  })

  it('converte dólar com a taxa em mãos', () => {
    // IVV a US$ 773,00 x 5,2054 = R$ 4.023,77 -> 402377,42 centavos.
    const cents = brlQuoteToCents({ price: 773.0, currency: 'USD' }, rates)!
    expect(Math.round(cents)).toBe(402377)
  })

  it('preserva fração de centavo, que arredondar antes destruiria', () => {
    // Uma cotação pode ser mais fina que um centavo (ADR-007).
    const cents = brlQuoteToCents({ price: 0.00001, currency: 'USD' }, rates)
    expect(cents).toBeGreaterThan(0)
    expect(cents).toBeLessThan(1)
  })

  it('recusa GBp mesmo com taxa de libra disponível', () => {
    // Pence, não libras: converter pela taxa da libra erraria por 100x.
    const withPound = new Map([['USD', 5.2054], ['GBP', 6.9]])
    expect(brlQuoteToCents({ price: 250, currency: 'GBp' }, withPound)).toBeNull()
  })

  it('recusa quando não há taxa para a moeda', () => {
    // O dólar não voltou na rodada: melhor manter a cotação anterior do que
    // gravar um número em dólar numa coluna que significa real.
    expect(brlQuoteToCents({ price: 773.0, currency: 'USD' }, new Map())).toBeNull()
    expect(brlQuoteToCents({ price: 773.0, currency: 'USD' })).toBeNull()
  })

  it('recusa uma taxa inutilizável', () => {
    expect(brlQuoteToCents({ price: 773.0, currency: 'USD' }, new Map([['USD', 0]]))).toBeNull()
  })
})
