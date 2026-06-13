// Transaction creation form.
//
// "use client" makes this a Client Component: it runs in the browser, so it can
// use React state and event handlers (useState, onClick...). Server Components
// can't do that. We keep ONLY the interactive form on the client; the page that
// renders it stays a Server Component that reads the database.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatBRL, parseBRLToCents } from '@/lib/format'
import { transactionInputSchema } from '@/lib/transaction-schema'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  type PaymentMethod,
  type TransactionType,
} from '@/lib/constants'
import { createTransaction, updateTransaction } from './actions'

// Minimal serializable shapes passed down from the Server Component.
type CategoryOption = { id: string; name: string; icon: string; type: TransactionType }
type SubcategoryOption = CategoryOption
type TagOption = { id: string; name: string }

// When present, the form runs in "edit mode": prefilled and saving with
// updateTransaction instead of createTransaction. All fields are plain
// serializable values so they can cross the server→client boundary.
export type EditingTransaction = {
  id: string
  description: string
  amount: number // integer cents
  date: string // YYYY-MM-DD
  type: TransactionType
  paymentMethod: PaymentMethod
  categoryId: string
  subcategoryId: string | null
  tagId: string | null
  notes: string | null
}

type Props = {
  categories: CategoryOption[]
  subcategories: SubcategoryOption[]
  tags: TagOption[]
  // Omitted/undefined → create mode; provided → edit mode.
  editing?: EditingTransaction
}

// Today as YYYY-MM-DD for the date input's default value.
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionForm({
  categories,
  subcategories,
  tags,
  editing,
}: Props) {
  const router = useRouter()
  const isEditing = editing !== undefined
  // useTransition gives us a `pending` flag while the Server Action runs.
  const [isPending, startTransition] = useTransition()

  // In edit mode each field starts from the existing transaction; otherwise we
  // start blank (with sensible defaults).
  const [type, setType] = useState<TransactionType>(editing?.type ?? 'expense')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [amount, setAmount] = useState(
    editing ? formatBRL(editing.amount) : '',
  )
  const [date, setDate] = useState(editing?.date ?? today())
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '')
  const [subcategoryId, setSubcategoryId] = useState(
    editing?.subcategoryId ?? '',
  )
  const [tagId, setTagId] = useState(editing?.tagId ?? '')
  const [paymentMethod, setPaymentMethod] = useState<string>(
    editing?.paymentMethod ?? 'pix',
  )
  const [notes, setNotes] = useState(editing?.notes ?? '')

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
      // Edit mode updates the existing row and returns to the list; create mode
      // saves a new row and clears the form so the next one can be typed.
      const result = isEditing
        ? await updateTransaction(editing.id, payload)
        : await createTransaction(payload)

      if (!result.ok) {
        setError(result.error)
        return
      }

      if (isEditing) {
        // Go back to the list. router.refresh() ensures it shows fresh data.
        router.push('/transactions')
        router.refresh()
      } else {
        resetForm()
        setSuccess(true)
        // Re-fetch the Server Component so the new row appears immediately.
        router.refresh()
      }
    })
  }

  // Shared Tailwind classes for inputs, to keep the markup readable.
  const field =
    'w-full rounded-md border border-gray-700 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-gray-200'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold">
        {isEditing ? 'Editar transação' : 'Nova transação'}
      </h2>

      {/* Type toggle */}
      <div className="flex gap-2">
        {TRANSACTION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition ${
              type === t
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-700 text-gray-300 hover:bg-gray-800'
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
            Subcategoria <span className="text-gray-500">(opcional)</span>
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
            Marcador <span className="text-gray-500">(opcional)</span>
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
          Observação <span className="text-gray-500">(opcional)</span>
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
        <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-950 px-3 py-2 text-sm text-green-300">
          Transação salva!
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending
            ? 'Salvando…'
            : isEditing
              ? 'Salvar alterações'
              : 'Salvar transação'}
        </button>
        {isEditing && (
          // In edit mode, give the user an explicit way out without saving.
          <Link
            href="/transactions"
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-800"
          >
            Cancelar
          </Link>
        )}
      </div>
    </form>
  )
}
