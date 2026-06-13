// Server Actions for goals.
//
// "use server" marks every export here as a function that always runs on the
// server, even when called from a Client Component. The browser calls these
// like normal functions, but the body executes server-side where it can safely
// use Prisma.

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import {
  goalInputSchema,
  contributionAmountSchema,
  type GoalParsed,
} from '@/lib/goal-schema'
import { suggestedMonthlyContribution } from '@/lib/goal'

// Same result shape used by the other actions.
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Maps validated form data to the columns shared by create and update.
 * Centralizing this means create and update can never drift apart: both store
 * the deadline at UTC midnight (so it never shifts time zone, same convention
 * as transaction dates) and re-snapshot the suggested monthly contribution.
 */
function toGoalData(data: GoalParsed) {
  const deadline = new Date(`${data.deadline}T00:00:00.000Z`)
  return {
    name: data.name,
    targetAmount: data.targetAmount, // already integer cents
    currentAmount: data.currentAmount,
    deadline,
    // The column is required; the UI recomputes the live figure from current
    // state, so this stored value is just a sensible snapshot.
    monthlyContribution: suggestedMonthlyContribution(
      data.targetAmount,
      data.currentAmount,
      deadline,
      new Date(),
    ),
  }
}

/**
 * Creates a goal for the local user.
 *
 * @param input - Raw object from the form, re-validated here with the shared
 *   Zod schema before touching the database.
 */
export async function createGoal(input: unknown): Promise<ActionResult> {
  const parsed = goalInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Dados inválidos' }
  }

  try {
    const user = await getLocalUser()

    await prisma.goal.create({
      data: { userId: user.id, ...toGoalData(parsed.data) },
    })

    revalidatePath('/goals')
    return { ok: true }
  } catch (error) {
    console.error('createGoal failed:', error)
    return { ok: false, error: 'Não foi possível salvar a meta.' }
  }
}

/**
 * Updates an existing goal owned by the local user.
 *
 * @param id - The goal id to update.
 * @param input - Raw object from the edit form (re-validated here).
 */
export async function updateGoal(id: string, input: unknown): Promise<ActionResult> {
  const parsed = goalInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Dados inválidos' }
  }

  try {
    const user = await getLocalUser()

    // updateMany with `userId` in the filter is a security boundary: a forged id
    // belonging to another user simply matches zero rows instead of editing
    // someone else's goal. The returned count also lets us detect "not found".
    const result = await prisma.goal.updateMany({
      where: { id, userId: user.id },
      data: toGoalData(parsed.data),
    })

    if (result.count === 0) {
      return { ok: false, error: 'Meta não encontrada.' }
    }

    revalidatePath('/goals')
    return { ok: true }
  } catch (error) {
    console.error('updateGoal failed:', error)
    return { ok: false, error: 'Não foi possível atualizar a meta.' }
  }
}

/**
 * Deletes a goal owned by the local user.
 *
 * @param id - The goal id to delete.
 */
export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    const user = await getLocalUser()

    // Same ownership-scoped pattern as update: deleteMany filtered by userId can
    // never remove another user's row.
    const result = await prisma.goal.deleteMany({
      where: { id, userId: user.id },
    })

    if (result.count === 0) {
      return { ok: false, error: 'Meta não encontrada.' }
    }

    revalidatePath('/goals')
    return { ok: true }
  } catch (error) {
    console.error('deleteGoal failed:', error)
    return { ok: false, error: 'Não foi possível excluir a meta.' }
  }
}

/**
 * Registers a contribution by adding `amount` cents to a goal's saved amount.
 * The result is capped at the target so the saved amount never exceeds it —
 * an over-contribution simply completes the goal.
 *
 * @param id - The goal id to contribute to.
 * @param amount - Contribution in integer cents (must be positive).
 */
export async function addContribution(
  id: string,
  amount: unknown,
): Promise<ActionResult> {
  const parsed = contributionAmountSchema.safeParse(amount)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? 'Valor inválido' }
  }

  try {
    const user = await getLocalUser()

    // Read the current state first (scoped to the owner) so we can cap the new
    // amount at the target. findFirst with userId means another user's id yields
    // null → "not found", never a cross-user read.
    const goal = await prisma.goal.findFirst({
      where: { id, userId: user.id },
      select: { currentAmount: true, targetAmount: true },
    })

    if (!goal) {
      return { ok: false, error: 'Meta não encontrada.' }
    }

    const newCurrent = Math.min(goal.targetAmount, goal.currentAmount + parsed.data)

    await prisma.goal.updateMany({
      where: { id, userId: user.id },
      data: { currentAmount: newCurrent },
    })

    revalidatePath('/goals')
    return { ok: true }
  } catch (error) {
    console.error('addContribution failed:', error)
    return { ok: false, error: 'Não foi possível registrar o aporte.' }
  }
}
