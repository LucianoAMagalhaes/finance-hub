// Server Actions for budgets.
//
// Like the transactions actions, "use server" makes every export here run only
// on the server. The browser calls createBudget(...) like a normal function,
// but the body executes server-side where it can safely use Prisma.

'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { budgetInputSchema } from '@/lib/budget-schema'

// Same result shape used by the transactions actions.
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Creates a budget for the local user.
 *
 * @param input - Raw object from the form, re-validated here with the shared
 *   Zod schema before touching the database.
 */
export async function createBudget(input: unknown): Promise<ActionResult> {
  const parsed = budgetInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Dados inválidos' }
  }

  const data = parsed.data

  try {
    const user = await getLocalUser()

    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: data.categoryId,
        amountLimit: data.amountLimit, // already integer cents
        month: data.month,
        year: data.year,
      },
    })

    revalidatePath('/budgets')
    return { ok: true }
  } catch (error) {
    // The schema has @@unique([userId, categoryId, month, year]). Prisma reports
    // a violation as known error code P2002 — turn it into a friendly message
    // instead of a generic failure.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        ok: false,
        error: 'Já existe um orçamento para esta categoria neste mês.',
      }
    }

    console.error('createBudget failed:', error)
    return { ok: false, error: 'Não foi possível salvar o orçamento.' }
  }
}

// A budget's identity is its category + month + year, so the only thing the user
// can change is the spending limit. We reuse the shared schema's rules for that
// single field instead of redefining them, keeping create and update in sync.
const limitSchema = budgetInputSchema.pick({ amountLimit: true })

/**
 * Updates the limit of an existing budget owned by the local user.
 *
 * @param id - The budget id to update.
 * @param input - Raw object from the edit form ({ amountLimit }), re-validated
 *   here with the shared schema's rule for that field.
 */
export async function updateBudget(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = limitSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Dados inválidos' }
  }

  try {
    const user = await getLocalUser()

    // updateMany with `userId` in the filter is a security boundary: a forged id
    // belonging to another user simply matches zero rows instead of editing
    // someone else's budget. The returned count also lets us detect "not found".
    const result = await prisma.budget.updateMany({
      where: { id, userId: user.id },
      data: { amountLimit: parsed.data.amountLimit },
    })

    if (result.count === 0) {
      return { ok: false, error: 'Orçamento não encontrado.' }
    }

    revalidatePath('/budgets')
    return { ok: true }
  } catch (error) {
    console.error('updateBudget failed:', error)
    return { ok: false, error: 'Não foi possível atualizar o orçamento.' }
  }
}

/**
 * Deletes a budget owned by the local user.
 *
 * @param id - The budget id to delete.
 */
export async function deleteBudget(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()

    // Same ownership-scoped pattern as update: deleteMany filtered by userId can
    // never remove another user's row.
    const result = await prisma.budget.deleteMany({
      where: { id, userId: user.id },
    })

    if (result.count === 0) {
      return { ok: false, error: 'Orçamento não encontrado.' }
    }

    revalidatePath('/budgets')
    return { ok: true }
  } catch (error) {
    console.error('deleteBudget failed:', error)
    return { ok: false, error: 'Não foi possível excluir o orçamento.' }
  }
}
