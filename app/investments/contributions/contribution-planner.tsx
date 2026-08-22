// The Aportes screen's interactive part: type an amount, get a plan.
//
// "use client": planContribution is a pure function over data the server already
// sent, so the whole suggestion recomputes locally on every keystroke — no round
// trip, no Server Action, nothing written to the database.
//
// The layout follows the arithmetic, so the reasoning is readable top to bottom:
// a block per asset type (meta vs reality vs what it receives), and inside it
// the assets of that type with the share their score earns them and the gap the
// money is closing. What got nothing stays on screen with the reason — an asset
// that silently vanishes is an asset the user stops trusting the tool about.

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Money } from '@/components/money'
import { formatBRL, formatQuantity, parseBRLToCents } from '@/lib/format'
import {
  ASSET_TYPE_COLORS,
  ASSET_TYPE_LABELS,
  type AssetType,
} from '@/lib/constants'
import { formatScore, type AssetScore } from '@/lib/scoring'
import type { Position } from '@/lib/portfolio'
import {
  DEFAULT_MIN_PER_ASSET_CENTS,
  planContribution,
  type AssetAllocation,
  type SkipReason,
  type TypeAllocation,
} from '@/lib/contribution'

// Why an asset received nothing, in the user's words.
const SKIP_LABELS: Record<SkipReason, string> = {
  'no-score': 'sem nota — avalie na Carteira',
  'non-positive-score': 'nota não positiva',
  'on-target': 'já na fatia que a nota dá',
  'below-minimum': 'ficaria abaixo do aporte mínimo',
}

const field =
  'w-full rounded-md border border-cofre-border px-3 py-2 text-sm tabular-nums focus:border-cofre-jade focus:outline-none'

export function ContributionPlanner({
  positions,
  scoreEntries,
  targets,
}: {
  positions: Position[]
  scoreEntries: [string, AssetScore][]
  targets: Record<AssetType, number>
}) {
  const [amountInput, setAmountInput] = useState('')
  const [minInput, setMinInput] = useState(
    String(DEFAULT_MIN_PER_ASSET_CENTS / 100),
  )

  const amountCents = parseBRLToCents(amountInput) ?? 0
  const minPerAssetCents = parseBRLToCents(minInput) ?? 0

  // A Map cannot cross the server boundary, so the page sent entries.
  const scores = useMemo(() => new Map(scoreEntries), [scoreEntries])

  const plan = useMemo(
    () => planContribution({ positions, scores, targets, amountCents, minPerAssetCents }),
    [positions, scores, targets, amountCents, minPerAssetCents],
  )

  // Types worth showing: the ones with a goal, or with something held.
  const visible = plan.types.filter(
    (type) => type.targetPercent > 0 || type.currentValueCents > 0,
  )
  const planned = plan.targetsSum > 0
  const evaluated = plan.types.some((type) =>
    type.assets.some((asset) => asset.score !== null && asset.score > 0),
  )

  return (
    <div className="space-y-5">
      {/* --- Inputs --- */}
      <section className="rounded-lg border border-cofre-border bg-cofre-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-cofre-muted">
              Quanto vou aportar
            </label>
            <input
              className={`${field} text-lg font-bold`}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="1.000,00"
              inputMode="decimal"
              autoFocus
            />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-cofre-muted">
              Mínimo por ativo
            </label>
            <input
              className={field}
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              placeholder="100,00"
              inputMode="decimal"
            />
            {/* Without this, a portfolio of 15 names returns R$ 3,47 each. */}
            <p className="mt-1 text-xs text-cofre-faint">evita sugestões de migalha</p>
          </div>

          {amountCents > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-cofre-muted">
                Carteira depois do aporte
              </p>
              <p className="text-xl font-extrabold tracking-tight">
                <Money cents={plan.projectedValueCents} />
              </p>
              <p className="text-xs text-cofre-faint">
                hoje {formatBRL(plan.portfolioValueCents)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* --- Blockers, in the order the user has to fix them --- */}
      {!planned && (
        <Notice>
          Você ainda não definiu as metas de alocação, então não há como dividir o
          aporte entre os tipos.{' '}
          <Link href="/settings" className="font-semibold underline">
            Definir em Configurações
          </Link>
          .
        </Notice>
      )}

      {planned && plan.targetsSum !== 100 && (
        <Notice>
          Suas metas de alocação somam <strong>{plan.targetsSum}%</strong>. A conta
          funciona assim mesmo (as fatias são normalizadas), mas o resultado só
          representa o que você quer quando o plano fecha 100%.
        </Notice>
      )}

      {planned && !evaluated && (
        <Notice>
          Nenhum ativo tem nota positiva ainda, então o dinheiro fica reservado por
          tipo sem chegar a um ativo.{' '}
          <Link href="/investments/portfolio" className="font-semibold underline">
            Avaliar na Carteira
          </Link>
          .
        </Notice>
      )}

      {/* --- The plan --- */}
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cofre-borderlight bg-cofre-card p-10 text-center">
          <p className="text-sm font-bold text-cofre-text">Nada para planejar ainda</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-cofre-faint">
            Defina as metas de alocação em Configurações e avalie seus ativos na
            Carteira — o simulador precisa das duas coisas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((type) => (
            <TypeBlock key={type.type} type={type} showAmounts={amountCents > 0} />
          ))}
        </div>
      )}

      {/* --- Totals --- */}
      {amountCents > 0 && visible.length > 0 && (
        <section className="rounded-lg border border-cofre-border bg-cofre-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-cofre-text">
              Total do aporte
            </span>
            <span className="text-xl font-extrabold tabular-nums">
              {formatBRL(plan.amountCents)}
            </span>
          </div>
          <div className="mt-3 space-y-1.5 border-t border-cofre-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-cofre-muted">Distribuído em ativos</span>
              <span className="tabular-nums text-cofre-text">
                {formatBRL(plan.allocatedCents)}
              </span>
            </div>
            {plan.unallocatedCents > 0 && (
              <div className="flex justify-between">
                <span className="text-cofre-amber">
                  Reservado sem ativo definido
                </span>
                <span className="tabular-nums text-cofre-amber">
                  {formatBRL(plan.unallocatedCents)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

// One asset type: the plan for it, then the assets inside it.
function TypeBlock({
  type,
  showAmounts,
}: {
  type: TypeAllocation
  showAmounts: boolean
}) {
  const drift = type.currentPercent - type.targetPercent
  const over = drift > 0.05

  return (
    <section className="overflow-hidden rounded-lg border border-cofre-border bg-cofre-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-cofre-border px-5 py-3.5">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: ASSET_TYPE_COLORS[type.type] }}
          aria-hidden
        />
        <span className="font-bold text-cofre-text">{ASSET_TYPE_LABELS[type.type]}</span>

        <span className="text-xs text-cofre-faint">
          meta {type.targetPercent}% · hoje{' '}
          {type.currentPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
          {Math.abs(drift) >= 0.05 && (
            <span className={over ? 'text-cofre-amber' : 'text-cofre-muted'}>
              {' · '}
              {Math.abs(drift).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{' '}
              {over ? 'acima' : 'abaixo'}
            </span>
          )}
        </span>

        {showAmounts && (
          <span className="ml-auto text-right">
            <span
              className={`block text-lg font-extrabold tabular-nums ${
                type.amountCents > 0 ? 'text-cofre-jade' : 'text-cofre-faint'
              }`}
            >
              {formatBRL(type.amountCents)}
            </span>
            {type.amountCents === 0 && (
              // Not a failure: it is the rebalancing working.
              <span className="block text-xs text-cofre-faint">já acima da meta</span>
            )}
          </span>
        )}
      </header>

      {type.warning === 'no-eligible-assets' && (
        <p className="flex items-start gap-2 bg-cofre-amberdim px-5 py-3 text-sm text-cofre-amber">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            {formatBRL(type.amountCents)} para {ASSET_TYPE_LABELS[type.type]}, mas
            você não tem nenhum ativo deste tipo com nota positiva. O valor fica
            reservado — escolha o papel você mesmo.
          </span>
        </p>
      )}

      {type.assets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cofre-border text-left text-xs uppercase tracking-wider text-cofre-faint">
                <th className="px-5 py-2.5 font-semibold">Ativo</th>
                <th className="px-4 py-2.5 text-right font-semibold">Nota</th>
                <th className="px-4 py-2.5 text-right font-semibold">Fatia</th>
                <th className="px-4 py-2.5 text-right font-semibold">Tenho</th>
                <th className="px-4 py-2.5 text-right font-semibold">Merece</th>
                {showAmounts && (
                  <>
                    <th className="px-4 py-2.5 text-right font-semibold">Aportar</th>
                    <th className="px-5 py-2.5 text-right font-semibold">≈ Qtd.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {type.assets.map((asset) => (
                <AssetRow key={asset.assetId} asset={asset} showAmounts={showAmounts} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AssetRow({
  asset,
  showAmounts,
}: {
  asset: AssetAllocation
  showAmounts: boolean
}) {
  const funded = asset.amountCents > 0

  return (
    <tr
      className={`border-b border-cofre-border/60 last:border-0 ${
        funded ? '' : 'text-cofre-faint'
      }`}
    >
      <td className="px-5 py-3">
        <span className={`block font-bold ${funded ? 'text-cofre-text' : ''}`}>
          {asset.ticker}
        </span>
        {asset.skipped && (
          <span className="block text-xs">{SKIP_LABELS[asset.skipped]}</span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <span
          className={`font-bold tabular-nums ${
            asset.score === null
              ? 'text-cofre-faint'
              : asset.score > 0
                ? 'text-cofre-jade'
                : asset.score < 0
                  ? 'text-cofre-red'
                  : 'text-cofre-amber'
          }`}
        >
          {formatScore(asset.score)}
        </span>
      </td>

      {/* The share this asset's score earns it inside its type. */}
      <td className="px-4 py-3 text-right tabular-nums">
        {asset.weightPercent > 0
          ? `${asset.weightPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
          : '—'}
      </td>

      <td className="px-4 py-3 text-right tabular-nums">
        {formatBRL(asset.currentValueCents)}
      </td>

      {/* "Merece": the position its score would justify, which is what makes the
          suggestion legible — the money goes to the biggest distance from it. */}
      <td className="px-4 py-3 text-right tabular-nums">
        {asset.weightPercent > 0 ? formatBRL(asset.targetValueCents) : '—'}
      </td>

      {showAmounts && (
        <>
          <td className="px-4 py-3 text-right">
            <span
              className={`font-bold tabular-nums ${funded ? 'text-cofre-jade' : ''}`}
            >
              {funded ? formatBRL(asset.amountCents) : '—'}
            </span>
          </td>
          <td className="px-5 py-3 text-right tabular-nums">
            {asset.quantityHint === null ? '—' : formatQuantity(asset.quantityHint)}
          </td>
        </>
      )}
    </tr>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-cofre-amberdim px-4 py-3 text-sm text-cofre-amber">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
