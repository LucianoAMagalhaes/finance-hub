'use client'

// Dashboard balance chart — income vs. expense bars with a balance line over the
// last 6 months.
//
// Role in the architecture: a Client Component ("use client"). Recharts draws
// with SVG and relies on browser-only APIs (measuring the container, hover
// state), so it can't run as a Server Component. The dashboard page (a Server
// Component) does all the data work and passes a ready-made, serializable series
// down as props; this file only renders it. Amounts arrive in integer cents.

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyPoint } from '@/lib/dashboard'
import { formatBRL } from '@/lib/format'

// Compact label for the Y axis ticks — full BRL strings ("R$ 1.500,00") are too
// long to stack down the axis, so we show short reais (e.g. "R$ 1,5 mil").
function formatTick(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  })
}

// The shape Recharts hands to a custom tooltip. We type only what we read.
type TooltipPayloadItem = { name: string; value: number; color: string }

// Custom tooltip so every value is formatted as BRL (Recharts would otherwise
// print the raw cents integer).
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900 p-3 text-sm shadow-md">
      <p className="mb-1 font-semibold text-gray-200">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-gray-400">{item.name}:</span>
          <span className="font-medium text-gray-100">{formatBRL(item.value)}</span>
        </p>
      ))}
    </div>
  )
}

export function BalanceChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-gray-200">
        Evolução do saldo (últimos 6 meses)
      </h2>

      {/* ResponsiveContainer makes the chart fill its parent's width and the
          fixed height below. It needs a sized parent, hence the wrapping div. */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="#9ca3af"
            />
            <YAxis
              tickFormatter={formatTick}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              stroke="#9ca3af"
              width={72}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#1f2937' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Bars: income (green) and expense (red), side by side per month. */}
            <Bar dataKey="income" name="Receitas" fill="#16a34a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Despesas" fill="#dc2626" radius={[3, 3, 0, 0]} />
            {/* Line: the monthly balance (income − expense) drawn over the bars. */}
            <Line
              type="monotone"
              dataKey="balance"
              name="Saldo"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
