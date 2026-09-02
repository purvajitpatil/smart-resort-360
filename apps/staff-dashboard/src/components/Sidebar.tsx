import { NavLink, useNavigate } from 'react-router-dom'
import { clearAuth, getStoredUser } from '../lib/api'
import { Icon } from './ui'

const NAV = [
  { to: '/app',            label: 'Overview',    Icon: Icon.Dashboard, end: true },
  { to: '/app/requests',   label: 'Requests',    Icon: Icon.Requests   },
  { to: '/app/rooms',      label: 'Rooms',       Icon: Icon.Rooms      },
  { to: '/app/escalations',label: 'Escalations', Icon: Icon.Alert      },
  { to: '/app/schedule',   label: 'Schedule',    Icon: Icon.Calendar   },
  { to: '/app/memory',     label: 'Guest Memory',Icon: Icon.Brain      },
]

const NAV_INTELLIGENCE = [
  { to: '/app/revenue',    label: 'Revenue',     Icon: Icon.Trend },
  { to: '/app/pricing',    label: 'Pricing',      Icon: Icon.Dollar },
  { to: '/app/segments',   label: 'Segments',     Icon: Icon.Users },
  { to: '/app/sentiment',  label: 'Sentiment',    Icon: Icon.Activity },
  { to: '/app/inventory',  label: 'Inventory',    Icon: Icon.Box },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const user = getStoredUser()

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 overflow-y-auto thin-bar"
      style={{
        width: 'var(--spacing-rail)',
        background: 'var(--color-card)',
        borderRight: '1px solid var(--color-hair)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid var(--color-hair)' }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-none" style={{ background: 'var(--color-primary)' }}>
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 18h16M6 18v-5a6 6 0 0 1 12 0v5M12 5V7" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="t-body-sm font-semibold leading-tight truncate">Smart Resort 360</p>
          <p className="t-label leading-tight mt-0.5 truncate text-dim" style={{ fontSize: 10 }}>Operations</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {NAV.map(({ to, label, Icon: Ico, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors t-body-sm font-medium ${
                isActive
                  ? 'bg-[rgba(79,70,229,0.14)] text-[var(--color-tint)]'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]'
              }`
            }
          >
            <Ico className="h-4 w-4 flex-none" />
            {label}
          </NavLink>
        ))}

        <p className="t-label mt-4 mb-1 px-3 text-dim" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Resort intelligence
        </p>
        {NAV_INTELLIGENCE.map(({ to, label, Icon: Ico }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors t-body-sm font-medium ${
                isActive
                  ? 'bg-[rgba(79,70,229,0.14)] text-[var(--color-tint)]'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]'
              }`
            }
          >
            <Ico className="h-4 w-4 flex-none" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-4" style={{ borderTop: '1px solid var(--color-hair)' }}>
        <p className="t-body-sm font-semibold truncate">{user?.full_name ?? 'Staff'}</p>
        <p className="t-label mt-0.5 text-dim">{user?.role ?? ''}</p>
        <button
          type="button"
          className="flex items-center gap-2 mt-3 text-dim"
          style={{ fontSize: 13 }}
          onClick={async () => { clearAuth(); navigate('/login', { replace: true }) }}
        >
          <Icon.Logout className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
