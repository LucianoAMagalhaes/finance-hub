// Settings page — route "/settings".
//
// A Server Component: it runs on the server, reads the local user plus the three
// customizable catalogs (categories, tags) with Prisma, and hands
// plain data to the client managers. Each manager calls the Server Actions in
// ./actions.ts and refreshes this page after a change.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { ProfileForm } from './profile-form'
import { EntityManager, type EntityRow } from './entity-manager'
import { TagManager, type TagRow } from './tag-manager'
import { AccountManager, type AccountRow } from './account-manager'
import {
  CategoryPercentEditor,
  type PercentRow,
} from './category-percent-editor'

// Always render fresh data: the catalogs change as the user edits them here.
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getLocalUser()

  // Fetch the catalogs in parallel (independent queries).
  const [categories, tags, accounts] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        type: true,
        targetPercent: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.tag.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, initialBalance: true, color: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // The Prisma select already matches EntityRow's shape (targetPercent is an
  // extra field the row list simply ignores).
  const categoryRows = categories as EntityRow[]

  // Only expense categories carry a target share; the "Metas" editor shows them
  // ordered by share (highest first), matching how the jars are weighted.
  const percentRows: PercentRow[] = categories
    .filter((c) => c.type === 'expense')
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      targetPercent: c.targetPercent,
    }))
    .sort((a, b) => b.targetPercent - a.targetPercent || a.name.localeCompare(b.name))
  // Tag color is nullable in the DB; fall back to a neutral default for the UI.
  const tagRows: TagRow[] = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color ?? '#6b7280',
  }))
  // Account color is nullable too; same neutral fallback.
  const accountRows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    initialBalance: a.initialBalance,
    color: a.color ?? '#6b7280',
  }))

  return (
    <main className="max-w-6xl space-y-10 p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-cofre-muted">
          Edite seu perfil e personalize categorias, contas e marcadores.
        </p>
      </header>

      <Section
        title="Perfil"
        description="Seu nome e e-mail de identificação."
      >
        <ProfileForm initialName={user.name} initialEmail={user.email} />
      </Section>

      <Section
        title="Categorias"
        description="Os “potes” do método. Despesas usam os 6 potes; receitas usam fontes."
      >
        <EntityManager kind="category" items={categoryRows} />
      </Section>

      <Section
        title="Contas bancárias"
        description="Onde o dinheiro fica. O saldo de cada conta = saldo inicial + receitas − despesas."
      >
        <AccountManager items={accountRows} />
      </Section>

      <Section
        title="Metas dos potes"
        description="Quanto da sua renda mensal vai para cada pote de despesa. O ideal é somar 100%."
      >
        <CategoryPercentEditor items={percentRows} />
      </Section>

      <Section
        title="Marcadores"
        description="Etiquetas reutilizáveis, uma por transação."
      >
        <TagManager items={tagRows} />
      </Section>
    </main>
  )
}

// A titled block wrapping each settings area. Plain presentational helper.
function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-cofre-border bg-cofre-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-cofre-text">{title}</h2>
        <p className="text-sm text-cofre-muted">{description}</p>
      </div>
      {children}
    </section>
  )
}
