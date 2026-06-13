// Edit transaction page — route "/transactions/[id]/edit".
//
// The folder name in square brackets, [id], makes this a DYNAMIC ROUTE in the
// Next.js App Router: any path like /transactions/abc123/edit matches, and the
// value ("abc123") arrives as `params.id`. This is how we reuse one page for any
// transaction instead of writing a route per row.
//
// Like the list page, this is a Server Component: it queries Prisma directly,
// then hands plain serializable data to the (Client) TransactionForm in edit
// mode. Credentials never reach the browser.

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import {
  TransactionForm,
  type EditingTransaction,
} from '../../transaction-form'

// Always render fresh data: the row may have changed since the list was loaded.
export const dynamic = 'force-dynamic'

export default async function EditTransactionPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getLocalUser()

  // Fetch the transaction together with the dropdown options the form needs.
  const [transaction, categories, subcategories, tags] = await Promise.all([
    // Scope by userId as well as id: another user's id simply yields null,
    // which we turn into a 404 below — never a leak or an accidental edit.
    prisma.transaction.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        type: true,
        paymentMethod: true,
        categoryId: true,
        subcategoryId: true,
        tagId: true,
        notes: true,
      },
    }),
    prisma.category.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, icon: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subcategory.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, icon: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.tag.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // notFound() renders the nearest not-found UI and stops here. We use it for a
  // missing (or non-owned) id so the URL can't be used to probe other rows.
  if (!transaction) {
    notFound()
  }

  // Reshape DB data into the form's serializable EditingTransaction:
  //  - amount stays in integer cents (the form formats it for display);
  //  - the date is reduced to YYYY-MM-DD (stored at UTC midnight, so slicing
  //    the ISO string gives the exact day the user picked).
  const editing: EditingTransaction = {
    id: transaction.id,
    description: transaction.description,
    amount: transaction.amount,
    date: transaction.date.toISOString().slice(0, 10),
    type: transaction.type,
    paymentMethod: transaction.paymentMethod,
    categoryId: transaction.categoryId,
    subcategoryId: transaction.subcategoryId,
    tagId: transaction.tagId,
    notes: transaction.notes,
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Editar transação</h1>
        <p className="text-sm text-gray-400">
          Altere os campos e salve, ou cancele para voltar à lista.
        </p>
      </header>

      <TransactionForm
        categories={categories}
        subcategories={subcategories}
        tags={tags}
        editing={editing}
      />
    </main>
  )
}
