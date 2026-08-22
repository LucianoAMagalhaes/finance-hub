// Allocation target editor — set each asset type's share of the portfolio.
//
// "use client": interactive. It keeps every percentage in local state so the
// running total updates live (jade at 100%, amber otherwise), then saves them in
// one Server Action call and refreshes the (force-dynamic) Settings page.
//
// This is the twin of category-percent-editor.tsx, one floor up in the
// investments module: there the plan splits monthly INCOME across the 6 jars,
// here it splits the PORTFOLIO across the asset types. Two differences worth
// noticing:
//   * rows are keyed by TYPE, not by a row id — the types are a fixed enum, so
//     every one of them is always on screen even before it has a saved row;
//   * each row shows what the portfolio actually holds today next to the goal,
//     so the gap the aporte planner will try to close is visible right here.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sumPercents } from '@/lib/category-percent'
import { allocationTargetsSchema } from '@/lib/allocation'
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  ASSET_TYPE_COLORS,
  type AssetType,
} from '@/lib/constants'
import { setAllocationTargets } from './actions'

/** What the page passes down: the saved goal and today's real share. */
export type AllocationRow = {
  type: AssetType
  targetPercent: number
  /** Share of the portfolio this type holds right now, 0-100. */
  currentPercent: number
}

export function AllocationTargetEditor({
  items,
  hasPortfolio,
}: {
  items: AllocationRow[]
  hasPortfolio: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Percentages keyed by asset type, seeded from the saved plan.
  const [percents, setPercents] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((row) => [row.type, row.targetPercent])),
  )

  const total = sumPercents(items.map((row) => ({ percent: percents[row.type] ?? 0 })))
  const balanced = total === 100

  function setPercent(type: AssetType, raw: string) {
    setSuccess(false)
    // Clamp to 0-100 and coerce to an integer; empty input counts as 0.
    const n = raw === '' ? 0 : Math.max(0, Math.min(100, Math.round(Number(raw))))
    setPercents((prev) => ({ ...prev, [type]: Number.isNaN(n) ? 0 : n }))
  }

  function handleSave() {
    setError(null)
    setSuccess(false)

    const payload = ASSET_TYPES.map((type) => ({ type, percent: percents[type] ?? 0 }))
    const parsed = allocationTargetsSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await setAllocationTargets(payload)
      if (result.ok) {
        setSuccess(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-cofre-border rounded-lg border border-cofre-border">
        {items.map((row) => {
          const value = percents[row.type] ?? 0
          // How far today's portfolio is from this goal. This is exactly the
          // gap the aporte planner closes, so showing it here makes the plan
          // and its consequence readable in one place.
          const drift = row.currentPercent - value

          return (
            <li key={row.type} className="flex items-center gap-3 p-4">
              {/* The type's color as a dot. It comes from a constant but is
                  applied inline because it is a hex, not a Tailwind token. */}
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: ASSET_TYPE_COLORS[row.type] }}
                aria-hidden
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-cofre-text">
                  {ASSET_TYPE_LABELS[row.type]}
                </span>
                {hasPortfolio && (
                  <span className="block text-xs text-cofre-faint">
                    hoje{' '}
                    {row.currentPercent.toLocaleString('pt-BR', {
                      maximumFractionDigits: 1,
                    })}
                    %
                    {value > 0 && Math.abs(drift) >= 0.05 && (
                      <span className={drift > 0 ? 'text-cofre-amber' : 'text-cofre-muted'}>
                        {' · '}
                        {drift > 0 ? 'acima' : 'abaixo'} da meta em{' '}
                        {Math.abs(drift).toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                        })}
                        {' pontos'}
                      </span>
                    )}
                  </span>
                )}
              </span>

              {/* A slider for quick adjustment, mirrored by a number input —
                  the same pair the jar-percent editor uses. */}
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => setPercent(row.type, e.target.value)}
                className="hidden w-40 accent-cofre-jade sm:block"
                aria-label={`Meta de ${ASSET_TYPE_LABELS[row.type]}`}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(e) => setPercent(row.type, e.target.value)}
                  className="w-16 rounded-md border border-cofre-border px-2 py-1 text-right text-sm tabular-nums focus:border-cofre-jade focus:outline-none"
                />
                <span className="text-sm text-cofre-muted">%</span>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Live total — jade when it reaches exactly 100%, amber otherwise. */}
      <div className="flex items-center justify-between rounded-lg border border-cofre-border px-4 py-3 text-sm">
        <span className="text-cofre-muted">Total alocado</span>
        <span className={`font-semibold ${balanced ? 'text-cofre-jade' : 'text-cofre-amber'}`}>
          {total}%{balanced ? '' : total > 100 ? ' (acima de 100%)' : ' (abaixo de 100%)'}
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-cofre-jadedim px-3 py-2 text-sm text-cofre-jade">
          Metas de alocação salvas!
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar metas de alocação'}
      </button>
    </div>
  )
}
