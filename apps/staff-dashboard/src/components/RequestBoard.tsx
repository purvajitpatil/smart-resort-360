import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '../lib/api'

type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

interface RequestItem {
  id: number
  code: string
  category: string
  title: string
  description: string | null
  quantity: number
  priority: Priority
  status: string
  room_number: string | null
  guest_name: string | null
  department: string | null
  assigned_to: string | null
  sla_deadline: string | null
  sla_overdue: boolean
  created_at: string
}

interface QueueStats {
  by_status: Record<string, number>
  by_priority: Record<string, number>
  overdue_count: number
  open_count: number
}

const STATUS_TABS = ['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
type StatusTab = (typeof STATUS_TABS)[number]

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  ASSIGNED: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-ink-muted/25 bg-ink-muted/10 text-ink-muted',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
}

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: 'border-ink-muted/30 bg-bg text-ink-muted',
  MEDIUM: 'border-brand/30 bg-brand/10 text-brand',
  HIGH: 'border-red-200 bg-red-50 text-red-700',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[status] ?? STATUS_BADGE.PENDING}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[priority]}`}>
      {priority}
    </span>
  )
}

function formatSla(deadline: string) {
  return new Date(deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function RequestBoard() {
  const [items, setItems] = useState<RequestItem[]>([])
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [tab, setTab] = useState<StatusTab>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCode, setBusyCode] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [list, queueStats] = await Promise.all([
        api<{ items: RequestItem[]; total: number }>(`/requests${tab === 'ALL' ? '' : `?status=${tab}`}`),
        api<QueueStats>('/requests/queue/stats'),
      ])
      setItems(list.items)
      setStats(queueStats)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load the request board.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    void load()
  }, [load])

  async function act(code: string, fn: () => Promise<unknown>) {
    setBusyCode(code)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request action failed.')
    } finally {
      setBusyCode(null)
    }
  }

  const assign = (code: string) => act(code, () => api(`/requests/${code}/assign`, { method: 'PATCH' }))
  const start = (code: string) =>
    act(code, () =>
      api(`/requests/${code}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      }),
    )
  const complete = (code: string) =>
    act(code, () =>
      api(`/requests/${code}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      }),
    )
  const cancel = (code: string) =>
    act(code, () =>
      api(`/requests/${code}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      }),
    )

  const openCount = stats?.open_count ?? 0

  return (
    <section className="rounded-xl border border-ink/10 bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Service request board</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {stats
              ? `${openCount} open · ${stats.overdue_count} past SLA · ${stats.by_priority.HIGH ?? 0} high priority`
              : 'Loading queue…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                tab === t
                  ? 'border-brand bg-brand text-white'
                  : 'border-ink/15 bg-bg text-ink-muted hover:border-brand/40 hover:text-brand'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && items.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">Loading requests…</p>
        )}

        {!loading && items.length === 0 && !error && (
          <p className="py-8 text-center text-sm text-ink-muted">No requests in this state.</p>
        )}

        <ul className="space-y-2.5">
          {items.map((r) => (
            <li
              key={r.code}
              className={`rounded-lg border px-4 py-3 ${r.sla_overdue && r.status !== 'COMPLETED' && r.status !== 'CANCELLED' ? 'border-red-200 bg-red-50/40' : 'border-ink/10 bg-bg'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-muted">{r.code}</span>
                    <h3 className="text-sm font-semibold text-ink">{r.title}</h3>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {r.guest_name ?? 'Unknown guest'} · Room {r.room_number ?? '—'} · {r.category}
                    {r.department ? ` · ${r.department}` : ''}
                    {r.assigned_to ? ` · Assigned ${r.assigned_to}` : ''}
                    {r.quantity > 1 ? ` · Qty ${r.quantity}` : ''}
                  </p>
                  {r.description && (
                    <p className="mt-1 max-w-xl truncate text-xs text-ink-muted">{r.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <PriorityBadge priority={r.priority} />
                  <StatusBadge status={r.status} />
                  {r.sla_deadline && r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && (
                    <span
                      className={`text-xs ${r.sla_overdue ? 'font-semibold text-red-600' : 'text-ink-muted'}`}
                    >
                      SLA {formatSla(r.sla_deadline)}
                      {r.sla_overdue ? ' · overdue' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {(r.status === 'PENDING' || r.status === 'ASSIGNED') && (
                  <button
                    type="button"
                    disabled={busyCode === r.code}
                    onClick={() => void assign(r.code)}
                    className="rounded-md border border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50"
                  >
                    {r.status === 'PENDING' ? 'Assign to me' : 'Reassign'}
                  </button>
                )}
                {r.status === 'ASSIGNED' && (
                  <button
                    type="button"
                    disabled={busyCode === r.code}
                    onClick={() => void start(r.code)}
                    className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                  >
                    Start
                  </button>
                )}
                {(r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS') && (
                  <button
                    type="button"
                    disabled={busyCode === r.code}
                    onClick={() => void complete(r.code)}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
                {r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && (
                  <button
                    type="button"
                    disabled={busyCode === r.code}
                    onClick={() => void cancel(r.code)}
                    className="rounded-md border border-ink/15 bg-bg px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}