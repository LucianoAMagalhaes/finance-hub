'use client'

// Per-row actions of the portfolio table: edit (in a modal) and delete.
//
// "use client": it owns the modal state and calls the delete Server Action
// through useTransition. Deleting an asset also deletes its operations (the FK
// cascades), so the confirmation says exactly how many go with it.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { AssetForm, type EditingAsset } from './asset-form'
import { deleteAsset } from './actions'

export function AssetRowActions({
  asset,
  operationCount,
}: {
  asset: EditingAsset
  operationCount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    const suffix =
      operationCount === 1 ? '1 operação' : `${operationCount} operações`
    if (
      !window.confirm(
        `Excluir ${asset.ticker}? O histórico (${suffix}) será excluído junto.`,
      )
    ) {
      return
    }

    startTransition(async () => {
      const result = await deleteAsset(asset.id)
      if (!result.ok) {
        window.alert(result.error)
        return
      }
      router.refresh()
    })
  }

  // Icon buttons, same pair as the purchase rows inside the drill-down, so the
  // two levels of the table read the same way. The label lives in aria-label
  // and title instead of on screen.
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${asset.ticker}`}
        title="Editar ativo"
        className="rounded-md p-1.5 text-cofre-muted transition hover:bg-cofre-panel hover:text-cofre-text"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={`Excluir ${asset.ticker}`}
        title="Excluir ativo e todo o histórico"
        className="rounded-md p-1.5 text-cofre-red transition hover:bg-cofre-reddim disabled:opacity-50"
      >
        <Trash2 size={14} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Editar ${asset.ticker}`}>
        <AssetForm editing={asset} onSuccess={() => setOpen(false)} />
      </Modal>
    </div>
  )
}
