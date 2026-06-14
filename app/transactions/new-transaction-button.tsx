// "Nova transação" button + creation modal.
//
// "use client": it holds the modal's open/closed state. The page (a Server
// Component) fetches the category/tag options and passes them down as plain
// props; this component just toggles the Modal and renders TransactionForm
// inside it. Moving creation into a modal frees the page to show the table at
// full width instead of squeezing a sidebar form next to it.

'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { TransactionForm } from './transaction-form'
import type { TransactionType } from '@/lib/constants'

type CategoryOption = { id: string; name: string; icon: string; type: TransactionType }
type TagOption = { id: string; name: string }
type AccountOption = { id: string; name: string }

export function NewTransactionButton({
  categories,
  tags,
  accounts,
}: {
  categories: CategoryOption[]
  tags: TagOption[]
  accounts: AccountOption[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
      >
        + Nova transação
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova transação">
        {/* onSuccess closes the modal; the form already refreshed the list. */}
        <TransactionForm
          categories={categories}
          tags={tags}
          accounts={accounts}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
