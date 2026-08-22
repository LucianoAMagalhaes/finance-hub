'use client'

// Edit form for ONE purchase, opened from a ticker's drill-down.
//
// "use client": it holds the field state and calls the Server Action through
// useTransition. Only the three numbers a purchase is made of are here —
// quantity, unit price and date. The ticker and the type belong to the asset,
// so they are edited in the asset's own modal.
//
// Changing any of these moves the position's average price, but nothing about
// the position is stored: the page recomputes it from the operations on the
// next render (lib/portfolio).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatBRL, formatPriceBRL, parsePriceToCents, parseQuantity } from '@/lib/format'
import { purchaseEditSchema } from '@/lib/asset-schema'
import { operationUnitPriceCents } from '@/lib/portfolio'
import { updatePurchase } from './actions'

/** The purchase being edited, as the table already has it. */
export type EditingPurchase = {
  id: string
  quantity: number
  totalCents: number
  date: Date
}

// <input type="date"> speaks ISO. The dates are stored at UTC midnight, so the
// UTC slice is the day the user picked, with no timezone shifting it back a day.
function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function PurchaseEditForm({
  purchase,
  onSuccess,
}: {
  purchase: EditingPurchase
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [quantity, setQuantity] = useState(String(purchase.quantity).replace('.', ','))
  const [unitPrice, setUnitPrice] = useState(
    formatPriceBRL(operationUnitPriceCents(purchase)),
  )
  const [date, setDate] = useState(toDateInput(purchase.date))
  const [error, setError] = useState<string | null>(null)

  const parsedQuantity = parseQuantity(quantity)
  const parsedUnitPrice = parsePriceToCents(unitPrice)
  const previewTotal =
    parsedQuantity === null || parsedUnitPrice === null
      ? null
      : Math.round(parsedQuantity * parsedUnitPrice)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const parsed = purchaseEditSchema.safeParse({
      quantity: parsedQuantity,
      unitPriceCents: parsedUnitPrice,
      date,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await updatePurchase(purchase.id, parsed.data)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onSuccess?.()
    })
  }

  const field =
    'w-full rounded-md border border-cofre-border px-3 py-2 text-sm focus:border-cofre-jade focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-cofre-text'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="editQuantity">
            Quantidade
          </label>
          <input
            id="editQuantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={field}
            inputMode="decimal"
            autoFocus
          />
        </div>

        <div>
          <label className={label} htmlFor="editUnitPrice">
            Preço de compra
          </label>
          <input
            id="editUnitPrice"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            className={field}
            inputMode="decimal"
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="editPurchaseDate">
          Data da compra
        </label>
        <input
          id="editPurchaseDate"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={field}
        />
      </div>

      <p className="text-xs text-cofre-faint">
        {previewTotal === null
          ? 'O total é calculado a partir da quantidade e do preço.'
          : `Total desta compra: ${formatBRL(previewTotal)}`}
      </p>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </form>
  )
}
