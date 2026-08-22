'use client'

// "Nova compra" button + modal.
//
// "use client": it holds the modal's open/closed state. Mirrors
// app/transactions/new-transaction-button.tsx so the two screens behave the
// same way — the table stays full width and writing happens in a dialog.
//
// The button says "Nova compra", not "Novo ativo", because that is the only
// gesture: the first purchase of a ticker creates the portfolio line, and every
// purchase after that adds to it.

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { PurchaseForm } from './purchase-form'

export function NewPurchaseButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90"
      >
        <Plus size={15} /> Nova compra
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova compra">
        {/* onSuccess closes the modal; the form already refreshed the table. */}
        <PurchaseForm onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  )
}
