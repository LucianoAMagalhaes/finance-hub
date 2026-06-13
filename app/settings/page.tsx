// Settings page — route "/settings".
//
// A Server Component: it runs on the server, reads the local user plus the three
// customizable catalogs (categories, subcategories, tags) with Prisma, and hands
// plain data to the client managers. Each manager calls the Server Actions in
// ./actions.ts and refreshes this page after a change.

import { prisma } from '@/lib/prisma'
import { getLocalUser } from '@/lib/user'
import { ProfileForm } from './profile-form'
import { EntityManager, type EntityRow } from './entity-manager'
import { TagManager, type TagRow } from './tag-manager'

// Always render fresh data: the catalogs change as the user edits them here.
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getLocalUser()

  // Fetch the three catalogs in parallel (independent queries).
  const [categories, subcategories, tags] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, icon: true, color: true, type: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.subcategory.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, icon: true, color: true, type: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    }),
    prisma.tag.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // The Prisma selects already match EntityRow's shape.
  const categoryRows = categories as EntityRow[]
  const subcategoryRows = subcategories as EntityRow[]
  // Tag color is nullable in the DB; fall back to a neutral default for the UI.
  const tagRows: TagRow[] = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color ?? '#6b7280',
  }))

  return (
    <main className="mx-auto max-w-5xl space-y-10 p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-gray-400">
          Edite seu perfil e personalize categorias, subcategorias e marcadores.
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
        title="Subcategorias"
        description="Áreas de gasto/receita escolhidas livremente, sem pai fixo."
      >
        <EntityManager kind="subcategory" items={subcategoryRows} />
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
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      {children}
    </section>
  )
}
