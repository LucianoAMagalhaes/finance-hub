'use client'

// Editable quote cell — the "Cotação" column of the portfolio table.
//
// "use client": clicking the cell swaps the text for an input, so the state
// (editing or not, what was typed) lives in the browser. Enter saves through the
// updateAssetQuote Server Action, Esc cancels, and blur cancels too — a click
// somewhere else should never write a half-typed price.
//
// Why an inline cell instead of only the edit modal: while quotes are typed by
// hand (the API comes later in Phase 2), updating prices is the gesture the user
// repeats most. Three clicks for each ticker would be the slow part of the
// screen.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatPriceBRL, formatRelativeDay, parsePriceToCents } from '@/lib/format'
import { updateAssetQuote } from './actions'

export function QuoteCell({
  assetId,
  ticker,
  currentPriceCents,
  priceUpdatedAt,
  stale,
  now,
}: {
  assetId: string
  ticker: string
  currentPriceCents: number | null
  priceUpdatedAt: Date | null
  stale: boolean
  now: Date
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  function open() {
    setValue(currentPriceCents === null ? '' : formatPriceBRL(currentPriceCents))
    setEditing(true)
  }

  function save() {
    const cents = value.trim() === '' ? null : parsePriceToCents(value)
    setEditing(false)

    // Nothing typed and nothing stored, or the same price again: skip the round
    // trip entirely.
    if (cents === currentPriceCents) return

    startTransition(async () => {
      const result = await updateAssetQuote(assetId, { currentPriceCents: cents })
      if (!result.ok) {
        window.alert(result.error)
        return
      }
      router.refresh()
    })
  }

  if (editing) {
    return (
      <input
        // autoFocus is what makes a single click enough: the cell turns into an
        // input already focused, ready to be typed over.
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setEditing(false)
        }}
        aria-label={`Cotação de ${ticker}`}
        inputMode="decimal"
        className="w-28 rounded-md border border-cofre-jade bg-cofre-panel px-2 py-1 text-right text-sm tabular-nums focus:outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={isPending}
      title="Clique para atualizar a cotação"
      className="group rounded-md px-2 py-1 text-right transition hover:bg-cofre-panel disabled:opacity-50"
    >
      {currentPriceCents === null ? (
        <span className="text-sm text-cofre-faint group-hover:text-cofre-muted">
          {isPending ? 'salvando…' : 'sem cotação'}
        </span>
      ) : (
        <>
          <span
            className={`block text-sm tabular-nums ${
              stale ? 'text-cofre-amber' : 'text-cofre-text'
            }`}
          >
            {formatPriceBRL(currentPriceCents)}
          </span>
          {priceUpdatedAt && (
            <span className="block text-xs text-cofre-faint">
              {isPending ? 'salvando…' : formatRelativeDay(priceUpdatedAt, now)}
            </span>
          )}
        </>
      )}
    </button>
  )
}
