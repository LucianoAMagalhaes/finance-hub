// <Money /> — renders an integer-cents amount as a formatted BRL string.
//
// Role in the architecture: a tiny presentational component reused anywhere we
// show money (transaction lists, dashboard totals, budgets). Centralizing it
// means amounts always look consistent and always go through formatBRL.
//
// This is a plain (non-async) component with no client interactivity, so it
// works as a Server Component by default — Next.js renders it to HTML on the
// server. It receives already-fetched data via props.

import { formatBRL } from '@/lib/format'

type MoneyProps = {
  /** Amount in integer cents (e.g. 150000 = R$ 1.500,00). */
  cents: number
  /**
   * When true, applies a green/red color depending on the sign. Off by default
   * so neutral amounts (like a budget limit) render without color.
   */
  colored?: boolean
}

export function Money({ cents, colored = false }: MoneyProps) {
  const colorClass = colored
    ? cents < 0
      ? 'text-red-600'
      : 'text-green-600'
    : undefined

  return <span className={colorClass}>{formatBRL(cents)}</span>
}
