// Profile form — edits the local user's name and email.
//
// "use client": uses React state + an event handler. Client-side Zod validation
// gives instant feedback, then updateProfile re-validates on the server (never
// trust the browser). On success we router.refresh() so the page reflects the
// saved values.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { profileSchema } from '@/lib/settings-schema'
import { updateProfile } from './actions'

export function ProfileForm({
  initialName,
  initialEmail,
}: {
  initialName: string
  initialEmail: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    const payload = { name, email }
    const parsed = profileSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos')
      return
    }

    startTransition(async () => {
      const result = await updateProfile(payload)
      if (result.ok) {
        setSuccess(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  const field =
    'w-full rounded-md border border-cofre-border px-3 py-2 text-sm focus:border-cofre-jade focus:outline-none'
  const label = 'mb-1 block text-sm font-medium text-cofre-text'

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label className={label} htmlFor="profile-name">
          Nome
        </label>
        <input
          id="profile-name"
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className={label} htmlFor="profile-email">
          E-mail
        </label>
        <input
          id="profile-email"
          type="email"
          className={field}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-md bg-cofre-reddim px-3 py-2 text-sm text-cofre-red">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-cofre-jadedim px-3 py-2 text-sm text-cofre-jade">
          Perfil salvo!
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-cofre-jade px-4 py-2 text-sm font-semibold text-[#0B1410] transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar perfil'}
      </button>
    </form>
  )
}
