/**
 * Shared presentational primitives for the guest app.
 *
 * These exist so status vocabulary stays consistent across screens: a request
 * that is "In progress" looks identical in the chat, on the home card and in
 * the request list. Cohesion is how people learn their way around.
 */
import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ Icons */
/* Inline so the app has no icon-font dependency and works fully offline. */

type IconProps = { className?: string }

const base = 'h-5 w-5'

export const Icon = {
  Home: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </svg>
  ),
  Chat: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />
    </svg>
  ),
  List: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  ),
  Spark: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  ),
  Bot: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="11" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01" />
    </svg>
  ),
  Send: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
    </svg>
  ),
  Back: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  ),
  Check: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  ),
  Key: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15 12v2" />
    </svg>
  ),
  Bell: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.5 20a2 2 0 0 0 3 0" />
    </svg>
  ),
  Trash: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
    </svg>
  ),
  Clock: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  Logout: ({ className = base }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 12H4M11 7l-5 5 5 5M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    </svg>
  ),
}

/* ------------------------------------------------------------------ Chips */

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'

/** Maps a backend request status onto a chip tone and a human label. */
export function statusTone(status: string): { tone: Tone; label: string } {
  switch (status) {
    case 'COMPLETED':
      return { tone: 'success', label: 'Done' }
    case 'IN_PROGRESS':
      return { tone: 'warning', label: 'In progress' }
    case 'ASSIGNED':
      return { tone: 'info', label: 'Assigned' }
    case 'PENDING':
      return { tone: 'brand', label: 'Received' }
    case 'CANCELLED':
      return { tone: 'neutral', label: 'Cancelled' }
    case 'REJECTED':
      return { tone: 'danger', label: 'Declined' }
    default:
      return { tone: 'neutral', label: status }
  }
}

export function Chip({
  tone = 'neutral',
  live = false,
  children,
}: {
  tone?: Tone
  live?: boolean
  children: ReactNode
}) {
  return <span className={`chip chip-${tone}${live ? ' chip-live' : ''}`}>{children}</span>
}

/* ------------------------------------------------------------------ Layout */

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="t-label text-[var(--color-ink-dim)]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Empty states are an invitation to act, not a shrug. */
export function Empty({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <p className="t-h3">{title}</p>
      <p className="t-body-sm max-w-[30ch] text-[var(--color-ink-dim)]">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-20 w-full" />
      ))}
    </div>
  )
}

/** Errors state what happened and what to do — never just "something failed". */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col gap-3 border-[rgba(220,38,38,0.35)] p-4">
      <p className="t-body-sm text-[#f87171]">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-quiet self-start" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

/** Confidence rendered as a bar — the memory screens lean on this heavily. */
export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const tone = value >= 0.65 ? '' : value >= 0.35 ? ' track-warning' : ' track-danger'
  return (
    <div className="flex items-center gap-2">
      <div className={`track w-16${tone}`}>
        <span style={{ width: `${Math.max(6, pct)}%` }} />
      </div>
      <span className="t-data text-[var(--color-ink-dim)]">{pct}%</span>
    </div>
  )
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function clockOf(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}
