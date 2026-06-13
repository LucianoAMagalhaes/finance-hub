// Transaction filter bar (Client Component).
//
// It is "controlled by the URL": every filter reads its current value from the
// query string and, on change, pushes an updated query string. The page is a
// Server Component that re-runs its Prisma query whenever the URL changes, so
// filtering happens on the server and the result is shareable/bookmarkable.

'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from '@/lib/constants'

type CategoryOption = { id: string; name: string; icon: string; type: TransactionType }

export function TransactionFilters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Current values straight from the URL (the single source of truth).
  const type = searchParams.get('type') ?? ''
  const categoryId = searchParams.get('categoryId') ?? ''
  const paymentMethod = searchParams.get('paymentMethod') ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''

  // Search is debounced, so it gets local state seeded from the URL.
  const [q, setQ] = useState(searchParams.get('q') ?? '')

  // Writes one key into the query string (deleting it when empty) and navigates.
  // `replace` (not push) keeps filter tweaks out of the browser history.
  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Debounce the free-text search: wait 350ms after the last keystroke before
  // updating the URL, so we don't query on every character.
  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (q === current) return
    const timer = setTimeout(() => setParam('q', q), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function clearAll() {
    setQ('')
    router.replace(pathname, { scroll: false })
  }

  const hasAny = Boolean(type || categoryId || paymentMethod || from || to || q)

  const field =
    'rounded-md border border-gray-700 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <input
          className={`${field} grow`}
          placeholder="Buscar por descrição…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className={field} value={type} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">Todos os tipos</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          className={field}
          value={categoryId}
          onChange={(e) => setParam('categoryId', e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>

        <select
          className={field}
          value={paymentMethod}
          onChange={(e) => setParam('paymentMethod', e.target.value)}
        >
          <option value="">Todas as formas</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300">
          De
          <input
            type="date"
            className={field}
            value={from}
            onChange={(e) => setParam('from', e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Até
          <input
            type="date"
            className={field}
            value={to}
            onChange={(e) => setParam('to', e.target.value)}
          />
        </label>

        {hasAny && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-sm text-gray-400 underline hover:text-white"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
