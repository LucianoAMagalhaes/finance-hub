// This is the home page of the app, served at the "/" route.
//
// In the Next.js App Router, a file named page.tsx inside app/ becomes a
// route automatically. Because we did NOT add the "use client" directive at
// the top, this is a Server Component: it runs only on the server and the
// browser just receives the final HTML. Later this lets us read the database
// directly inside pages like this one, without exposing any credentials.
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Finra</h1>
      <p className="max-w-md text-lg text-gray-500">
        Hub financeiro pessoal. Projeto inicializado e pronto para a Fase 1 —
        orçamento doméstico.
      </p>
      <span className="rounded-full border border-gray-300 px-4 py-1 text-sm text-gray-500">
        Next.js 14 · TypeScript · Tailwind · Prisma
      </span>
    </main>
  );
}
