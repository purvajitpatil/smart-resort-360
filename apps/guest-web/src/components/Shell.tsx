/**
 * The guest app frame: a scrolling canvas plus a fixed bottom tab bar.
 *
 * The bar sits in the bottom 40% of the screen per the design spec, which is
 * also where a thumb naturally rests — every primary destination is reachable
 * one-handed while holding a suitcase.
 */
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from './ui'

const TABS = [
  { to: '/app', label: 'Stay', icon: Icon.Home, end: true },
  { to: '/app/assistant', label: 'Assistant', icon: Icon.Chat },
  { to: '/app/requests', label: 'Requests', icon: Icon.List },
  { to: '/app/memory', label: 'Preferences', icon: Icon.Spark },
]

export default function Shell({
  children,
  title,
  subtitle,
  right,
}: {
  children: ReactNode
  title?: string
  subtitle?: string
  right?: ReactNode
}) {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      {title ? (
        <header className="glass hair-b sticky top-0 z-40 flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <h1 className="t-h3 truncate">{title}</h1>
            {subtitle ? (
              <p className="t-data mt-1 text-[var(--color-ink-dim)]">{subtitle}</p>
            ) : null}
          </div>
          {right}
        </header>
      ) : null}

      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav
        className="glass hair-t fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[440px] justify-around px-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2"
        aria-label="Primary"
      >
        {TABS.map(({ to, label, icon: Ico, end }) => {
          const active = end ? pathname === to : pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex min-w-16 flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors"
              style={{ color: active ? 'var(--color-tint)' : 'var(--color-ink-dim)' }}
              aria-current={active ? 'page' : undefined}
            >
              <Ico className="h-[22px] w-[22px]" />
              <span className="t-label" style={{ fontSize: 10 }}>
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
