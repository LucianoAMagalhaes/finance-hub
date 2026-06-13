// Per-card goal actions (register contribution + edit link + delete button).
//
// "use client": all three need interactivity — a small amount input, a
// confirmation prompt, pending states and error messages — which only a Client
// Component can provide. The list itself stays a Server Component; we drop this
// island into each card.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { parseBRLToCents } from '@/lib/format'
import { contributionAmountSchema } from '@/lib/goal-schema'
import { addContribution, deleteGoal } from './actions'

export function GoalCardActions({
  id,
  name,
  // When the goal is already funded, the contribution input is hidden.
  complete,
}: {
  id: string
  name: string
  complete: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleContribute(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const cents = parseBRLToCents(amount)
    // Validate with the same rule the Server Action uses, for instant feedback.
    const parsed = contributionAmountSchema.safeParse(cents)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Valor inválido')
      return
    }

    startTransition(async () => {
      const result = await addContribution(id, parsed.data)
      if (result.ok) {
        setAmount('')
        // Re-fetch the Server Component so the progress bar moves.
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function handleDelete() {
    const ok = window.confirm(`Excluir a meta "${name}"?`)
    if (!ok) return

    setError(null)
    startTransition(async () => {
      const result = await deleteGoal(id)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="mt-3 space-y-2 border-t border-gray-800 pt-3">
      {/* Register a contribution — only while the goal still needs funding. */}
      {!complete && (
        <form onSubmit={handleContribute} className="flex gap-2">
          <input
            className="w-full rounded-md border border-gray-700 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Registrar aporte (R$)"
            inputMode="decimal"
            aria-label={`Registrar aporte na meta ${name}`}
          />
          <button
            type="submit"
            disabled={isPending}
            className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            Aportar
          </button>
        </form>
      )}

      <div className="flex items-center justify-end gap-3">
        {error && <span className="mr-auto text-xs text-red-500">{error}</span>}
        <Link
          href={`/goals/${id}/edit`}
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
          Excluir
        </button>
      </div>
    </div>
  )
}
