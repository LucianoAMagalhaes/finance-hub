// Server Actions for the portfolio screen.
//
// "use server" marks every export here as a function that always runs on the
// server, even when a Client Component calls it. Same security pattern as the
// rest of the app: every mutation is scoped to the local user, and updates and
// deletes go through updateMany/deleteMany filtered by userId, so a forged id
// simply matches zero rows instead of touching someone else's data.
//
// Deliberately NOT done here (see ADR-008): buying an asset does not create a
// Transaction and does not touch a BankAccount. Investments are a separate
// module — if the user wants the contribution to show up in the household
// budget, they log the expense in the "Liberdade Financeira" jar by hand.

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { assetAnswersSchema, manualScoreSchema } from '@/lib/scoring-schema'
import { scoreScopeFor } from '@/lib/scoring'
import { fetchYahooQuotes, fetchYahooCloseOn, isYahooError, YahooError } from '@/lib/yahoo'
import { fetchTesouroPriceFile, isTesouroError, TesouroError } from '@/lib/tesouro'
import {
  brlQuoteToCents,
  isSupportedCurrency,
  parseTesouroPrices,
  quoteProviderFor,
  summarizeQuoteRun,
  tesouroPriceKey,
  yahooSymbolFor,
  type QuoteOutcome,
  type QuoteProvider,
} from '@/lib/quotes'
import {
  assetSchema,
  purchaseEditSchema,
  purchaseSchema,
  quoteSchema,
} from '@/lib/asset-schema'
import { treasuryTicker } from '@/lib/treasury'
import { FX_SYMBOLS } from '@/lib/constants'
import type { AssetType, TreasuryKind, PurchaseCurrency } from '@/lib/constants'

// Shared result shape used by all the actions (same as the other features).
export type ActionResult = { ok: true } | { ok: false; error: string }

// Pulls the first Zod message out of a failed parse for the UI.
function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Dados inválidos'
}

// True when `error` is a Prisma known error with the given code (e.g. 'P2002'
// for a unique-constraint violation). We duck-type on `.code` instead of using
// `instanceof PrismaClientKnownRequestError`, which can fail when more than one
// copy of @prisma/client is loaded (module-boundary fragility).
function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  )
}

// Dates are stored at UTC midnight so the day shown never shifts with the
// server's timezone (same rule as the transactions module).
function toUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

// The money that actually moved is an INTEGER of cents (ADR-005), derived here
// and only here — no form ever sends a total that could disagree with the
// quantity and the price shown next to it.
function purchaseTotalCents(
  quantity: number,
  unitPriceCents: number,
  fxRate = 1,
): number {
  // ONE rounding, at the very end. Converting the unit price first and
  // multiplying after would round twice, and the cents would drift away from
  // what the broker's statement says.
  return Math.round(quantity * unitPriceCents * fxRate)
}

/**
 * How many reais one unit of the purchase's currency was worth on its date.
 *
 * Reais are the base, so they cost nothing: rate 1, no network call. A foreign
 * purchase is converted at the rate of the day it HAPPENED, not today's — which
 * is what makes the return shown in reais include the currency's own movement,
 * and is how a cost basis is computed for tax here (ADR-013).
 *
 * Throws rather than falling back to 1: recording a dollar amount as if it were
 * reais is the exact bug this whole feature exists to fix, so failing loudly is
 * the only safe outcome.
 *
 * @param currency - The currency the price was typed in.
 * @param date - The purchase date, as "YYYY-MM-DD".
 */
async function fxRateForPurchase(
  currency: PurchaseCurrency,
  date: string,
): Promise<number> {
  if (currency === 'BRL') return 1

  const rate = await fetchYahooCloseOn(FX_SYMBOLS[currency], toUtcMidnight(date))
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    throw new YahooError(
      `Não foi encontrada a cotação do ${currency} para ${date}. Tente outra data ou registre o valor em reais.`,
    )
  }
  return rate
}

// What identifies an asset row, in the shape the database stores it.
//
// The two kinds of asset are named differently and this is the ONE place that
// knows how: a market asset carries the ticker the user typed, while a Tesouro
// bond carries its (kind, maturity) pair and gets its `ticker` GENERATED from
// them. Deriving the name in a single function is what keeps it impossible for
// a row to say "Tesouro IPCA+ 2035" while pointing at a 2040 maturity.
type AssetIdentity = {
  ticker: string
  treasuryKind: TreasuryKind | null
  maturityDate: Date | null
}

// Either branch of the parsed asset/purchase union — the fields that name the
// asset, ignoring whatever else came along (quote, quantity, price).
type ParsedIdentity =
  | { type: 'fixed_income'; treasuryKind: TreasuryKind; maturityDate: string }
  | { type: Exclude<AssetType, 'fixed_income'>; ticker: string }

function assetIdentityFrom(parsed: ParsedIdentity): AssetIdentity {
  if (parsed.type === 'fixed_income') {
    const maturityDate = toUtcMidnight(parsed.maturityDate)
    return {
      ticker: treasuryTicker(parsed.treasuryKind, maturityDate),
      treasuryKind: parsed.treasuryKind,
      maturityDate,
    }
  }

  // Nulls are not decoration: they CLEAR the treasury columns when an asset is
  // edited from fixed income into something else, so a stale maturity can never
  // outlive the bond it belonged to.
  return { ticker: parsed.ticker, treasuryKind: null, maturityDate: null }
}

/**
 * Records a purchase, creating the asset the first time that ticker appears.
 *
 * This is the only way an asset gets into the portfolio: the user always
 * registers a BUY (ticker, class, quantity, unit price, date). Buying PETR4
 * again does NOT fail on the unique (userId, ticker) index any more — it finds
 * the existing line and just adds another operation, which is what makes the
 * average price move and the drill-down grow.
 *
 * Asset + operation go in a single prisma.$transaction: a portfolio line with
 * no operation would show an empty position, so they are all-or-nothing.
 *
 * The class of an asset that already exists is left ALONE — it belongs to the
 * ticker, not to this purchase. To fix a wrong class, edit (or delete) the
 * asset itself.
 *
 * @param input - Raw object from the purchase form (re-validated here).
 */
export async function recordPurchase(input: unknown): Promise<ActionResult> {
  const parsed = purchaseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const { type, quantity, unitPriceCents, date } = parsed.data
  const identity = assetIdentityFrom(parsed.data)
  // Tesouro bonds are always in reais; only a market purchase carries a currency.
  const currency = parsed.data.type === 'fixed_income' ? 'BRL' : parsed.data.currency

  try {
    const user = await getLocalUser()

    // The SERVER looks the rate up, even though the form previewed one: the same
    // rule that makes the server derive the total instead of trusting a number
    // the browser computed. Throws when the rate cannot be had, which aborts the
    // purchase — better than recording dollars as reais.
    const fxRate = await fxRateForPurchase(currency, date)

    const totalCents = purchaseTotalCents(quantity, unitPriceCents, fxRate)
    if (totalCents <= 0) {
      return { ok: false, error: 'O total da compra ficou em R$ 0,00.' }
    }

    await prisma.$transaction(async (tx) => {
      // Reuse the line when this ticker is already in the portfolio.
      const existing = await tx.asset.findFirst({
        where: { userId: user.id, ticker: identity.ticker },
        select: { id: true },
      })

      const asset =
        existing ??
        (await tx.asset.create({
          data: { userId: user.id, type, ...identity },
          select: { id: true },
        }))

      await tx.assetOperation.create({
        data: {
          userId: user.id,
          assetId: asset.id,
          type: 'buy',
          quantity,
          totalCents,
          date: toUtcMidnight(date),
        },
      })
    })

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    // A YahooError here means the exchange rate could not be looked up, and it
    // already carries a finished sentence saying so.
    if (isYahooError(error)) return { ok: false, error: error.message }
    console.error('recordPurchase failed:', error)
    return { ok: false, error: 'Não foi possível registrar a compra.' }
  }
}

/**
 * The exchange rate of one day, for the purchase form to preview with.
 *
 * Exists ONLY so the user can see what a dollar purchase will become in reais
 * before saving it. It is not what the save uses — recordPurchase looks the rate
 * up again on the server, so a stale or tampered preview cannot change what gets
 * stored.
 *
 * @param currency - The currency to price.
 * @param date - The day wanted, as "YYYY-MM-DD".
 */
export async function lookupFxRate(
  currency: string,
  date: string,
): Promise<{ ok: true; rate: number } | { ok: false; error: string }> {
  if (!isSupportedCurrency(currency)) {
    return { ok: false, error: 'Moeda não suportada.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Data inválida.' }
  }

  try {
    return { ok: true, rate: await fxRateForPurchase(currency, date) }
  } catch (error) {
    if (isYahooError(error)) return { ok: false, error: error.message }
    console.error('lookupFxRate failed:', error)
    return { ok: false, error: 'Não foi possível buscar o câmbio.' }
  }
}

/**
 * Decides the new `priceUpdatedAt` for a quote write.
 *
 * The stamp only moves when the quote actually changed, so renaming or
 * reclassifying an asset doesn't make a week-old price look fresh (which is
 * what the "stale quote" warning in the table reads).
 */
function nextPriceStamp(
  previous: { currentPriceCents: unknown; priceUpdatedAt: Date | null },
  nextPriceCents: number | null,
): Date | null {
  if (nextPriceCents === null) return null

  const previousPrice =
    previous.currentPriceCents === null ? null : Number(previous.currentPriceCents)

  return previousPrice === nextPriceCents ? previous.priceUpdatedAt : new Date()
}

/**
 * Updates an asset's identity (ticker, class) and its hand-typed quote.
 *
 * @param id - Asset id (validated against the local user).
 * @param input - Raw object from the asset form.
 */
export async function updateAsset(id: string, input: unknown): Promise<ActionResult> {
  const parsed = assetSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()

    // Read the current quote first, so the stamp only moves on a real change.
    const current = await prisma.asset.findFirst({
      where: { id, userId: user.id },
      select: { currentPriceCents: true, priceUpdatedAt: true },
    })
    if (!current) return { ok: false, error: 'Ativo não encontrado.' }

    // The identity columns are written EXPLICITLY rather than spread, so that
    // changing an asset's type also clears the columns the old type used.
    const identity = assetIdentityFrom(parsed.data)

    const result = await prisma.asset.updateMany({
      where: { id, userId: user.id },
      data: {
        type: parsed.data.type,
        ...identity,
        currentPriceCents: parsed.data.currentPriceCents,
        priceUpdatedAt: nextPriceStamp(current, parsed.data.currentPriceCents),
      },
    })

    if (result.count === 0) return { ok: false, error: 'Ativo não encontrado.' }

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      return { ok: false, error: 'Você já tem esse ativo na carteira.' }
    }
    console.error('updateAsset failed:', error)
    return { ok: false, error: 'Não foi possível salvar o ativo.' }
  }
}

/**
 * Updates ONLY the hand-typed quote — what the editable cell in the portfolio
 * table calls. Separate from updateAsset so the everyday gesture (typing this
 * week's price) doesn't have to resend the ticker and the class.
 *
 * @param id - Asset id (validated against the local user).
 * @param input - `{ currentPriceCents }`, in cents (may be fractional).
 */
export async function updateAssetQuote(id: string, input: unknown): Promise<ActionResult> {
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()

    const current = await prisma.asset.findFirst({
      where: { id, userId: user.id },
      select: { currentPriceCents: true, priceUpdatedAt: true },
    })
    if (!current) return { ok: false, error: 'Ativo não encontrado.' }

    await prisma.asset.updateMany({
      where: { id, userId: user.id },
      data: {
        currentPriceCents: parsed.data.currentPriceCents,
        priceUpdatedAt: nextPriceStamp(current, parsed.data.currentPriceCents),
      },
    })

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    console.error('updateAssetQuote failed:', error)
    return { ok: false, error: 'Não foi possível salvar a cotação.' }
  }
}

/**
 * Edits one purchase: its quantity, its unit price and its date.
 *
 * The ticker and the type are NOT here — they belong to the asset, not to this
 * operation. Changing any of these three moves the position's average price,
 * which is recomputed from scratch on the next render (nothing is stored).
 *
 * @param id - Operation id (validated against the local user).
 * @param input - Raw object from the purchase edit form.
 */
export async function updatePurchase(id: string, input: unknown): Promise<ActionResult> {
  const parsed = purchaseEditSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  const { quantity, unitPriceCents, date } = parsed.data
  const totalCents = purchaseTotalCents(quantity, unitPriceCents)
  if (totalCents <= 0) {
    return { ok: false, error: 'O total da compra ficou em R$ 0,00.' }
  }

  try {
    const user = await getLocalUser()

    const result = await prisma.assetOperation.updateMany({
      where: { id, userId: user.id },
      data: { quantity, totalCents, date: toUtcMidnight(date) },
    })
    if (result.count === 0) return { ok: false, error: 'Compra não encontrada.' }

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    console.error('updatePurchase failed:', error)
    return { ok: false, error: 'Não foi possível salvar a compra.' }
  }
}

/**
 * Deletes one purchase from a ticker's history.
 *
 * When it was the LAST operation of that asset, the asset goes too: a portfolio
 * line with no history has no position to show and no way to get one back —
 * exactly the state recordPurchase refuses to create. The UI says so before
 * calling this.
 *
 * @param id - Operation id (validated against the local user).
 */
export async function deletePurchase(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()

    const removedAsset = await prisma.$transaction(async (tx) => {
      // Scoped by userId: a forged id simply finds nothing.
      const operation = await tx.assetOperation.findFirst({
        where: { id, userId: user.id },
        select: { assetId: true },
      })
      if (!operation) return null

      await tx.assetOperation.delete({ where: { id } })

      const remaining = await tx.assetOperation.count({
        where: { assetId: operation.assetId },
      })
      if (remaining === 0) {
        await tx.asset.deleteMany({ where: { id: operation.assetId, userId: user.id } })
        return true
      }
      return false
    })

    if (removedAsset === null) return { ok: false, error: 'Compra não encontrada.' }

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    console.error('deletePurchase failed:', error)
    return { ok: false, error: 'Não foi possível excluir a compra.' }
  }
}

/**
 * Deletes an asset and, by cascade, its whole operation history.
 *
 * @param id - Asset id (validated against the local user).
 */
export async function deleteAsset(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()

    // The FK is ON DELETE CASCADE, so the operations go with it — the UI warns
    // about that before calling this.
    const result = await prisma.asset.deleteMany({ where: { id, userId: user.id } })
    if (result.count === 0) return { ok: false, error: 'Ativo não encontrado.' }

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    console.error('deleteAsset failed:', error)
    return { ok: false, error: 'Não foi possível excluir o ativo.' }
  }
}

// --- Scoring --------------------------------------------------------------
// The user grades each asset so the aporte planner knows which ones deserve the
// next money (see lib/scoring.ts and ADR-009). Stocks and FIIs answer the
// checklist; crypto and fixed income carry a hand-typed score instead.

/**
 * Saves an asset's checklist answers, replacing whatever was there.
 *
 * Wipe-and-rewrite instead of a per-answer diff: the modal always submits the
 * complete sheet, so this is one round trip and it also handles CLEARING a
 * question (the answer simply is not in the array any more) without a special
 * case for it.
 *
 * @param assetId - The asset being graded (ownership is checked below).
 * @param input - Raw array of { questionId, value } from the modal.
 */
export async function setAssetAnswers(
  assetId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = assetAnswersSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, userId: user.id },
      select: { id: true, type: true },
    })
    if (!asset) return { ok: false, error: 'Ativo não encontrado.' }

    const scope = scoreScopeFor(asset.type)
    if (scope === null) {
      return {
        ok: false,
        error: 'Este tipo de ativo não usa checklist — a nota é digitada à mão.',
      }
    }

    // Only questions of THIS asset's checklist, and only the user's own: a
    // forged questionId would otherwise let an answer point anywhere.
    const valid = await prisma.scoreQuestion.findMany({
      where: {
        userId: user.id,
        scope,
        id: { in: parsed.data.map((answer) => answer.questionId) },
      },
      select: { id: true },
    })
    const validIds = new Set(valid.map((question) => question.id))
    const rows = parsed.data.filter((answer) => validIds.has(answer.questionId))

    await prisma.$transaction(async (tx) => {
      await tx.scoreAnswer.deleteMany({ where: { assetId: asset.id, userId: user.id } })
      if (rows.length > 0) {
        await tx.scoreAnswer.createMany({
          data: rows.map((answer) => ({
            userId: user.id,
            assetId: asset.id,
            questionId: answer.questionId,
            value: answer.value,
          })),
        })
      }
    })

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    console.error('setAssetAnswers failed:', error)
    return { ok: false, error: 'Não foi possível salvar a avaliação.' }
  }
}

/**
 * Sets the hand-typed score of a crypto / fixed-income asset. Null clears it
 * back to "not graded", which is what keeps it out of the aporte suggestion.
 *
 * @param assetId - The asset (ownership is enforced in the where clause).
 * @param input - Raw { manualScore } from the modal, -10..10 or null.
 */
export async function setAssetManualScore(
  assetId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = manualScoreSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) }

  try {
    const user = await getLocalUser()

    const result = await prisma.asset.updateMany({
      where: { id: assetId, userId: user.id },
      data: { manualScore: parsed.data.manualScore },
    })
    if (result.count === 0) return { ok: false, error: 'Ativo não encontrado.' }

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    console.error('setAssetManualScore failed:', error)
    return { ok: false, error: 'Não foi possível salvar a nota.' }
  }
}

/**
 * Result of a quote refresh. Richer than ActionResult on purpose: the button
 * has to report what happened ticker by ticker, not just "deu certo".
 */
export type RefreshQuotesResult =
  | { ok: true; summary: string; updated: number }
  | { ok: false; error: string }

// One asset as the quote refresh needs to see it.
type QuotableAsset = {
  id: string
  ticker: string
  type: AssetType
  currentPriceCents: unknown
  treasuryKind: TreasuryKind | null
  maturityDate: Date | null
}

// A price a provider actually returned, with the moment it refers to.
//
// `asOf` travels with the price because the two providers speak about different
// moments: Yahoo answers with the market as it is right now, while the Tesouro
// file carries the MORNING price of the last business day. Stamping both with
// "now" would make a Friday price claim to be from Sunday, and the "há 3 dias"
// label and the stale-quote warning both read that column.
type ResolvedPrice = { priceCents: number; asOf: Date }

/**
 * Prices the assets Yahoo covers. Rejects with YahooError if the run as a whole
 * cannot proceed; a single symbol Yahoo cannot price is simply left out of the
 * result, which the caller reports as "sem retorno".
 */
async function resolveYahooPrices(
  assets: QuotableAsset[],
): Promise<Map<string, ResolvedPrice>> {
  // The bare ticker is what the user typed and what the table shows; Yahoo
  // addresses the same asset with an exchange suffix. The mapping lives in
  // lib/quotes, so this action never concatenates a symbol.
  const symbols = new Map(
    assets.map((asset) => [asset.id, yahooSymbolFor(asset.ticker, asset.type)!]),
  )
  const quotes = await fetchYahooQuotes(Array.from(symbols.values()))
  const asOf = new Date()

  const prices = new Map<string, ResolvedPrice>()
  for (const asset of assets) {
    // brlQuoteToCents also REFUSES a quote that came back in another currency,
    // which is what keeps a dollar price out of a column that means reais.
    const priceCents = brlQuoteToCents(quotes.get(symbols.get(asset.id)!) ?? null)
    if (priceCents !== null) prices.set(asset.id, { priceCents, asOf })
  }
  return prices
}

/**
 * Prices the Tesouro bonds from the daily file — ONE request for all of them.
 *
 * A bond whose (kind, maturity) columns are still empty gets no price and is
 * reported as "sem retorno": without that pair there is nothing to look up.
 */
async function resolveTesouroPrices(
  assets: QuotableAsset[],
): Promise<Map<string, ResolvedPrice>> {
  const parsed = parseTesouroPrices(await fetchTesouroPriceFile())

  // The file arrived but held no row this app could read — a provider problem,
  // not a per-bond one, so it is reported like any other provider failure.
  if (parsed === null) {
    throw new TesouroError(
      'O arquivo de preços do Tesouro Direto veio num formato inesperado.',
    )
  }

  const prices = new Map<string, ResolvedPrice>()
  for (const asset of assets) {
    if (asset.treasuryKind === null || asset.maturityDate === null) continue
    const priceCents = parsed.prices.get(
      tesouroPriceKey(asset.treasuryKind, asset.maturityDate),
    )
    // The price is stamped with the file's own date, not with "now".
    if (priceCents !== undefined) {
      prices.set(asset.id, { priceCents, asOf: parsed.dataBase })
    }
  }
  return prices
}

/**
 * Fetches the current price of every automatically-quotable asset and stores it.
 *
 * Only the types that have a provider are touched (lib/quotes.quoteProviderFor):
 * today that is everything trading on the B3 — shares, FIIs, Brazilian ETFs and
 * BDRs — through Yahoo Finance. Crypto, Tesouro and shares bought abroad are
 * left exactly as they are, because they do not trade in reais and this column
 * has no currency beside it (ADR-010); their quote stays hand-typed in the
 * table cell.
 *
 * Three rules worth remembering:
 *   1. A ticker the provider could not price KEEPS its stored quote. Erasing it
 *      would make the portfolio read as worth less than it is.
 *   2. A price that came back identical is NOT written, so `priceUpdatedAt`
 *      keeps meaning "this price is from then" — the same rule nextPriceStamp
 *      applies to the hand-typed cell.
 *   3. All the writes go in one prisma.$transaction: a refresh either lands or
 *      it doesn't, so the table never shows half a run.
 */
export async function refreshQuotes(): Promise<RefreshQuotesResult> {
  try {
    const user = await getLocalUser()

    const assets = await prisma.asset.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        ticker: true,
        type: true,
        currentPriceCents: true,
        treasuryKind: true,
        maturityDate: true,
      },
    })

    const quotable = assets.filter((asset) => quoteProviderFor(asset.type) !== null)
    if (quotable.length === 0) {
      return { ok: true, summary: summarizeQuoteRun([]), updated: 0 }
    }

    // One job per provider that actually has something to price — a portfolio
    // with no bonds never touches the Tesouro's server, and vice versa.
    const jobs: { provider: QuoteProvider; run: () => Promise<Map<string, ResolvedPrice>> }[] =
      []
    for (const provider of ['yahoo', 'tesouro'] as const) {
      const mine = quotable.filter((asset) => quoteProviderFor(asset.type) === provider)
      if (mine.length === 0) continue
      jobs.push({
        provider,
        run: () =>
          provider === 'yahoo' ? resolveYahooPrices(mine) : resolveTesouroPrices(mine),
      })
    }

    // allSettled, not all: the two providers are independent, and one of them
    // being down is no reason to throw away the prices the other just returned.
    const settled = await Promise.allSettled(jobs.map((job) => job.run()))

    const resolved = new Map<string, ResolvedPrice>()
    const failedProviders: QuoteProvider[] = []
    const failures: unknown[] = []

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        result.value.forEach((price, assetId) => resolved.set(assetId, price))
        return
      }
      failedProviders.push(jobs[index].provider)
      failures.push(result.reason)
      // A provider error carries a finished sentence; anything else is a bug.
      if (!isYahooError(result.reason) && !isTesouroError(result.reason)) {
        console.error('refreshQuotes provider failed:', result.reason)
      }
    })

    // Every provider failed, so there is nothing to save and nothing partial to
    // report. Fall back to the old behaviour and show the provider's own
    // sentence, which says WHY ("limite temporário", "a conexão demorou demais")
    // instead of the bare "indisponível" a partial run has room for.
    if (failedProviders.length === jobs.length) {
      const reason = failures[0]
      if (isYahooError(reason) || isTesouroError(reason)) {
        return { ok: false, error: reason.message }
      }
      return { ok: false, error: 'Não foi possível atualizar as cotações.' }
    }

    const outcomes: QuoteOutcome[] = []
    const writes = []

    for (const asset of quotable) {
      const price = resolved.get(asset.id)

      // Nothing usable came back for this one: keep what is stored, report it.
      if (price === undefined) {
        outcomes.push({ ticker: asset.ticker, status: 'missing' })
        continue
      }

      const { priceCents, asOf } = price

      // The API's answer goes through the SAME schema as a hand-typed quote —
      // there is one definition of a valid price, and this is it.
      const parsed = quoteSchema.safeParse({ currentPriceCents: priceCents })
      if (!parsed.success) {
        outcomes.push({ ticker: asset.ticker, status: 'missing' })
        continue
      }

      // Prisma hands Decimal columns back as Decimal.js objects; Number() at the
      // boundary, exactly like the portfolio page does.
      const stored =
        asset.currentPriceCents === null ? null : Number(asset.currentPriceCents)

      if (stored === priceCents) {
        outcomes.push({ ticker: asset.ticker, status: 'unchanged' })
        continue
      }

      writes.push(
        prisma.asset.updateMany({
          where: { id: asset.id, userId: user.id },
          data: { currentPriceCents: priceCents, priceUpdatedAt: asOf },
        }),
      )
      outcomes.push({ ticker: asset.ticker, status: 'updated', priceCents })
    }

    if (writes.length > 0) await prisma.$transaction(writes)

    revalidatePath('/investments/portfolio')
    // The contribution planner measures each gap against the current price, so
    // it is stale the moment the quotes move.
    revalidatePath('/investments/contributions')

    return {
      ok: true,
      summary: summarizeQuoteRun(outcomes, failedProviders),
      updated: writes.length,
    }
  } catch (error) {
    // A provider error already carries a finished sentence for the user
    // (connection failed, limit hit); anything else is a bug and stays in the
    // log. Reaching here now means something outside the providers broke — the
    // providers themselves are handled by allSettled above.
    if (isYahooError(error) || isTesouroError(error)) {
      return { ok: false, error: error.message }
    }
    console.error('refreshQuotes failed:', error)
    return { ok: false, error: 'Não foi possível atualizar as cotações.' }
  }
}
