'use client'

// Allocation pie — how the portfolio is split across asset types, shown in a
// narrow column beside the table.
//
// Client Component ("use client") because Recharts draws with SVG and needs
// browser-only APIs (measuring the container, hover state). The portfolio page
// (a Server Component) does the data work: allocationByType in lib/portfolio
// already returns each slice with its value in cents, its share and its color.
//
// A slice is worth the position's market value when there is a quote, and what
// was paid for it when there isn't — so an asset the user hasn't priced yet
// still shows up in the split instead of silently vanishing (positionValueCents).
//
// The legend also carries the GOAL for each type (Configurações -> "Metas de
// alocação") next to the reality, because the distance between the two is what
// the aporte planner will spend the next contribution closing (ADR-009). A type
// with a goal but nothing bought yet gets a legend line of its own — it has no
// slice to draw, and it is precisely where the money is meant to go.

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatBRL } from '@/lib/format'
import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from '@/lib/constants'
import type { AllocationSlice } from '@/lib/portfolio'

/** Formats a percentage the way the whole card does: at most one decimal. */
function pct(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** The goal line under a legend row: "meta 40% · 5,2 pontos acima". */
function TargetNote({ target, current }: { target: number; current: number }) {
  if (target === 0) return null
  const drift = current - target
  const off = Math.abs(drift) >= 0.05

  return (
    <span className="block text-xs text-cofre-faint">
      meta {target}%
      {off && (
        <span className={drift > 0 ? 'text-cofre-amber' : 'text-cofre-muted'}>
          {' · '}
          {pct(Math.abs(drift))} {drift > 0 ? 'acima' : 'abaixo'}
        </span>
      )}
    </span>
  )
}

// The shape Recharts hands a custom tooltip. We type only what we read.
type TooltipPayloadItem = { payload: AllocationSlice }

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload?.length) return null
  const slice = payload[0].payload

  return (
    <div className="rounded-md border border-cofre-borderlight bg-cofre-panel p-3 text-sm shadow-md">
      <p className="mb-1 font-semibold text-cofre-text">{slice.label}</p>
      <p className="tabular-nums text-cofre-muted">
        {formatBRL(slice.valueCents)} ·{' '}
        {slice.percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </p>
    </div>
  )
}

export function AllocationChart({
  slices,
  targets,
}: {
  slices: AllocationSlice[]
  targets: Record<AssetType, number>
}) {
  if (slices.length === 0) return null

  const totalCents = slices.reduce((sum, slice) => sum + slice.valueCents, 0)
  const totalTarget = ASSET_TYPES.reduce((sum, type) => sum + targets[type], 0)

  // Types the plan asks for but the portfolio does not hold yet. They cannot be
  // drawn (a 0% slice has no angle), but leaving them out would hide the biggest
  // gaps in the plan — usually the ones the next aporte should fill.
  const held = new Set(slices.map((slice) => slice.type))
  const missing = ASSET_TYPES.filter((type) => targets[type] > 0 && !held.has(type))

  return (
    <section className="rounded-lg border border-cofre-border bg-cofre-card p-5">
      <h2 className="mb-3 text-sm font-bold">Alocação por tipo</h2>

      {/* Stacked, not side by side: this card lives in a ~300px column next to
          the table, so the pie goes on top and the numbers underneath. */}
      <div className="flex flex-col gap-4">
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="valueCents"
                nameKey="label"
                innerRadius="45%"
                outerRadius="80%"
                paddingAngle={2}
                stroke="none"
              >
                {/* One Cell per slice so each type keeps its own color. */}
                {slices.map((slice) => (
                  <Cell key={slice.type} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* The legend carries the numbers: the percentage AND the amount of each
            type, which is what a pie alone can only suggest. */}
        <ul className="w-full space-y-2">
          {slices.map((slice) => (
            <li key={slice.type} className="flex items-start gap-3 text-sm">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1">
                <span className="block text-cofre-muted">{slice.label}</span>
                <TargetNote target={targets[slice.type]} current={slice.percent} />
              </span>
              <span className="tabular-nums font-semibold text-cofre-text">
                {formatBRL(slice.valueCents)}
              </span>
              <span className="w-14 text-right tabular-nums text-cofre-faint">
                {pct(slice.percent)}%
              </span>
            </li>
          ))}

          {/* Planned, but nothing bought yet. */}
          {missing.map((type) => (
            <li key={type} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-cofre-borderlight" />
              <span className="flex-1">
                <span className="block text-cofre-faint">{ASSET_TYPE_LABELS[type]}</span>
                <TargetNote target={targets[type]} current={0} />
              </span>
              <span className="tabular-nums text-cofre-faint">—</span>
              <span className="w-14 text-right tabular-nums text-cofre-faint">0%</span>
            </li>
          ))}

          <li className="flex items-start gap-3 border-t border-cofre-border pt-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold text-cofre-text">Total</span>
              {/* A plan that does not reach 100% still works (the split
                  normalizes by the weights), but the user should see it. */}
              {totalTarget !== 100 && (
                <span className="block text-xs text-cofre-amber">
                  metas somam {totalTarget}%
                </span>
              )}
            </span>
            <span className="tabular-nums font-semibold text-cofre-text">
              {formatBRL(totalCents)}
            </span>
            <span className="w-14 text-right tabular-nums text-cofre-faint">100%</span>
          </li>
        </ul>
      </div>
    </section>
  )
}
