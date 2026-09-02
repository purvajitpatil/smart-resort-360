import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getDailyBrief, getHotelOverview, getRevenue, getStaffLoad, listAllRequests,
  type DailyBrief, type HotelStats, type QueueStats, type RequestOut, type RevenueReport, type StaffLoad,
} from '../lib/api'
import { AlertBanner, Chip, Icon, PageHeader, Skeleton, StatCard, inr, priorityTone, statusTone, timeAgo } from '../components/ui'

export default function Dashboard() {
  const navigate = useNavigate()
  const [hotel, setHotel]     = useState<HotelStats | null>(null)
  const [reqs, setReqs]       = useState<RequestOut[]>([])
  const [stats, setStats]     = useState<QueueStats | null>(null)
  const [rev, setRev]         = useState<RevenueReport | null>(null)
  const [staffLoad, setStaffLoad] = useState<StaffLoad | null>(null)
  const [brief, setBrief]     = useState<DailyBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [h, r, v, l, b] = await Promise.all([
        getHotelOverview(), listAllRequests(), getRevenue(), getStaffLoad(), getDailyBrief(),
      ])
      setHotel(h); setReqs(r.items); setStats(r.stats); setRev(v); setStaffLoad(l); setBrief(b)
    } catch { setError('API unreachable — make sure the backend is running on port 8000.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const recent = reqs
    .filter(r => ['PENDING','ASSIGNED','IN_PROGRESS'].includes(r.status))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 8)

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title={hotel?.hotel.name ?? 'Hotel Overview'}
        subtitle={`${hotel?.hotel.city} · Live operations`}
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {!loading && brief ? (
        <section className="card" style={{ borderColor: 'rgba(79,70,229,0.28)', background: 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(16,185,129,0.07))' }}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="t-label text-brand">DAILY INTELLIGENCE BRIEF</p>
              <h2 className="t-h3 mt-1">What needs attention now</h2>
            </div>
            <Chip tone="brand">Live signals</Chip>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {brief.actions.map((action) => (
              <button
                key={action.title}
                type="button"
                className="text-left rounded-xl p-4 transition-colors hover:bg-white/10"
                style={{ border: '1px solid var(--color-hair)' }}
                onClick={() => navigate(action.route)}
              >
                <div className="flex items-center gap-2">
                  <Chip tone={action.priority === 'CRITICAL' ? 'danger' : action.priority === 'HIGH' ? 'warning' : action.priority === 'MEDIUM' ? 'brand' : 'neutral'}>
                    {action.priority}
                  </Chip>
                  <p className="t-body-sm font-semibold">{action.title}</p>
                </div>
                <p className="t-body-sm mt-2 text-dim">{action.reason}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          [1,2,3,4].map(i => <Skeleton key={i} h="h-28" />)
        ) : (
          <>
            <StatCard label="Occupancy" value={`${hotel?.occupancy_pct ?? 0}%`} sub={`${hotel?.rooms.occupied ?? 0} / ${hotel?.rooms.total ?? 0} rooms`} />
            <StatCard label="Open requests" value={stats?.pending ?? 0} sub={`${stats?.in_progress ?? 0} in progress`} tone={stats && stats.pending > 5 ? 'warn' : 'ok'} />
            <StatCard label="Overdue" value={stats?.overdue ?? 0} sub="SLA breached" tone={stats && stats.overdue > 0 ? 'danger' : 'ok'} />
            <StatCard label="Check-ins today" value={hotel?.checkins_today ?? 0} sub={`${hotel?.checkouts_today ?? 0} check-outs`} />
          </>
        )}
      </div>

      {/* Room status strip */}
      {!loading && hotel ? (
        <section>
          <h2 className="t-h3 mb-4">Room status</h2>
          <div className="flex gap-3 flex-wrap">
            {([
              ['Clean',       hotel.rooms.clean,       'success'],
              ['Occupied',    hotel.rooms.occupied,    'brand'],
              ['Dirty',       hotel.rooms.dirty,       'warning'],
              ['Maintenance', hotel.rooms.maintenance, 'danger'],
            ] as [string, number, string][]).map(([label, count, tone]) => (
              <div key={label} className="stat-card flex items-center gap-4" style={{ minWidth: 140, flex: '1 1 140px' }}>
                <span className={`chip chip-${tone}`} style={{ fontSize: 22, lineHeight: 1, padding: '6px 12px', fontWeight: 700 }}>{count}</span>
                <span className="t-body-sm text-dim">{label}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Revenue + staffing snapshot */}
      {!loading && rev ? (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="t-h3">Live snapshot</h2>
            <Icon.Trend className="h-4 w-4 text-dim" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="ADR" value={inr(rev.adr)} sub="Average daily rate" />
            <StatCard label="Projected daily revenue" value={inr(rev.projected_daily_revenue)} sub={`${rev.active_stays} active stays`} />
            <StatCard label="Arrivals / departures" value={rev.arrivals_today} sub={`${rev.departures_today} out today`} />
            <StatCard label="Open across teams" value={staffLoad?.total_open ?? 0} sub={staffLoad && staffLoad.by_department.length > 0 ? `${staffLoad.by_department.length} departments` : 'No open requests'} tone={staffLoad && staffLoad.total_open > 5 ? 'warn' : 'ok'} />
          </div>
        </section>
      ) : null}

      {/* Recent open requests */}
      <section>
        <h2 className="t-h3 mb-4">Open requests</h2>
        {loading ? <Skeleton h="h-64" /> : recent.length === 0 ? (
          <div className="card text-center py-8">
            <Icon.Check className="h-7 w-7 mx-auto mb-2 text-dim" />
            <p className="t-body-sm text-dim">No open requests</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th>Request</th><th>Room</th><th>Priority</th><th>Status</th><th>Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => {
                  const { tone, label } = statusTone(r.status)
                  return (
                    <tr key={r.code}>
                      <td>
                        <p className="t-body-sm font-semibold">{r.title}</p>
                        <p className="t-data mt-0.5 text-dim">{r.code}</p>
                      </td>
                      <td className="t-body-sm">{r.room_number ?? '—'}</td>
                      <td><Chip tone={priorityTone(r.priority)}>{r.priority}</Chip></td>
                      <td><Chip tone={tone} live={r.status === 'IN_PROGRESS'}>{label}</Chip></td>
                      <td className="t-data text-dim">{timeAgo(r.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
