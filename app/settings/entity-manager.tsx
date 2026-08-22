// Category manager — list + inline add/edit/delete.
//
// "use client": this is interactive (add form, per-row edit toggle, delete
// confirmation, pending states), so it runs in the browser. The Settings page
// stays a Server Component that reads the DB and passes the rows in as props;
// after each successful mutation we call router.refresh() to re-fetch that
// Server Component (the page is force-dynamic), so the list always reflects the
// database without us keeping a separate client-side copy.
//
// `kind` is kept as a small indirection (currently only 'category') so the
// component stays easy to extend and the call site reads explicitly.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '@/lib/constants'
import { categorySchema } from '@/lib/settings-schema'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type ActionResult,
} from './actions'

// The plain row shape the page passes down (matches the Prisma select).
export type EntityRow = {
  id: string
  name: string
  icon: string
  color: string
  type: 'income' | 'expense'
}

type Kind = 'category'

// Per-kind wiring: which actions to call and the singular noun for messages.
const CONFIG: Record<
  Kind,
  {
    noun: string
    create: (input: unknown) => Promise<ActionResult>
    update: (id: string, input: unknown) => Promise<ActionResult>
    remove: (id: string) => Promise<ActionResult>
  }
> = {
  category: {
    noun: 'categoria',
    create: createCategory,
    update: updateCategory,
    remove: deleteCategory,
  },
}

// A sensible default color for the "add" form's color picker.
const DEFAULT_COLOR = '#6b7280'

const field =
  'w-full rounded-md border border-cofre-border px-3 py-2 text-sm focus:border-cofre-jade focus:outline-none'

export function EntityManager({ kind, items }: { kind: Kind; items: EntityRow[] }) {
  const router = useRouter()
  const config = CONFIG[kind]

  // The "add new" form lives at the top of the section.
  const [icon, setIcon] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const payload = { icon, name, color, type }
    const parsed = categorySchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await config.create(payload)
      if (result.ok) {
        // Reset the form for the next entry and re-fetch the server list.
        setIcon('')
        setName('')
        setColor(DEFAULT_COLOR)
        setType('expense')
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
        <div className="w-16">
          <label className="mb-1 block text-xs font-medium text-cofre-muted">Ícone</label>
          <input
            className={`${field} text-center`}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🏷️"
            maxLength={16}
          />
        </div>
        <div className="min-w-[8rem] flex-1">
          <label className="mb-1 block text-xs font-medium text-cofre-muted">Nome</label>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nova ${config.noun}`}
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
        <div>
          <label className="mb-1 block text-xs font-medium text-cofre-muted">Tipo</label>
          <select
            className={field}
            value={type}
            onChange={(e) => setType(e.target.value as 'income' | 'expense')}
          >
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRANSACTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
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
        <p className="text-sm text-cofre-muted">Nenhuma {config.noun} cadastrada.</p>
      ) : (
        <ul className="divide-y divide-cofre-border rounded-lg border border-cofre-border">
          {items.map((item) => (
            <Row key={item.id} item={item} config={config} />
          ))}
        </ul>
      )}
    </div>
  )
}

// One row: shows the entity, and toggles into an inline edit form on demand.
function Row({
  item,
  config,
}: {
  item: EntityRow
  config: (typeof CONFIG)[Kind]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Edit-mode field state, seeded from the current values.
  const [icon, setIcon] = useState(item.icon)
  const [name, setName] = useState(item.name)
  const [color, setColor] = useState(item.color)
  const [type, setType] = useState<'income' | 'expense'>(item.type)

  function handleSave() {
    setError(null)
    const payload = { icon, name, color, type }
    const parsed = categorySchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    startTransition(async () => {
      const result = await config.update(item.id, payload)
      if (result.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function handleDelete() {
    const ok = window.confirm(`Excluir a ${config.noun} "${item.name}"?`)
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await config.remove(item.id)
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
          className={`${field} w-16 text-center`}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          maxLength={16}
        />
        <input
          className={`${field} min-w-[8rem] flex-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="color"
          className="h-[38px] w-12 cursor-pointer rounded-md border border-cofre-border"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <select
          className={field}
          value={type}
          onChange={(e) => setType(e.target.value as 'income' | 'expense')}
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
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
            // Discard edits: restore the original values and close.
            setIcon(item.icon)
            setName(item.name)
            setColor(item.color)
            setType(item.type)
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
      {/* Color swatch + emoji icon */}
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: `${item.color}20` }}
        aria-hidden
      >
        {item.icon}
      </span>
      <span className="flex-1 text-sm font-medium text-cofre-text">{item.name}</span>
      <span className="text-xs text-cofre-faint">{TRANSACTION_TYPE_LABELS[item.type]}</span>
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
