// Goal form — handles both creating and editing.
//
// "use client": it uses React state and event handlers, so it runs in the
// browser. The page that renders it stays a Server Component that reads the DB.
// Mirrors budget-form.tsx: client-side Zod validation for instant feedback,
// then the Server Action re-validates with the same schema. In edit mode the
// fields start from the existing goal and we call updateGoal instead.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatBRL, parseBRLToCents } from '@/lib/format'
import { goalInputSchema } from '@/lib/goal-schema'
import { createGoal, updateGoal } from './actions'

// Today as YYYY-MM-DD, used as the date input's sensible lower bound.
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// Data passed when the form opens in edit mode (the goal being changed).
export type EditingGoal = {
  id: string
  name: string
  targetAmount: number // cents
  currentAmount: number // cents
  deadline: string // YYYY-MM-DD
}

export function GoalForm({ editing }: { editing?: EditingGoal }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // In edit mode each field starts from the existing goal; otherwise blank.
  const [name, setName] = useState(editing?.name ?? '')
  const [target, setTarget] = useState(
    editing ? formatBRL(editing.targetAmount) : '',
  )
  const [current, setCurrent] = useState(
    editing ? formatBRL(editing.currentAmount) : '',
  )
  const [deadline, setDeadline] = useState(editing?.deadline ?? '')

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
      // Edit mode updates the existing row and returns to the list; create mode
      // appends and stays on the page for the next entry.
      const result = editing
        ? await updateGoal(editing.id, payload)
        : await createGoal(payload)

      if (result.ok) {
        if (editing) {
          router.push('/goals')
          router.refresh()
        } else {
          setName('')
          setTarget('')
          setCurrent('')
          setDeadline('')
          setSuccess(true)
          router.refresh()
        }
      } else {
        setError(result.error)
      }
    })
  }

  const field =
    'w-full rounded-md border border-gray-700 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-gray-200'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold">{editing ? 'Editar meta' : 'Nova meta'}</h2>

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
        <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-950 px-3 py-2 text-sm text-green-300">
          Meta salva!
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending ? 'Salvando…' : editing ? 'Atualizar meta' : 'Salvar meta'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => router.push('/goals')}
            disabled={isPending}
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-800 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
