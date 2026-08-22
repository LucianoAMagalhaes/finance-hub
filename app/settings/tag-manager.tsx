// Tag manager — list + inline add/edit/delete for reusable markers.
//
// "use client": interactive, like EntityManager. Tags are simpler than
// categories — just a name (unique per user) and a color, no icon or type — so
// they get their own small component instead of squeezing into EntityManager.
// After each mutation we router.refresh() the (force-dynamic) Settings page.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { tagSchema } from '@/lib/settings-schema'
import { createTag, updateTag, deleteTag } from './actions'

export type TagRow = {
  id: string
  name: string
  // The DB column is nullable; the page passes a neutral default when null.
  color: string
}

const DEFAULT_COLOR = '#6b7280'

const field =
  'w-full rounded-md border border-cofre-border px-3 py-2 text-sm focus:border-cofre-jade focus:outline-none'

export function TagManager({ items }: { items: TagRow[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const payload = { name, color }
    const parsed = tagSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await createTag(payload)
      if (result.ok) {
        setName('')
        setColor(DEFAULT_COLOR)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
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
            placeholder="Novo marcador"
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

      {items.length === 0 ? (
        <p className="text-sm text-cofre-muted">Nenhum marcador cadastrado.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <TagChip key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

// One tag chip: a colored pill that toggles into an inline edit form.
function TagChip({ item }: { item: TagRow }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [color, setColor] = useState(item.color)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    const payload = { name, color }
    const parsed = tagSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }
    startTransition(async () => {
      const result = await updateTag(item.id, payload)
      if (result.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function handleDelete() {
    const ok = window.confirm(`Excluir o marcador "${item.name}"?`)
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await deleteTag(item.id)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (editing) {
    return (
      <li className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-cofre-border p-3">
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
    <li className="flex flex-col">
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
        style={{ borderColor: item.color, backgroundColor: `${item.color}15` }}
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: item.color }}
          aria-hidden
        />
        <span className="font-medium text-cofre-text">{item.name}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-1 text-xs text-cofre-muted hover:text-cofre-text"
        >
          editar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs text-cofre-red hover:opacity-80 disabled:opacity-50"
        >
          {isPending ? '…' : 'excluir'}
        </button>
      </div>
      {error && <span className="mt-1 text-xs text-cofre-red">{error}</span>}
    </li>
  )
}
