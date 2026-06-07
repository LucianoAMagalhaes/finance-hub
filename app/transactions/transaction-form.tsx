// Transaction creation form.
//
// "use client" makes this a Client Component: it runs in the browser, so it can
// use React state and event handlers (useState, onClick...). Server Components
// can't do that. We keep ONLY the interactive form on the client; the page that
// renders it stays a Server Component that reads the database.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { parseBRLToCents } from '@/lib/format'
import { transactionInputSchema } from '@/lib/transaction-schema'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from '@/lib/constants'
import { createTransaction } from './actions'

// Minimal serializable shapes passed down from the Server Component.
type CategoryOption = { id: string; name: string; icon: string; type: TransactionType }
type SubcategoryOption = CategoryOption
type TagOption = { id: string; name: string }

type Props = {
  categories: CategoryOption[]
  subcategories: SubcategoryOption[]
  tags: TagOption[]
}

// Today as YYYY-MM-DD for the date input's default value.
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionForm({ categories, subcategories, tags }: Props) {
  const router = useRouter()
  // useTransition gives us a `pending` flag while the Server Action runs.
  const [isPending, startTransition] = useTransition()

  const [type, setType] = useState<TransactionType>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [tagId, setTagId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('pix')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Category and subcategory options depend on the chosen type.
  const categoryOptions = categories.filter((c) => c.type === type)
  const subcategoryOptions = subcategories.filter((s) => s.type === type)

  // When the type flips, previously chosen category/subcategory may no longer
  // be valid, so we clear them.
  function handleTypeChange(next: TransactionType) {
    setType(next)
    setCategoryId('')
    setSubcategoryId('')
  }

  function resetForm() {
    setDescription('')
    setAmount('')
    setDate(today())
    setCategoryId('')
    setSubcategoryId('')
    setTagId('')
    setNotes('')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    // Convert the typed BRL string to integer cents before validating.
    const cents = parseBRLToCents(amount)
    if (cents === null) {
      setError('Valor inválido')
      return
    }

    const payload = {
      description,
      amount: cents,
      date,
      type,
      paymentMethod,
      categoryId,
      subcategoryId,
      tagId,
      notes,
    }

    // Client-side validation first (instant feedback). The Server Action
    // validates again with the very same schema.
    const parsed = transactionInputSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await createTransaction(payload)
      if (result.ok) {
        resetForm()
        setSuccess(true)
        // Re-fetch the Server Component so the new row appears immediately.
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  // Shared Tailwind classes for inputs, to keep the markup readable.
  const field =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-gray-700'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold">Nova transação</h2>

      {/* Type toggle */}
      <div className="flex gap-2">
        {TRANSACTION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
              type === t
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {TRANSACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div>
        <label className={label} htmlFor="description">
          Descrição
        </label>
        <input
          id="description"
          className={field}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Mercado da semana"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="amount">
            Valor
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
        <div>
          <label className={label} htmlFor="date">
            Data
          </label>
          <input
            id="date"
            type="date"
            className={field}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="category">
            Categoria
          </label>
          <select
            id="category"
            className={field}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="subcategory">
            Subcategoria <span className="text-gray-400">(opcional)</span>
          </label>
          <select
            id="subcategory"
            className={field}
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
          >
            <option value="">Nenhuma</option>
            {subcategoryOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="payment">
            Forma de pagamento
          </label>
          <select
            id="payment"
            className={field}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="tag">
            Marcador <span className="text-gray-400">(opcional)</span>
          </label>
          <select
            id="tag"
            className={field}
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="notes">
          Observação <span className="text-gray-400">(opcional)</span>
        </label>
        <textarea
          id="notes"
          className={field}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Transação salva!
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar transação'}
      </button>
    </form>
  )
}
