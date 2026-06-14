'use client'

// Sidebar — the app's main navigation, fixed to the left of every page.
//
// "use client": it reads the current route with usePathname() to highlight the
// active link, which only works in the browser. The links use next/link for
// fast client-side navigation. It's rendered once in the root layout, so it
// stays in place while the page content (children) changes.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// One entry in the menu. `icon` is an emoji to match the app's emoji-based
// category/marker style (no icon library needed).
type NavItem = { href: string; label: string; icon: string }

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/transactions', label: 'Transações', icon: '🧾' },
  { href: '/settings', label: 'Configurações', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-900">
      {/* Brand — also links home. */}
      <Link
        href="/"
        className="flex items-center gap-2 px-5 py-5 text-lg font-bold tracking-tight"
      >
        <span aria-hidden>💰</span> Finra
      </Link>

      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          // The dashboard ("/") must match exactly; the others also match their
          // sub-routes (e.g. /transactions/123/edit highlights "Transações").
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <span aria-hidden className="text-base">
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
