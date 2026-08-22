// Bank account manager — list + inline add/edit/delete.
//
// "use client": interactive (add form, per-row edit toggle, delete confirm,
// pending states). The Settings page (a Server Component) reads the accounts and
// passes them in as props; after each successful mutation we call
// router.refresh() to re-fetch that Server Component, so the list always mirrors
// the database without a separate client-side copy.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatBRL, parseBRLToCents } from '@/lib/format'
import { accountSchema } from '@/lib/settings-schema'
import { createAccount, updateAccount, deleteAccount } from './actions'

// The plain row shape the page passes down (matches the Prisma select).
export type AccountRow = {
  id: string
  name: string
  initialBalance: number // cents
  color: string
}

const DEFAULT_COLOR = '#6b7280'

const field =
  'w-full rounded-md border border-cofre-border px-3 py-2 text-sm focus:border-cofre-jade focus:outline-none'

export function AccountManager({ items }: { items: AccountRow[] }) {
  const router = useRouter()

  // "Add new" form state at the top of the section.
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // Empty balance counts as 0; otherwise parse the BRL string to cents.
    const cents = balance.trim() === '' ? 0 : parseBRLToCents(balance)
    if (cents === null) {
      setError('Saldo inicial inválido')
      return
    }

    const payload = { name, initialBalance: cents, color }
    const parsed = accountSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await createAccount(payload)
      if (result.ok) {
        setName('')
        setBalance('')
        setColor(DEFAULT_COLOR)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-cofre-border bg-cofre-panel p-3"
      >
        <div className="min-w-[8rem] flex-1">
          <label className="mb-1 block text-xs font-medium text-cofre-muted">Nome</label>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova conta"
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-cofre-muted">
            Saldo inicial
          </label>
          <input
            className={field}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="R$ 0,00"
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-cofre-muted">Cor</label>
          <input
            type="color"
            className="h-[38px] w-12 cursor-pointer rounded-md border border-cofre-border"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">{error}</p>
      )}

      {/* List */}
      {items.length === 0 ? (
        <p className="text-sm text-cofre-muted">Nenhuma conta cadastrada.</p>
      ) : (
        <ul className="divide-y divide-cofre-border rounded-lg border border-cofre-border">
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

// One row: shows the account, toggles into an inline edit form on demand.
function Row({ item }: { item: AccountRow }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(item.name)
  const [balance, setBalance] = useState(formatBRL(item.initialBalance))
  const [color, setColor] = useState(item.color)

  function handleSave() {
    setError(null)
    const cents = balance.trim() === '' ? 0 : parseBRLToCents(balance)
    if (cents === null) {
      setError('Saldo inicial inválido')
      return
    }
    const payload = { name, initialBalance: cents, color }
    const parsed = accountSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    startTransition(async () => {
      const result = await updateAccount(item.id, payload)
      if (result.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function handleDelete() {
    const ok = window.confirm(`Excluir a conta "${item.name}"?`)
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await deleteAccount(item.id)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (editing) {
    return (
      <li className="flex flex-wrap items-end gap-2 p-3">
        <input
          className={`${field} min-w-[8rem] flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={`${field} w-36`}
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          inputMode="decimal"
        />
        <input
          type="color"
          className="h-[38px] w-12 cursor-pointer rounded-md border border-cofre-border"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-cofre-jade px-3 py-2 text-sm font-semibold text-[#0B1410] hover:opacity-90 disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => {
            setName(item.name)
            setBalance(formatBRL(item.initialBalance))
            setColor(item.color)
            setError(null)
            setEditing(false)
          }}
          disabled={isPending}
          className="rounded-md border border-cofre-border px-3 py-2 text-sm font-medium text-cofre-text hover:bg-cofre-panel disabled:opacity-50"
        >
          Cancelar
        </button>
        {error && <span className="w-full text-xs text-cofre-red">{error}</span>}
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 p-3">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: item.color }}
        aria-hidden
      />
      <span className="flex-1 text-sm font-medium text-cofre-text">{item.name}</span>
      <span className="text-xs text-cofre-muted">
        Saldo inicial: {formatBRL(item.initialBalance)}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-cofre-muted hover:text-cofre-text"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium text-cofre-red hover:opacity-80 disabled:opacity-50"
        >
          {isPending ? 'Excluindo…' : 'Excluir'}
        </button>
      </div>
      {error && <span className="text-xs text-cofre-red">{error}</span>}
    </li>
  )
}
