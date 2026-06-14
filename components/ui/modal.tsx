// <Modal /> — a small reusable dialog overlay.
//
// "use client": it needs browser-only behavior (key handling, body scroll lock,
// click-outside), so it runs in the browser. It's intentionally generic — it
// only renders an overlay + a centered panel and reports when the user wants to
// close (backdrop click, Esc, or the × button). The caller controls visibility
// via `open` and reacts to `onClose`.

'use client'

import { useEffect } from 'react'

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}) {
  // Close on Escape and lock background scroll while the modal is open. The
  // effect re-runs when `open` changes and cleans up after itself.
  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Prevent the page behind the modal from scrolling.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    // Backdrop: clicking it closes the modal. The panel below stops propagation
    // so clicks inside don't bubble up and close it.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-lg rounded-lg border border-cofre-border bg-cofre-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-cofre-border px-5 py-3">
          <h2 className="text-lg font-semibold text-cofre-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md px-2 text-xl leading-none text-cofre-muted transition hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
