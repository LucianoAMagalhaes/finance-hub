// Server Actions for transactions.
//
// What is a Server Action? The "use server" directive below marks every export
// in this file as a function that ALWAYS runs on the server, even when called
// from a Client Component in the browser. Next.js handles the network round-trip
// for us: the browser calls `createTransaction(data)` like a normal function,
// but the body executes on the server (where it can safely use Prisma).
//
// This replaces hand-writing a REST API route for simple form submissions.

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import {
  transactionInputSchema,
  type TransactionParsed,
} from '@/lib/transaction-schema'

// The shape returned to the client so the form can show success or errors.
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Maps validated form data to the columns shared by create and update.
 * Centralizing this means create and update can never drift apart.
 */
function toTransactionData(data: TransactionParsed) {
  return {
    description: data.description,
    amount: data.amount, // already integer cents
    // Store the picked day as UTC midnight so it never shifts time zone.
    date: new Date(`${data.date}T00:00:00.000Z`),
    type: data.type,
    paymentMethod: data.paymentMethod,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId,
    tagId: data.tagId,
    notes: data.notes,
  }
}

/**
 * Creates a transaction for the local user.
 *
 * @param input - Raw object from the form. We re-validate it here with the
 *   shared Zod schema: never trust data coming from the browser.
 */
export async function createTransaction(input: unknown): Promise<ActionResult> {
  // 1) Validate. safeParse never throws — it returns success/error so we can
  //    turn a bad payload into a friendly message instead of a crash.
  const parsed = transactionInputSchema.safeParse(input)
  if (!parsed.success) {
    // Surface the first validation message.
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Dados inválidos' }
  }

  try {
    const user = await getLocalUser()

    await prisma.transaction.create({
      data: { userId: user.id, ...toTransactionData(parsed.data) },
    })

    // Tell Next.js the data behind /transactions changed, so the Server
    // Component list re-renders with the new row on the next paint.
    revalidatePath('/transactions')
    return { ok: true }
  } catch (error) {
    // Explicit error handling is required by our conventions (CLAUDE.md).
    console.error('createTransaction failed:', error)
    return { ok: false, error: 'Não foi possível salvar a transação.' }
  }
}

/**
 * Updates an existing transaction owned by the local user.
 *
 * @param id - The transaction id to update.
 * @param input - Raw object from the edit form (re-validated here).
 */
export async function updateTransaction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = transactionInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Dados inválidos' }
  }

  try {
    const user = await getLocalUser()

    // updateMany with `userId` in the filter is a security boundary: a forged
    // id belonging to another user simply matches zero rows instead of editing
    // someone else's data. It also returns a count so we can detect "not found".
    const result = await prisma.transaction.updateMany({
      where: { id, userId: user.id },
      data: toTransactionData(parsed.data),
    })

    if (result.count === 0) {
      return { ok: false, error: 'Transação não encontrada.' }
    }

    revalidatePath('/transactions')
    return { ok: true }
  } catch (error) {
    console.error('updateTransaction failed:', error)
    return { ok: false, error: 'Não foi possível atualizar a transação.' }
  }
}

/**
 * Deletes a transaction owned by the local user.
 *
 * @param id - The transaction id to delete.
 */
export async function deleteTransaction(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()

    // Same ownership-scoped pattern as update: deleteMany filtered by userId
    // can never remove another user's row.
    const result = await prisma.transaction.deleteMany({
      where: { id, userId: user.id },
    })

    if (result.count === 0) {
      return { ok: false, error: 'Transação não encontrada.' }
    }

    revalidatePath('/transactions')
    return { ok: true }
  } catch (error) {
    console.error('deleteTransaction failed:', error)
    return { ok: false, error: 'Não foi possível excluir a transação.' }
  }
}
