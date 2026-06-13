// Edit budget page — route "/budgets/[id]/edit".
//
// The folder name in square brackets, [id], makes this a DYNAMIC ROUTE in the
// Next.js App Router: any path like /budgets/abc123/edit matches, and the value
// ("abc123") arrives as `params.id`. One page serves any budget instead of one
// route per row.
//
// Like the list page, this is a Server Component: it queries Prisma directly,
// then hands plain serializable data to the (Client) BudgetForm in edit mode.

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { BudgetForm, type EditingBudget } from '../../budget-form'

// Always render fresh data: the budget may have changed since the list loaded.
export const dynamic = 'force-dynamic'

export default async function EditBudgetPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getLocalUser()

  // Scope by userId as well as id: another user's id simply yields null, which
  // we turn into a 404 below — never a leak or an accidental edit.
  const budget = await prisma.budget.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      amountLimit: true,
      month: true,
      year: true,
      category: { select: { name: true, icon: true } },
    },
  })

  // notFound() renders the nearest not-found UI and stops here. We use it for a
  // missing (or non-owned) id so the URL can't be used to probe other rows.
  if (!budget) {
    notFound()
  }

  const editing: EditingBudget = {
    id: budget.id,
    amountLimit: budget.amountLimit,
    category: budget.category,
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Editar orçamento</h1>
        <p className="text-sm text-gray-400">
          Altere o limite e salve, ou cancele para voltar à lista.
        </p>
      </header>

      {/* No category options needed in edit mode — the category is fixed. */}
      <BudgetForm
        categories={[]}
        month={budget.month}
        year={budget.year}
        editing={editing}
      />
    </main>
  )
}
