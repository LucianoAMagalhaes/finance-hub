// Goal creation form.
//
// "use client": it uses React state and event handlers, so it runs in the
// browser. The page that renders it stays a Server Component that reads the DB.
// Mirrors budget-form.tsx: client-side Zod validation for instant feedback,
// then the Server Action re-validates with the same schema.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseBRLToCents } from '@/lib/format'
import { goalInputSchema } from '@/lib/goal-schema'
import { createGoal } from './actions'

// Today as YYYY-MM-DD, used as the date input's sensible lower bound.
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function GoalForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('')
  const [deadline, setDeadline] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    // Convert the typed BRL strings to integer cents. An empty "current" counts
    // as zero (nothing saved yet).
    const targetCents = parseBRLToCents(target)
    if (targetCents === null) {
      setError('Valor alvo inválido')
      return
    }
    const currentCents = current.trim() === '' ? 0 : parseBRLToCents(current)
    if (currentCents === null) {
      setError('Valor atual inválido')
      return
    }

    const payload = {
      name,
      targetAmount: targetCents,
      currentAmount: currentCents,
      deadline,
    }

    const parsed = goalInputSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await createGoal(payload)
      if (result.ok) {
        setName('')
        setTarget('')
        setCurrent('')
        setDeadline('')
        setSuccess(true)
        // Re-fetch the Server Component so the new goal appears immediately.
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  const field =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-gray-700'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold">Nova meta</h2>

      <div>
        <label className={label} htmlFor="name">
          Nome
        </label>
        <input
          id="name"
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Reserva de emergência"
        />
      </div>

      <div>
        <label className={label} htmlFor="target">
          Valor alvo
        </label>
        <input
          id="target"
          className={field}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="R$ 0,00"
          inputMode="decimal"
        />
      </div>

      <div>
        <label className={label} htmlFor="current">
          Valor atual (opcional)
        </label>
        <input
          id="current"
          className={field}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="R$ 0,00"
          inputMode="decimal"
        />
      </div>

      <div>
        <label className={label} htmlFor="deadline">
          Prazo
        </label>
        <input
          id="deadline"
          type="date"
          className={field}
          value={deadline}
          min={today()}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Meta salva!
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar meta'}
      </button>
    </form>
  )
}
