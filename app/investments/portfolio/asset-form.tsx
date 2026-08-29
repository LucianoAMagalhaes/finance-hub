'use client'

// Asset form — edits a portfolio line that already exists: its ticker, its
// class, and the hand-typed quote.
//
// "use client": it holds the field state, validates with the same Zod schema the
// Server Action uses, and calls that action through useTransition. After a
// successful write, router.refresh() re-runs the Server Component page so the
// table shows the new numbers.
//
// New purchases are NOT here — they live in purchase-form.tsx, because buying is
// a different gesture from correcting an asset's data. The quote can also be
// edited straight from the table (quote-cell.tsx); this form is the slower path
// that also lets the ticker and the class be fixed.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  TREASURY_KINDS,
  TREASURY_KIND_NAMES,
  type AssetType,
  type TreasuryKind,
} from '@/lib/constants'
import { formatPriceBRL, parsePriceToCents } from '@/lib/format'
import { assetSchema } from '@/lib/asset-schema'
import { treasuryTicker } from '@/lib/treasury'
import { updateAsset } from './actions'

// The asset being edited. The last two are set only on fixed income, where the
// bond + maturity ARE the identity and the ticker is generated from them.
export type EditingAsset = {
  id: string
  ticker: string
  type: AssetType
  currentPriceCents: number | null
  treasuryKind: TreasuryKind | null
  maturityDate: Date | null
}

// A stored maturity (UTC midnight) as the <input type="date"> wants it.
function toDateInput(date: Date | null): string {
  return date === null ? '' : date.toISOString().slice(0, 10)
}

export function AssetForm({
  editing,
  onSuccess,
}: {
  editing: EditingAsset
  onSuccess?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [ticker, setTicker] = useState(editing.ticker)
  const [type, setType] = useState<AssetType>(editing.type)
  const [treasuryKind, setTreasuryKind] = useState<TreasuryKind>(
    editing.treasuryKind ?? 'selic',
  )
  const [maturityDate, setMaturityDate] = useState(toDateInput(editing.maturityDate))
  const [price, setPrice] = useState(
    editing.currentPriceCents != null ? formatPriceBRL(editing.currentPriceCents) : '',
  )
  const [error, setError] = useState<string | null>(null)

  const isTreasury = type === 'fixed_income'

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // Same union as the purchase form: each type is named by its own fields.
    // Switching an asset INTO fixed income regenerates its name from the bond;
    // switching it out clears the bond columns (handled in the Server Action).
    const identity = isTreasury
      ? { type, treasuryKind, maturityDate }
      : { type, ticker }

    const parsed = assetSchema.safeParse({
      ...identity,
      // An empty field means "no quote": the table then shows "sem cotação"
      // instead of pretending the position is worth R$ 0,00.
      currentPriceCents: price.trim() === '' ? null : parsePriceToCents(price),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await updateAsset(editing.id, parsed.data)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onSuccess?.()
    })
  }

  // Shared Tailwind classes for inputs, to keep the markup readable.
  const field =
    'w-full rounded-md border border-cofre-border px-3 py-2 text-sm focus:border-cofre-jade focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-cofre-text'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="editAssetType">
            Tipo
          </label>
          <select
            id="editAssetType"
            value={type}
            onChange={(e) => setType(e.target.value as AssetType)}
            className={field}
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {!isTreasury && (
          <div>
            <label className={label} htmlFor="editTicker">
              Ticker
            </label>
            <input
              id="editTicker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className={field}
              autoComplete="off"
            />
          </div>
        )}
      </div>

      {isTreasury && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="editTreasuryKind">
                Título
              </label>
              <select
                id="editTreasuryKind"
                value={treasuryKind}
                onChange={(e) => setTreasuryKind(e.target.value as TreasuryKind)}
                className={field}
              >
                {TREASURY_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {TREASURY_KIND_NAMES[kind]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label} htmlFor="editMaturityDate">
                Vencimento
              </label>
              <input
                id="editMaturityDate"
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                className={field}
              />
            </div>
          </div>

          {maturityDate && (
            <p className="text-xs text-cofre-muted">
              Passa a se chamar{' '}
              <span className="font-semibold text-cofre-text">
                {treasuryTicker(treasuryKind, new Date(`${maturityDate}T00:00:00.000Z`))}
              </span>
            </p>
          )}
        </>
      )}

      <div>
        <label className={label} htmlFor="editCurrentPrice">
          Cotação atual <span className="text-cofre-faint">(opcional)</span>
        </label>
        <input
          id="editCurrentPrice"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="R$ 40,00"
          className={field}
          inputMode="decimal"
        />
        <p className="mt-1 text-xs text-cofre-faint">
          Digitada à mão por enquanto. Também dá para editar direto na coluna
          Cotação da tabela.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </form>
  )
}
