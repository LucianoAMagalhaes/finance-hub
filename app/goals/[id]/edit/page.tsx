// Edit goal page — route "/goals/[id]/edit".
//
// The [id] folder makes this a DYNAMIC ROUTE in the App Router: any path like
// /goals/abc123/edit matches and the value arrives as `params.id`. One page
// serves any goal instead of one route per row.
//
// Like the list page, this is a Server Component: it queries Prisma directly,
// then hands plain serializable data to the (Client) GoalForm in edit mode.

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { GoalForm, type EditingGoal } from '../../goal-form'

// Always render fresh data: the goal may have changed since the list loaded.
export const dynamic = 'force-dynamic'

export default async function EditGoalPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getLocalUser()

  // Scope by userId as well as id: another user's id simply yields null, which
  // we turn into a 404 below — never a leak or an accidental edit.
  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      name: true,
      targetAmount: true,
      currentAmount: true,
      deadline: true,
    },
  })

  if (!goal) {
    notFound()
  }

  const editing: EditingGoal = {
    id: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    // Reduce the stored UTC-midnight date to the YYYY-MM-DD the date input wants.
    deadline: goal.deadline.toISOString().slice(0, 10),
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Editar meta</h1>
        <p className="text-sm text-gray-400">
          Altere os campos e salve, ou cancele para voltar à lista.
        </p>
      </header>

      <GoalForm editing={editing} />
    </main>
  )
}
