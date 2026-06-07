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
