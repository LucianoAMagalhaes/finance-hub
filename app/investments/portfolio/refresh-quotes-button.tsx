'use client'

// "Atualizar cotações" button — the entry point for the automatic quotes.
//
// "use client": the button owns three pieces of browser state (is a run in
// flight, what the last run reported, did it fail), and none of them belong in
// the database. It sits beside "Nova compra" in the Carteira header.
//
// Why a button instead of fetching on page load: a refresh is one request per
// ticker against someone else's server, and an automatic fetch would fire them
// on every F5 while making the page wait for the market to answer. Here the user
// decides when it happens.
//
// The whole run is one Server Action call. What it reports comes back already
// worded by lib/quotes.summarizeQuoteRun, so this file never builds a sentence.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { refreshQuotes } from './actions'

export function RefreshQuotesButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setSummary(null)
    setError(null)

    startTransition(async () => {
      const result = await refreshQuotes()

      if (!result.ok) {
        setError(result.error)
        return
      }

      setSummary(result.summary)
      // router.refresh() re-runs the Server Component with the new prices, so
      // the table, the cards and the pie all redraw without a full page load.
      if (result.updated > 0) router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title="Busca no Yahoo Finance o preço atual do que é negociado na B3"
        className="flex items-center gap-1.5 rounded-md border border-cofre-border px-3 py-2 text-sm font-medium text-cofre-muted transition hover:border-cofre-jade hover:text-cofre-text disabled:opacity-50"
      >
        {/* The icon spins while the request is out — the only feedback during
            the couple of seconds the market takes to answer. */}
        <RefreshCw size={14} className={isPending ? 'animate-spin' : undefined} />
        {isPending ? 'Atualizando…' : 'Atualizar cotações'}
      </button>

      {error && <p className="max-w-xs text-right text-xs text-cofre-red">{error}</p>}
      {summary && !error && (
        <p className="max-w-xs text-right text-xs text-cofre-faint">{summary}</p>
      )}
    </div>
  )
}
