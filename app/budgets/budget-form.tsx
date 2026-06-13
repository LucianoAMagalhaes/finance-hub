// Budget form — handles both creating and editing.
//
// "use client": it uses React state and event handlers, so it runs in the
// browser. The page that renders it stays a Server Component that reads the DB.
// Mirrors transaction-form.tsx: client-side Zod validation for instant feedback,
// then the Server Action re-validates with the same schema.
//
// A budget's identity is its category + month + year, so editing only changes
// the limit. In edit mode the category is shown read-only and we call
// updateBudget instead of createBudget.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatBRL, parseBRLToCents } from '@/lib/format'
import { budgetInputSchema } from '@/lib/budget-schema'
import { MONTH_LABELS } from '@/lib/budget'
import { createBudget, updateBudget } from './actions'

type CategoryOption = { id: string; name: string; icon: string }

// Data passed when the form opens in edit mode (the budget being changed).
export type EditingBudget = {
  id: string
  amountLimit: number // cents
  category: { name: string; icon: string }
}

type Props = {
  // Expense categories that don't yet have a budget this month (create mode).
  categories: CategoryOption[]
  month: number
  year: number
  // Present only in edit mode.
  editing?: EditingBudget
}

export function BudgetForm({ categories, month, year, editing }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [categoryId, setCategoryId] = useState('')
  // Prefill the limit when editing so the user tweaks instead of retyping.
  const [amount, setAmount] = useState(
    editing ? formatBRL(editing.amountLimit) : '',
  )

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    // Convert the typed BRL string to integer cents before validating.
    const cents = parseBRLToCents(amount)
    if (cents === null) {
      setError('Limite inválido')
      return
    }

    if (editing) {
      // Edit mode: only the limit changes. Validate just that field with the
      // shared schema's rule, then call the update action.
      const parsed = budgetInputSchema.shape.amountLimit.safeParse(cents)
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
        return
      }

      startTransition(async () => {
        const result = await updateBudget(editing.id, { amountLimit: cents })
        if (result.ok) {
          // Go back to the list, which re-fetches with the new limit.
          router.push('/budgets')
          router.refresh()
        } else {
          setError(result.error)
        }
      })
      return
    }

    // Create mode: validate the full payload.
    const payload = { categoryId, amountLimit: cents, month, year }

    const parsed = budgetInputSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await createBudget(payload)
      if (result.ok) {
        setCategoryId('')
        setAmount('')
        setSuccess(true)
        // Re-fetch the Server Component so the new budget appears immediately.
        router.refresh()
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
      <h2 className="text-lg font-semibold">
        {editing ? 'Editar orçamento' : 'Novo orçamento'}
      </h2>
      <p className="text-xs text-gray-400">
        Para {MONTH_LABELS[month]} de {year}.
      </p>

      <div>
        <label className={label} htmlFor="category">
          Categoria (pote)
        </label>
        {editing ? (
          // In edit mode the category is fixed — show it read-only instead of a
          // dropdown so it's clear what's being changed.
          <p className="rounded-md bg-gray-800 px-3 py-2 text-sm text-gray-200">
            {editing.category.icon} {editing.category.name}
          </p>
        ) : (
          <>
            <select
              id="category"
              className={field}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Todas as categorias já têm orçamento neste mês.
              </p>
            )}
          </>
        )}
      </div>

      <div>
        <label className={label} htmlFor="amount">
          Limite mensal
        </label>
        <input
          id="amount"
          className={field}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="R$ 0,00"
          inputMode="decimal"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-950 px-3 py-2 text-sm text-green-300">
          Orçamento salvo!
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || (!editing && categories.length === 0)}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending
            ? 'Salvando…'
            : editing
              ? 'Atualizar limite'
              : 'Salvar orçamento'}
        </button>
        {editing && (
          // Cancel just navigates back without saving.
          <button
            type="button"
            onClick={() => router.push('/budgets')}
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
