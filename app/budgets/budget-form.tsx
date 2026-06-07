// Budget creation form.
//
// "use client": it uses React state and event handlers, so it runs in the
// browser. The page that renders it stays a Server Component that reads the DB.
// Mirrors transaction-form.tsx: client-side Zod validation for instant feedback,
// then the Server Action re-validates with the same schema.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseBRLToCents } from '@/lib/format'
import { budgetInputSchema } from '@/lib/budget-schema'
import { MONTH_LABELS } from '@/lib/budget'
import { createBudget } from './actions'

type CategoryOption = { id: string; name: string; icon: string }

type Props = {
  // Expense categories that don't yet have a budget this month.
  categories: CategoryOption[]
  month: number
  year: number
}

export function BudgetForm({ categories, month, year }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')

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
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-gray-700'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold">Novo orçamento</h2>
      <p className="text-xs text-gray-500">
        Para {MONTH_LABELS[month]} de {year}.
      </p>

      <div>
        <label className={label} htmlFor="category">
          Categoria (pote)
        </label>
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
          <p className="mt-1 text-xs text-gray-400">
            Todas as categorias já têm orçamento neste mês.
          </p>
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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Orçamento salvo!
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || categories.length === 0}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar orçamento'}
      </button>
    </form>
  )
}
