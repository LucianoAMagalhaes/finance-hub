'use client'

// Per-purchase actions inside a ticker's drill-down: edit (in a modal) and
// delete.
//
// "use client": it owns the modal state and calls the delete Server Action
// through useTransition. Deleting the LAST purchase of a ticker takes the whole
// portfolio line with it (there would be no history left to derive a position
// from), so the confirmation says that out loud.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { formatDate } from '@/lib/format'
import { PurchaseEditForm, type EditingPurchase } from './purchase-edit-form'
import { deletePurchase } from './actions'

export function PurchaseRowActions({
  purchase,
  ticker,
  isLast,
}: {
  purchase: EditingPurchase
  ticker: string
  /** True when this is the only purchase left on the asset. */
  isLast: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    const warning = isLast
      ? `Excluir a compra de ${formatDate(purchase.date)}? É a última de ${ticker}, então o ativo sai da carteira junto.`
      : `Excluir a compra de ${formatDate(purchase.date)} de ${ticker}? O preço médio será recalculado.`

    if (!window.confirm(warning)) return

    startTransition(async () => {
      const result = await deletePurchase(purchase.id)
      if (!result.ok) {
        window.alert(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Editar a compra de ${formatDate(purchase.date)}`}
        title="Editar compra"
        className="rounded-md p-1.5 text-cofre-muted transition hover:bg-cofre-card hover:text-cofre-text"
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={`Excluir a compra de ${formatDate(purchase.date)}`}
        title="Excluir compra"
        className="rounded-md p-1.5 text-cofre-red transition hover:bg-cofre-reddim disabled:opacity-50"
      >
        <Trash2 size={13} />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Editar compra de ${ticker}`}
      >
        <PurchaseEditForm purchase={purchase} onSuccess={() => setOpen(false)} />
      </Modal>
    </div>
  )
}
