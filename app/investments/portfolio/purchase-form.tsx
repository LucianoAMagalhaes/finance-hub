'use client'

// Purchase form — the only way an asset enters the portfolio.
//
// "use client": it holds the field state, validates with the same Zod schema the
// Server Action uses, and calls that action through useTransition, which gives a
// `pending` flag while the server works. After a successful write it calls
// router.refresh(), so the Server Component page re-runs its query and the table
// shows the new numbers.
//
// There is no "cadastrar ativo" step: the user registers a BUY, and the action
// reuses the asset when that ticker is already in the portfolio. Buying PETR4 a
// second time is just another purchase — the average price moves and the buy
// shows up in that row's drill-down.
//
// Amounts follow ADR-007: the quantity takes up to 8 decimals and the unit price
// is typed in reais but travels in cents (and may be fractional). The TOTAL is
// not a field — the server derives it from quantity × price, so there is never a
// second number that could disagree.

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  PURCHASE_CURRENCIES,
  PURCHASE_CURRENCY_SYMBOLS,
  TREASURY_KINDS,
  TREASURY_KIND_NAMES,
  type AssetType,
  type PurchaseCurrency,
  type TreasuryKind,
} from '@/lib/constants'
import { formatBRL, formatDate, parsePriceToCents, parseQuantity } from '@/lib/format'
import { purchaseSchema } from '@/lib/asset-schema'
import { paysCoupons, treasuryTicker } from '@/lib/treasury'
import { lookupFxRate, recordPurchase } from './actions'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PurchaseForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [ticker, setTicker] = useState('')
  const [type, setType] = useState<AssetType>('stock_br')
  // Fixed income is identified by the bond, not by a ticker — see lib/treasury.
  const [treasuryKind, setTreasuryKind] = useState<TreasuryKind>('selic')
  const [maturityDate, setMaturityDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [date, setDate] = useState(today())
  const [currency, setCurrency] = useState<PurchaseCurrency>('BRL')
  // The rate the preview found for `date`, and whatever went wrong looking it up.
  const [fxRate, setFxRate] = useState<number | null>(null)
  const [fxError, setFxError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A Tesouro bond has no ticker to type: the user picks WHICH bond and WHEN it
  // matures, and the name is generated from that pair.
  const isTreasury = type === 'fixed_income'
  // Only a foreign share can have been bought in another currency. A Tesouro
  // bond and a B3 share are always in reais.
  const canBeForeign = type === 'stock_intl'
  const isForeign = canBeForeign && currency !== 'BRL'

  // Switching to a type that cannot be foreign must not leave a stale currency
  // behind, or a B3 purchase would silently carry "USD".
  useEffect(() => {
    if (!canBeForeign) setCurrency('BRL')
  }, [canBeForeign])

  // The preview rate, refreshed whenever the currency or the date changes.
  //
  // This is for the USER's eyes only. The Server Action looks the rate up again
  // when saving, so nothing here can influence what is stored — same reason the
  // total is derived on the server rather than sent from the browser.
  useEffect(() => {
    if (!isForeign || date === '') {
      setFxRate(null)
      setFxError(null)
      return
    }

    // `cancelled` guards against a slow answer for an old date landing after a
    // newer one: the user can change the date faster than the network replies.
    let cancelled = false
    setFxError(null)
    lookupFxRate(currency, date).then((result) => {
      if (cancelled) return
      if (result.ok) setFxRate(result.rate)
      else {
        setFxRate(null)
        setFxError(result.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isForeign, currency, date])

  // Live preview of what will be recorded — the same arithmetic the server
  // does, shown so the user can catch a typo before saving.
  const parsedQuantity = parseQuantity(quantity)
  const parsedUnitPrice = parsePriceToCents(unitPrice)
  // In reais the rate is 1; in dollars the total can only be previewed once the
  // rate has arrived.
  const previewRate = isForeign ? fxRate : 1
  const previewTotal =
    parsedQuantity === null || parsedUnitPrice === null || previewRate === null
      ? null
      : Math.round(parsedQuantity * parsedUnitPrice * previewRate)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // The two branches of the schema take different identity fields, so the
    // payload is built to match the one this asset belongs to.
    const identity = isTreasury
      ? { type, treasuryKind, maturityDate }
      : { type, ticker, currency }

    const parsed = purchaseSchema.safeParse({
      ...identity,
      quantity: parsedQuantity,
      unitPriceCents: parsedUnitPrice,
      date,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await recordPurchase(parsed.data)
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
      {/* Type comes first: it decides what identifies the asset below it. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="assetType">
            Tipo
          </label>
          <select
            id="assetType"
            value={type}
            onChange={(e) => setType(e.target.value as AssetType)}
            className={field}
            autoFocus
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
            <label className={label} htmlFor="ticker">
              Ticker
            </label>
            <input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="PETR4"
              className={field}
              autoComplete="off"
            />
          </div>
        )}
      </div>

      {isTreasury && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="treasuryKind">
              Título
            </label>
            <select
              id="treasuryKind"
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
            <label className={label} htmlFor="maturityDate">
              Vencimento
            </label>
            <input
              id="maturityDate"
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
              className={field}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="quantity">
            Quantidade
          </label>
          <input
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="10"
            className={field}
            inputMode="decimal"
          />
        </div>

        <div>
          <label className={label} htmlFor="unitPrice">
            {isTreasury ? 'Preço do título' : 'Preço de compra'}
            {isForeign && (
              <span className="text-cofre-faint">
                {' '}
                ({PURCHASE_CURRENCY_SYMBOLS[currency]})
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              id="unitPrice"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder={isForeign ? '609,63' : 'R$ 38,50'}
              className={field}
              inputMode="decimal"
            />

            {/* A foreign share can be bought in dollars. The value is converted
                to reais on the way into the database (ADR-013), so nothing
                downstream ever sees a foreign amount. */}
            {canBeForeign && (
              <select
                aria-label="Moeda da compra"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as PurchaseCurrency)}
                className="rounded-md border border-cofre-border px-2 py-2 text-sm focus:border-cofre-jade focus:outline-none"
              >
                {PURCHASE_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {PURCHASE_CURRENCY_SYMBOLS[code]}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="date">
          Data da compra
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={field}
        />
      </div>

      {/* The generated name, shown live: the user never types it, so this is
          how they confirm they picked the right bond before saving. */}
      {isTreasury && maturityDate && (
        <p className="text-xs text-cofre-muted">
          Será registrado como{' '}
          <span className="font-semibold text-cofre-text">
            {treasuryTicker(treasuryKind, new Date(`${maturityDate}T00:00:00.000Z`))}
          </span>
        </p>
      )}

      {/* Coupons paid before maturity are not tracked by this app, so a bond
          that pays them will read lower than reality. Saying so here beats
          showing a wrong number silently. */}
      {isTreasury && paysCoupons(treasuryKind) && (
        <p className="rounded-md bg-cofre-amberdim px-3 py-2 text-xs text-cofre-amber">
          Este título paga juros semestrais, e o app ainda não registra cupons
          recebidos — o resultado dele vai aparecer menor do que o real.
        </p>
      )}

      {/* What the dollar amount becomes in reais, and at which rate. Shown
          because the stored value is the CONVERTED one — the user should see
          the number that is about to be recorded, not just the one they typed.
          The server looks the rate up again when saving, so this is a preview
          and never the source of truth. */}
      {isForeign && (
        <p className="text-xs text-cofre-muted">
          {fxError !== null ? (
            <span className="text-cofre-amber">{fxError}</span>
          ) : fxRate === null ? (
            'Buscando o câmbio do dia da compra…'
          ) : (
            <>
              Câmbio de {formatDate(new Date(`${date}T00:00:00.000Z`))}:{' '}
              <span className="font-semibold text-cofre-text">
                R$ {fxRate.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}
              </span>{' '}
              por {PURCHASE_CURRENCY_SYMBOLS[currency]} 1,00
            </>
          )}
        </p>
      )}

      <p className="text-xs text-cofre-faint">
        {previewTotal === null
          ? 'O total é calculado a partir da quantidade e do preço.'
          : `Total desta compra: ${formatBRL(previewTotal)}`}
      </p>

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
        {isPending ? 'Salvando…' : 'Registrar compra'}
      </button>
    </form>
  )
}
