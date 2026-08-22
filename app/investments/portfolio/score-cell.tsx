// The "Nota" cell of the portfolio table — reads the score, opens the sheet.
//
// "use client": it owns the modal state. The score itself arrives already
// derived from a Server Component (lib/scoring), so this file only draws it.
//
// What the cell says, in one glance: the score with its sign, and underneath
// either "7/10" (how much of the checklist is filled in) or "manual" for the
// types graded by hand. A dash means never evaluated — and an asset with no
// score never receives an aporte suggestion, so the dash is a call to action.

'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { formatScore, type AssetScore } from '@/lib/scoring'
import { ScoreSheet, scoreColor, type ScoreSheetAsset } from './score-sheet'

export function ScoreCell({
  asset,
  score,
}: {
  asset: ScoreSheetAsset
  score: AssetScore
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Avaliar ${asset.ticker}`}
        className="w-full rounded-md px-2 py-1 text-right transition hover:bg-cofre-panel"
      >
        <span className={`block text-sm font-bold tabular-nums ${scoreColor(score.value)}`}>
          {formatScore(score.value)}
        </span>
        <span className="block text-xs text-cofre-faint">
          {score.source === 'manual'
            ? 'manual'
            : score.total === 0
              ? 'sem checklist'
              : `${score.answered}/${score.total}`}
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Avaliar ${asset.ticker}`}
      >
        <ScoreSheet asset={asset} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  )
}
