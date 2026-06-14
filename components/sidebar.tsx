'use client'

// Sidebar — the app's main navigation, fixed to the left of every page.
//
// "use client": it reads the current route with usePathname() to highlight the
// active link and keeps the collapsible group's open/closed state — both need
// the browser. Restyled to match the reference "cofre" design: a logo, a
// collapsible "Orçamento Doméstico" group with lucide icons, and a jade
// left-border on the active item.

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Wallet2,
  LayoutDashboard,
  Receipt,
  Settings,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: LucideIcon }

// Single group for now ("Orçamento Doméstico"); Investimentos/Calculadoras are
// future phases and intentionally left out.
const GROUP = {
  label: 'Orçamento Doméstico',
  icon: Wallet2,
  items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/transactions', label: 'Transações', icon: Receipt },
    { href: '/settings', label: 'Configurações', icon: Settings },
  ] as NavItem[],
}

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)

  // The dashboard ("/") matches exactly; the others also match their sub-routes
  // (e.g. /transactions/123/edit keeps "Transações" highlighted).
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  const groupHasActive = GROUP.items.some((i) => isActive(i.href))

  return (
    <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col overflow-y-auto border-r border-cofre-border bg-cofre-panel px-3.5 py-5">
      {/* Brand */}
      <Link href="/" className="mb-7 flex items-center gap-2.5 px-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cofre-jade">
          <Wallet2 size={18} className="text-[#0B1410]" />
        </span>
        <span>
          <span className="block text-[15px] font-extrabold tracking-wide">
            hub<span className="text-cofre-jade">finance</span>
          </span>
          <span className="block text-[11px] text-cofre-faint">Finanças pessoais</span>
        </span>
      </Link>

      {/* Collapsible group */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-bold tracking-wide transition ${
          groupHasActive ? 'text-cofre-text' : 'text-cofre-muted'
        }`}
        aria-expanded={open}
      >
        <GROUP.icon size={16} />
        <span className="flex-1 text-left">{GROUP.label}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <nav className="mb-1.5 ml-3 flex flex-col border-l border-cofre-border pl-2">
          {GROUP.items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`mb-px flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-[13px] transition ${
                  active
                    ? 'border-cofre-jade bg-cofre-card font-bold text-cofre-text'
                    : 'border-transparent font-medium text-cofre-muted hover:bg-cofre-card/50 hover:text-cofre-text'
                }`}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </aside>
  )
}
