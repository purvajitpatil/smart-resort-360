/**
 * Revenue Intelligence — staff-facing revenue + staff-load view.
 *
 * Turns booking/occupancy data into the operating numbers the desk and GM
 * care about: ADR, projected daily revenue, arrivals/departures, and a
 * by-department load signal so staffing can follow demand.
 */
import { useCallback, useEffect, useState } from 'react'
import { getOccupancyForecast, getRevenue, getStaffLoad, type ForecastDay, type RevenueReport, type StaffLoad } from '../lib/api'
import { AlertBanner, Chip, Icon, inr, PageHeader, Skeleton } from '../components/ui'

export default function Revenue() {
  const [rev, setRev]       = useState<RevenueReport | null>(null)
  const [load, setLoad]     = useState<StaffLoad | null>(null)
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [r, l, f] = await Promise.all([getRevenue(), getStaffLoad(), getOccupancyForecast(7)])
      setRev(r); setLoad(l); setForecast(f.items)
    } catch { setError('API unreachable — make sure the backend is running on port 8000.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  const occupied = rev ? ((rev.occupied_rooms / rev.total_rooms) * 100).toFixed(1) : '0.0'

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Revenue Intelligence"
        subtitle="Occupancy · rates · projected revenue · staffing load"
        onRefresh={loadAll}
      />

      {error && <AlertBanner message={error} />}

      {loading ? <Skeleton h="h-48" /> : rev && (
        <>
          {/* Headline stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">ADR</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>{inr(rev.adr)}</p>
              <p className="t-data text-dim">Average daily rate</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Projected daily revenue</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>{inr(rev.projected_daily_revenue)}</p>
              <p className="t-data text-dim">{rev.active_stays} active stays</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Occupancy</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>{occupied}%</p>
              <p className="t-data text-dim">{rev.occupied_rooms} / {rev.total_rooms} rooms</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Arrivals / departures</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {rev.arrivals_today}<span className="t-data text-dim" style={{ fontSize: 14, fontWeight: 400 }}> / {rev.departures_today}</span>
              </p>
              <p className="t-data text-dim">{rev.upcoming_bookings} upcoming bookings</p>
            </div>
          </div>

          {/* Occupancy bar */}
          <section>
            <h2 className="t-h3 mb-3">Occupancy this evening</h2>
            <div className="card p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="t-body-sm text-dim">{rev.occupied_rooms} rooms occupied</span>
                <span className="t-body-sm font-semibold">{occupied}%</span>
              </div>
              <div className="track w-full">
                <span style={{ width: `${rev.occupancy_pct}%`, background: 'var(--color-tint)' }} />
              </div>
            </div>
          </section>

          {/* 7-day occupancy forecast */}
          {forecast.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="t-h3">7-day occupancy forecast</h2>
                <Chip tone="info">from scheduling engine</Chip>
              </div>
              <div className="card p-5">
                <div className="flex items-end gap-2" style={{ height: 140 }}>
                  {forecast.map((f) => (
                    <div key={f.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-lg"
                        style={{
                          height: `${Math.max((f.predicted_occupancy_pct / 100) * 110, f.is_weekend ? 16 : 6)}px`,
                          background: f.predicted_occupancy_pct >= 85 ? '#ef4444' : f.predicted_occupancy_pct >= 60 ? '#f59e0b' : 'var(--color-tint)',
                          opacity: f.is_weekend ? 1 : 0.7,
                        }}
                      />
                      <p className="t-label" style={{ color: f.is_weekend ? 'var(--color-tint)' : 'var(--color-ink-dim)', fontSize: 11 }}>{f.day_of_week.slice(0, 3)}</p>
                      <p className="t-body-sm font-semibold">{f.predicted_occupancy_pct}%</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm" style={{ background: 'var(--color-tint)', opacity: 0.7 }} /><span className="t-data">Weekday</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm" style={{ background: 'var(--color-tint)' }} /><span className="t-data">Weekend</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm text-warning" style={{ background: '#f59e0b' }} /><span className="t-data">60–85%</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-sm text-danger" style={{ background: '#ef4444' }} /><span className="t-data">&gt;85%</span></div>
                </div>
              </div>
            </section>
          )}

          {/* Staff load */}
          {load && load.by_department.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="t-h3">Staffing load by department</h2>
                <Chip tone={load.total_open > 0 ? 'warning' : 'success'} live={load.total_open > 0}>
                  {load.total_open} open
                </Chip>
              </div>
              <div className="card overflow-hidden">
                <table>
                  <thead><tr><th>Department</th><th>Open requests</th><th>Load</th></tr></thead>
                  <tbody>
                    {load.by_department.map((d) => {
                      const max = Math.max(1, ...load.by_department.map(x => x.open_requests))
                      const ratio = d.open_requests / max
                      return (
                        <tr key={d.department}>
                          <td className="t-body-sm font-semibold">{d.department}</td>
                          <td className="t-body-sm">{d.open_requests}</td>
                          <td>
                            <div className="track w-40" style={{ flexShrink: 0 }}>
                              <span style={{
                                width: `${Math.max(ratio * 100, d.open_requests > 0 ? 8 : 0)}%`,
                                background: d.open_requests === 0 ? 'var(--color-success)' : ratio > 0.7 ? 'var(--color-warning)' : 'var(--color-tint)',
                              }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
