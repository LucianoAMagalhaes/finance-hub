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
import {
  assetSchema,
  purchaseEditSchema,
  purchaseSchema,
  quoteSchema,
} from '@/lib/asset-schema'

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
function purchaseTotalCents(quantity: number, unitPriceCents: number): number {
  return Math.round(quantity * unitPriceCents)
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

  const { ticker, type, quantity, unitPriceCents, date } = parsed.data

  const totalCents = purchaseTotalCents(quantity, unitPriceCents)
  if (totalCents <= 0) {
    return { ok: false, error: 'O total da compra ficou em R$ 0,00.' }
  }

  try {
    const user = await getLocalUser()

    await prisma.$transaction(async (tx) => {
      // Reuse the line when this ticker is already in the portfolio.
      const existing = await tx.asset.findFirst({
        where: { userId: user.id, ticker },
        select: { id: true },
      })

      const asset =
        existing ??
        (await tx.asset.create({
          data: { userId: user.id, ticker, type },
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
    console.error('recordPurchase failed:', error)
    return { ok: false, error: 'Não foi possível registrar a compra.' }
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

    const result = await prisma.asset.updateMany({
      where: { id, userId: user.id },
      data: {
        ...parsed.data,
        priceUpdatedAt: nextPriceStamp(current, parsed.data.currentPriceCents),
      },
    })

    if (result.count === 0) return { ok: false, error: 'Ativo não encontrado.' }

    revalidatePath('/investments/portfolio')
    return { ok: true }
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      return { ok: false, error: 'Você já tem esse ticker na carteira.' }
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
