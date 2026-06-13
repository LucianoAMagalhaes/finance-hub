// Per-row actions (edit link + delete button).
//
// "use client": deletion needs interactivity — a confirmation prompt, a pending
// state, and an error message — which only a Client Component can provide. The
// list itself stays a Server Component; we drop this small island into each row.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteTransaction } from './actions'

export function TransactionRowActions({
  id,
  description,
}: {
  id: string
  // Used in the confirm() text so the user knows exactly what they're deleting.
  description: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    // Native confirm() is enough for a local single-user app and avoids pulling
    // in a modal library this early.
    const ok = window.confirm(`Excluir a transação "${description}"?`)
    if (!ok) return

    setError(null)
    startTransition(async () => {
      const result = await deleteTransaction(id)
      if (result.ok) {
        // Re-fetch the Server Component list so the row disappears.
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        href={`/transactions/${id}/edit`}
        className="text-xs font-medium text-gray-400 hover:text-white"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs font-medium text-red-500 hover:text-red-300 disabled:opacity-50"
      >
        {isPending ? 'Excluindo…' : 'Excluir'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
