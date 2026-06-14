// Category percent editor — set each expense jar's share of monthly income.
//
// "use client": interactive. It keeps all percentages in local state so the
// running total updates live (green at 100%, amber otherwise), then saves them
// in one Server Action call. After saving it refreshes the (force-dynamic)
// Settings page. This is the "Metas" plan: the 6-jars method splits monthly
// income across the expense categories, and this is where the user sets each
// jar's share.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { categoryPercentsSchema, sumPercents } from '@/lib/category-percent'
import { setCategoryPercents } from './actions'

// One category as passed from the server (matches the Prisma select).
export type PercentRow = {
  id: string
  name: string
  icon: string
  color: string
  targetPercent: number
}

export function CategoryPercentEditor({ items }: { items: PercentRow[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Percentages keyed by category id, seeded from the saved values.
  const [percents, setPercents] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((c) => [c.id, c.targetPercent])),
  )

  const total = sumPercents(items.map((c) => ({ percent: percents[c.id] ?? 0 })))
  const balanced = total === 100

  function setPercent(id: string, raw: string) {
    setSuccess(false)
    // Clamp to 0-100 and coerce to an integer; empty input counts as 0.
    const n = raw === '' ? 0 : Math.max(0, Math.min(100, Math.round(Number(raw))))
    setPercents((prev) => ({ ...prev, [id]: Number.isNaN(n) ? 0 : n }))
  }

  function handleSave() {
    setError(null)
    setSuccess(false)

    const payload = items.map((c) => ({ id: c.id, percent: percents[c.id] ?? 0 }))
    const parsed = categoryPercentsSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await setCategoryPercents(payload)
      if (result.ok) {
        setSuccess(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-700 p-8 text-center text-sm text-gray-400">
        Nenhuma categoria de despesa. Crie potes de despesa acima primeiro.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-gray-800 rounded-lg border border-gray-800">
        {items.map((c) => {
          const value = percents[c.id] ?? 0
          return (
            <li key={c.id} className="flex items-center gap-3 p-4">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-base"
                style={{ backgroundColor: `${c.color}20` }}
                aria-hidden
              >
                {c.icon}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-100">{c.name}</span>

              {/* A slider for quick adjustment, mirrored by a number input. */}
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => setPercent(c.id, e.target.value)}
                className="hidden w-40 accent-blue-500 sm:block"
                aria-label={`Percentual de ${c.name}`}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(e) => setPercent(c.id, e.target.value)}
                  className="w-16 rounded-md border border-gray-700 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Live total — green when it reaches exactly 100%, amber otherwise. */}
      <div className="flex items-center justify-between rounded-lg border border-gray-800 px-4 py-3 text-sm">
        <span className="text-gray-300">Total alocado</span>
        <span className={`font-semibold ${balanced ? 'text-green-400' : 'text-amber-400'}`}>
          {total}%{balanced ? '' : total > 100 ? ' (acima de 100%)' : ' (abaixo de 100%)'}
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-green-950 px-3 py-2 text-sm text-green-300">
          Metas salvas!
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar metas'}
      </button>
    </div>
  )
}
