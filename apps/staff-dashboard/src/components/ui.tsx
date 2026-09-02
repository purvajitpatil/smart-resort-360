import type { ReactNode } from 'react'

type IconProps = { className?: string; style?: React.CSSProperties }
const base = 'h-5 w-5'

export const Icon = {
  Dashboard: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>,
  Requests: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>,
  Rooms: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  Alert: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
  Brain: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5-2.5h-2A2.5 2.5 0 0 1 5 14.5V12a2.5 2.5 0 0 1 2-2.45V9a2.5 2.5 0 0 1 2.5-2.5zm5 0A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5-2.5h2A2.5 2.5 0 0 0 19 14.5V12a2.5 2.5 0 0 0-2-2.45V9A2.5 2.5 0 0 0 14.5 2z"/></svg>,
  Logout: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M15 12H4M11 7l-5 5 5 5M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></svg>,
  Dollar: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  Check: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m4 12.5 5 5L20 6.5"/></svg>,
  Play: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="5,3 19,12 5,21"/></svg>,
  X: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Clock: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  Info: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>,
  Refresh: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  Moon: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Activity: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  Box: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>,
  Trend: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>,
  Users: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Calendar: (p: IconProps) => <svg {...p} className={p.className ?? base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'

export function statusTone(status: string): { tone: Tone; label: string } {
  switch (status) {
    case 'COMPLETED':   return { tone: 'success', label: 'Completed' }
    case 'IN_PROGRESS': return { tone: 'warning', label: 'In progress' }
    case 'ASSIGNED':    return { tone: 'info',    label: 'Assigned' }
    case 'PENDING':     return { tone: 'brand',   label: 'Pending' }
    case 'CANCELLED':   return { tone: 'neutral', label: 'Cancelled' }
    case 'REJECTED':    return { tone: 'danger',  label: 'Rejected' }
    default:            return { tone: 'neutral', label: status }
  }
}

export function priorityTone(p: string): Tone {
  return p === 'HIGH' ? 'danger' : p === 'MEDIUM' ? 'warning' : 'neutral'
}

export function Chip({ tone = 'neutral', live = false, children }: { tone?: Tone; live?: boolean; children: ReactNode }) {
  return <span className={`chip chip-${tone}${live ? ' chip-live' : ''}`}>{children}</span>
}

export function Skeleton({ h = 'h-16' }: { h?: string }) {
  return <div className={`skeleton w-full ${h} rounded-xl`} />
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

export function inr(n: number): string {
  return `₹${Number(n.toFixed(0)).toLocaleString('en-IN')}`
}

export function AlertBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      className="rounded-xl px-5 py-4 flex items-start gap-3"
      style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.28)' }}
    >
      <Icon.Alert className="h-4 w-4 flex-none mt-0.5 text-danger" />
      <p className="t-body-sm flex-1 text-danger">{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-dim hover:text-ink" aria-label="Dismiss">
          <Icon.X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon: IconC, label, sub }: { icon: React.ComponentType<IconProps>; label: string; sub?: string }) {
  return (
    <div className="card text-center py-10 flex flex-col items-center gap-2">
      <IconC className="h-6 w-6 text-dim" />
      <p className="t-body-sm text-dim">{label}</p>
      {sub && <p className="t-data text-dim">{sub}</p>}
    </div>
  )
}

export function StatCard({
  label, value, sub, tone,
}: { label: string; value: string | number; sub: string; tone?: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-brand'
  return (
    <div className="stat-card flex flex-col gap-1.5">
      <p className="t-label text-dim">{label}</p>
      <p className={`t-display ${color}`} style={{ fontWeight: 700, fontSize: 32 }}>{value}</p>
      <p className="t-data text-dim">{sub}</p>
    </div>
  )
}

export function PageHeader({
  title, subtitle, onRefresh, rightSlot,
}: { title: string; subtitle?: string; onRefresh?: () => void; rightSlot?: ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="t-h1">{title}</h1>
        {subtitle && <p className="t-body-sm mt-1 text-dim">{subtitle}</p>}
      </div>
      {rightSlot ?? (onRefresh ? (
        <button type="button" className="btn btn-quiet flex items-center gap-2" onClick={onRefresh}>
          <Icon.Refresh className="h-4 w-4" /> Refresh
        </button>
      ) : null)}
    </div>
  )
}
