import { useCallback, useEffect, useState } from 'react'
import { listAllRequests, updateRequestStatus, type QueueStats, type RequestOut } from '../lib/api'
import { AlertBanner, Chip, EmptyState, Icon, PageHeader, Skeleton, priorityTone, statusTone, timeAgo } from '../components/ui'

const OPEN = new Set(['PENDING','ASSIGNED','IN_PROGRESS'])

export default function Requests() {
  const [all, setAll]         = useState<RequestOut[]>([])
  const [stats, setStats]     = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [acting, setActing]   = useState<string | null>(null)
  const [tab, setTab]         = useState<'open' | 'closed'>('open')
  const [toast, setToast]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await listAllRequests()
      setAll(r.items); setStats(r.stats)
    } catch { setError('Could not load requests.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function notify(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function act(code: string, action: 'assign' | 'start' | 'complete' | 'cancel') {
    setActing(code)
    try {
      const updated = await updateRequestStatus(code, action)
      setAll(prev => prev.map(r => r.code === code ? updated : r))
      notify(`${code} → ${updated.status}`)
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Action failed')
    }
    setActing(null)
  }

  const open   = all.filter(r => OPEN.has(r.status))
  const closed = all.filter(r => !OPEN.has(r.status))
  const visible = tab === 'open' ? open : closed

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Requests"
        subtitle="Live queue across all departments"
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {/* Queue summary */}
      {stats ? (
        <div className="flex gap-3 flex-wrap">
          {([
            ['Pending',     stats.pending,     'brand'],
            ['In progress', stats.in_progress, 'warning'],
            ['Overdue',     stats.overdue,     'danger'],
            ['Completed',   stats.completed,   'success'],
          ] as [string, number, string][]).map(([label, n, tone]) => (
            <div key={label} className="stat-card flex items-center gap-3" style={{ flex: '1 1 120px', minWidth: 120, padding: '12px 16px' }}>
              <span className={`chip chip-${tone}`} style={{ fontSize: 18, padding: '4px 10px', fontWeight: 700 }}>{n}</span>
              <span className="t-body-sm text-dim">{label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="tab-bar">
        {(['open','closed'] as const).map(t => (
          <button
            key={t}
            type="button"
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'open' ? `Open (${open.length})` : `Done (${closed.length})`}
          </button>
        ))}
      </div>

      {loading ? <Skeleton h="h-96" /> : null}

      {!loading && visible.length === 0 ? (
        <EmptyState
          icon={Icon.Check}
          label={tab === 'open' ? 'No open requests right now.' : 'No completed requests yet.'}
        />
      ) : null}

      {!loading ? (
        <div className="flex flex-col gap-3">
          {visible.map(req => (
            <RequestRow
              key={req.code}
              req={req}
              acting={acting === req.code}
              onAct={(a) => act(req.code, a)}
            />
          ))}
        </div>
      ) : null}

      {toast ? (
        <div className="glass fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-hair)' }}>
          <p className="t-body-sm">{toast}</p>
        </div>
      ) : null}
    </div>
  )
}

function RequestRow({ req, acting, onAct }: { req: RequestOut; acting: boolean; onAct: (a: 'assign' | 'start' | 'complete' | 'cancel') => void }) {
  const { tone, label } = statusTone(req.status)
  const isOpen = OPEN.has(req.status)
  const nextAction: ['assign' | 'start' | 'complete', string] | null =
    req.status === 'PENDING'     ? ['assign',   'Assign']   :
    req.status === 'ASSIGNED'    ? ['start',    'Start']    :
    req.status === 'IN_PROGRESS' ? ['complete', 'Complete'] : null

  const slaPct = (() => {
    if (!req.sla_deadline || !req.sla_minutes) return null
    const total = req.sla_minutes * 60_000
    const remaining = new Date(req.sla_deadline).getTime() - Date.now()
    return Math.max(0, Math.min(100, (remaining / total) * 100))
  })()

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="t-body-sm font-semibold">{req.title}</p>
            {req.ai_created && <span className="chip chip-brand" style={{ fontSize: 10 }}>AI</span>}
            {req.sla_overdue && <span className="chip chip-danger chip-live" style={{ fontSize: 10 }}>SLA breached</span>}
          </div>
          <p className="t-data mt-1 text-dim">
            {req.code} · Room {req.room_number ?? '—'} · {req.guest_name}
            {req.department ? ` · ${req.department}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip tone={priorityTone(req.priority)}>{req.priority}</Chip>
          <Chip tone={tone} live={req.status === 'IN_PROGRESS'}>{label}</Chip>
          <span className="t-data text-dim">{timeAgo(req.created_at)}</span>
        </div>
      </div>

      {/* SLA track */}
      {isOpen && slaPct !== null ? (
        <div className="px-4 pb-3">
          <div className={`track${slaPct < 25 ? ' track-danger' : slaPct < 50 ? ' track-warning' : ''}`}>
            <span style={{ width: `${Math.max(2, slaPct)}%` }} />
          </div>
        </div>
      ) : null}

      {/* Actions */}
      {isOpen ? (
        <div className="hair-t flex items-center gap-2 px-4 py-2.5">
          {nextAction ? (
            <button type="button" className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 13 }}
              disabled={acting} onClick={() => onAct(nextAction[0])}>
              {acting ? '…' : nextAction[1]}
            </button>
          ) : null}
          <button type="button" className="btn btn-danger" style={{ padding: '5px 14px', fontSize: 13 }}
            disabled={acting} onClick={() => onAct('cancel')}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  )
}
