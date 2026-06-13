// Server Actions for goals.
//
// "use server" marks every export here as a function that always runs on the
// server, even when called from a Client Component. The browser calls
// createGoal(...) like a normal function, but the body executes server-side
// where it can safely use Prisma.

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { goalInputSchema } from '@/lib/goal-schema'
import { suggestedMonthlyContribution } from '@/lib/goal'

// Same result shape used by the other actions.
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

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

  const data = parsed.data

  try {
    const user = await getLocalUser()

    // Store the deadline at UTC midnight so it never shifts time zone (same
    // convention as transaction dates).
    const deadline = new Date(`${data.deadline}T00:00:00.000Z`)

    // The monthly contribution column is required. We snapshot the suggestion at
    // creation time; the UI recomputes it live from the current state, so the
    // stored value is just a sensible initial figure.
    const monthlyContribution = suggestedMonthlyContribution(
      data.targetAmount,
      data.currentAmount,
      deadline,
      new Date(),
    )

    await prisma.goal.create({
      data: {
        userId: user.id,
        name: data.name,
        targetAmount: data.targetAmount, // already integer cents
        currentAmount: data.currentAmount,
        deadline,
        monthlyContribution,
      },
    })

    revalidatePath('/goals')
    return { ok: true }
  } catch (error) {
    console.error('createGoal failed:', error)
    return { ok: false, error: 'Não foi possível salvar a meta.' }
  }
}
