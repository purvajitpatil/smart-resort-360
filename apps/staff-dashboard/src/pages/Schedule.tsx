/**
 * Staff Schedule — weekly roster, coverage gaps, and occupancy-based staffing forecast.
 *
 * Covers:
 * - 7-day roster grid: per-department per-shift per-day staff assignments
 * - Coverage gap analysis: where the roster is understaffed relative to predicted occupancy
 * - 7-day occupancy forecast with staffing band
 * - AI staffing recommendations per gap
 */
import { useCallback, useEffect, useState } from 'react'
import { getCoverageGaps, getOccupancyForecast, getScheduleInsight, getScheduleRoster, type CoverageGap, type ForecastDay, type ScheduleInsight, type ScheduleRoster } from '../lib/api'
import { AlertBanner, Chip, Icon, PageHeader, Skeleton } from '../components/ui'

const SHIFT_ORDER = ['Morning', 'Evening', 'Night']

function coverageLabel(gap: number) {
  if (gap === 0) return { tone: 'success' as const, text: '✓' }
  if (gap >= 3)  return { tone: 'danger'  as const, text: `-${gap}` }
  if (gap === 2) return { tone: 'warning' as const, text: `-${gap}` }
  return             { tone: 'neutral'  as const, text: `-${gap}` }
}

export default function Schedule() {
  const [roster, setRoster] = useState<ScheduleRoster | null>(null)
  const [gaps, setGaps]     = useState<CoverageGap[]>([])
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [insight, setInsight] = useState<ScheduleInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]    = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'roster' | 'gaps' | 'forecast'>('roster')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [r, g, f, i] = await Promise.all([
        getScheduleRoster(), getCoverageGaps(), getOccupancyForecast(7), getScheduleInsight(),
      ])
      setRoster(r); setGaps(g.items); setForecast(f.items); setInsight(i)
    } catch {
      setError('API unreachable — make sure the backend is running on port 8000.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Staff Schedule"
        subtitle="Weekly roster, coverage gaps, and occupancy-based staffing forecast"
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {loading ? <Skeleton h="h-64" /> : insight && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Total gaps</p>
              <p className="t-display" style={{ fontWeight: 700, fontSize: 32, color: insight.total_gaps > 20 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {insight.total_gaps}
              </p>
              <p className="t-data text-dim">across 7 days</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Critical</p>
              <p className="t-display text-danger" style={{ fontWeight: 700, fontSize: 32 }}>
                {insight.critical_gaps}
              </p>
              <p className="t-data text-dim">3+ staff short</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Avg occupancy 7d</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {insight.avg_forecast_occupancy_7d?.toFixed(0) ?? '—'}%
              </p>
              <p className="t-data text-dim">forecasted</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Peak day</p>
              <p className="t-body-sm font-semibold text-brand">
                {insight.peak_day ? new Date(insight.peak_day).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
              </p>
              <p className="t-data text-dim">
                {insight.peak_occupancy_pct ? `${insight.peak_occupancy_pct}% occ` : ''}
              </p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Staff on roster</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {roster?.total_staff ?? 0}
              </p>
              <p className="t-data text-dim">total deployed</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="tab-bar">
            {(['roster', 'gaps', 'forecast'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              >
                {tab === 'roster' ? 'Roster' : tab === 'gaps' ? `Gaps (${gaps.length})` : 'Forecast'}
              </button>
            ))}
          </div>

          {/* Roster grid */}
          {activeTab === 'roster' && roster && (
            <RosterGrid roster={roster} />
          )}

          {/* Coverage gaps */}
          {activeTab === 'gaps' && (
            <GapsTable gaps={gaps} />
          )}

          {/* Occupancy forecast */}
          {activeTab === 'forecast' && (
            <ForecastView forecast={forecast} />
          )}
        </>
      )}
    </div>
  )
}

// ── Roster grid ──────────────────────────────────────────────────────────────

function RosterGrid({ roster }: { roster: ScheduleRoster }) {
  const shifts = SHIFT_ORDER

  return (
    <div className="card overflow-x-auto">
      <p className="t-label px-5 pt-4 pb-2 text-dim">
        {roster.start_date} → {roster.end_date} · {roster.total_staff} staff on roster
      </p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-3 pb-2 sticky left-0" style={{ background: 'var(--color-card)', minWidth: 120 }}>Department</th>
              {roster.days.map((d) => (
                <th key={d.date} className="px-2 pb-2 text-center min-w-[140px]">
                  <p className={`t-label ${d.is_today ? 'font-bold' : ''}`} style={{ color: d.is_today ? 'var(--color-tint)' : 'var(--color-ink-muted)' }}>
                    {d.day_of_week.slice(0, 3)}
                  </p>
                  <p className="t-label text-dim" style={{ fontSize: 11 }}>
                    {d.date.slice(5)}
                  </p>
                  {d.is_weekend && <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded text-warning" style={{ background: 'rgba(245,158,11,0.1)' }}>weekend</span>}
                  <div className="mt-1 track h-1 w-full">
                    <span style={{ width: `${Math.min(d.occupancy_pct, 100)}%`, background: d.occupancy_pct >= 85 ? '#ef4444' : d.occupancy_pct >= 60 ? '#f59e0b' : 'var(--color-tint)' }} />
                  </div>
                  <p className="t-label mt-0.5 text-dim" style={{ fontSize: 10 }}>{d.occupancy_pct}%</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.days[0]?.departments.map((dept) => (
              <tr key={dept.department}>
                <td className="px-3 py-2 sticky left-0" style={{ background: 'var(--color-card)' }}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: dept.color }} />
                    <p className="t-body-sm font-medium">{dept.department}</p>
                  </div>
                </td>
                {roster.days.map((d) => {
                  const dayDept = d.departments.find((dd) => dd.department === dept.department)
                  return (
                    <td key={d.date} className="px-1 py-2 text-center border-l" style={{ borderColor: 'var(--color-hair)' }}>
                      {shifts.map((shiftName) => {
                        const shift = dayDept?.shifts.find((s) => s.shift === shiftName)
                        const cov = shift ? coverageLabel(shift.gap) : { tone: 'neutral' as const, text: '?' }
                        return (
                          <div key={shiftName} className="flex items-center justify-center gap-1 py-0.5">
                            <span className="t-label text-dim" style={{ fontSize: 9 }}>{shiftName[0]}</span>
                            <Chip tone={cov.tone}>{cov.text}</Chip>
                            <span className="t-data text-dim" style={{ fontSize: 10 }}>
                              {shift?.available ?? 0}/{shift?.needed ?? 0}
                            </span>
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 px-5 pb-4 mt-2">
        <div className="flex items-center gap-1"><Chip tone="success">✓</Chip><span className="t-data">Adequate</span></div>
        <div className="flex items-center gap-1"><Chip tone="neutral">-1</Chip><span className="t-data">1 short</span></div>
        <div className="flex items-center gap-1"><Chip tone="warning">-2</Chip><span className="t-data">2 short</span></div>
        <div className="flex items-center gap-1"><Chip tone="danger">-3</Chip><span className="t-data">3+ short</span></div>
      </div>
    </div>
  )
}

// ── Coverage gaps table ─────────────────────────────────────────────────────

function GapsTable({ gaps }: { gaps: CoverageGap[] }) {
  if (gaps.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="t-body-sm text-success">✓ No coverage gaps — all shifts are adequately staffed for the forecasted occupancy.</p>
      </div>
    )
  }

  const severity = (s: string) => ({ CRITICAL: 'danger', HIGH: 'danger', MEDIUM: 'warning' }[s] ?? 'neutral') as 'danger' | 'warning' | 'neutral'

  return (
    <div className="card overflow-x-auto">
      <p className="t-label px-5 pt-4 pb-2 text-dim">
        {gaps.length} gap{gaps.length !== 1 ? 's' : ''} detected across the week
      </p>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left px-4 py-2 t-label text-muted">Date</th>
            <th className="text-left px-4 py-2 t-label text-muted">Dept</th>
            <th className="text-left px-4 py-2 t-label text-muted">Shift</th>
            <th className="text-center px-4 py-2 t-label text-muted">Have</th>
            <th className="text-center px-4 py-2 t-label text-muted">Need</th>
            <th className="text-center px-4 py-2 t-label text-muted">Gap</th>
            <th className="text-left px-4 py-2 t-label text-muted">AI Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((g, i) => (
            <tr key={i} className="border-t" style={{ borderColor: 'var(--color-hair)' }}>
              <td className="px-4 py-3">
                <p className="t-body-sm font-medium">{g.day_of_week.slice(0, 3)} {g.date.slice(5)}</p>
                <p className="t-data text-dim">{g.occupancy_pct}% occ</p>
              </td>
              <td className="px-4 py-3">
                <p className="t-body-sm font-medium">{g.department}</p>
              </td>
              <td className="px-4 py-3">
                <p className="t-body-sm">{g.shift}</p>
              </td>
              <td className="px-4 py-3 text-center">
                <p className="t-body-sm">{g.available}</p>
              </td>
              <td className="px-4 py-3 text-center">
                <p className="t-body-sm">{g.needed}</p>
              </td>
              <td className="px-4 py-3 text-center">
                <Chip tone={severity(g.severity)}>{g.gap}</Chip>
              </td>
              <td className="px-4 py-3">
                <p className="t-data text-muted">{g.recommendation}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Occupancy forecast ──────────────────────────────────────────────────────

function ForecastView({ forecast }: { forecast: ForecastDay[] }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Bar chart */}
      <div className="card p-6">
        <h3 className="t-h3 mb-4">7-day occupancy forecast</h3>
        <div className="flex items-end gap-2" style={{ height: 180 }}>
          {forecast.map((f) => (
            <div key={f.date} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg transition-all"
                style={{
                  height: `${Math.max((f.predicted_occupancy_pct / 100) * 160, f.is_weekend ? 20 : 8)}px`,
                  background: f.predicted_occupancy_pct >= 85 ? '#ef4444' : f.predicted_occupancy_pct >= 60 ? '#f59e0b' : 'var(--color-tint)',
                  opacity: f.is_weekend ? 1 : 0.75,
                }}
                title={`${f.predicted_occupancy_pct}% occupancy`}
              />
              <p className="t-label" style={{ color: f.is_weekend ? 'var(--color-tint)' : 'var(--color-ink-dim)', fontSize: 11 }}>{f.day_of_week}</p>
              <p className="t-label text-dim" style={{ fontSize: 10 }}>{f.date.slice(5)}</p>
              <p className="t-body-sm font-semibold">{f.predicted_occupancy_pct}%</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm" style={{ background: 'var(--color-tint)' }} /><span className="t-data">Weekday</span></div>
          <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm" style={{ background: 'var(--color-tint)', opacity: 1 }} /><span className="t-data">Weekend</span></div>
          <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm text-warning" style={{ background: '#f59e0b' }} /><span className="t-data">60–85%</span></div>
          <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm text-danger" style={{ background: '#ef4444' }} /><span className="t-data">&gt;85%</span></div>
        </div>
      </div>

      {/* Forecast table */}
      <div className="card overflow-x-auto">
        <p className="t-label px-5 pt-4 pb-2 text-dim">Day-by-day staffing numbers</p>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-4 py-2 t-label text-muted">Date</th>
              <th className="text-left px-4 py-2 t-label text-muted">Day</th>
              <th className="text-center px-4 py-2 t-label text-muted">Predicted occ.</th>
              <th className="text-center px-4 py-2 t-label text-muted">Staff needed</th>
              <th className="text-center px-4 py-2 t-label text-muted">Band</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((f) => (
              <tr key={f.date} className="border-t" style={{ borderColor: 'var(--color-hair)' }}>
                <td className="px-4 py-3"><p className="t-body-sm">{f.date}</p></td>
                <td className="px-4 py-3">
                  <p className="t-body-sm font-medium">{f.day_of_week}</p>
                  {f.is_weekend && <span className="t-label text-warning">Weekend</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="track w-16 h-1.5">
                      <span style={{ width: `${f.predicted_occupancy_pct}%`, background: f.predicted_occupancy_pct >= 85 ? '#ef4444' : f.predicted_occupancy_pct >= 60 ? '#f59e0b' : 'var(--color-tint)' }} />
                    </div>
                    <span className="t-body-sm">{f.predicted_occupancy_pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <p className="t-body-sm">{f.staffing_needed_total}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <Chip tone={f.band === 'HIGH' ? 'danger' : f.band === 'MEDIUM' ? 'warning' : 'neutral'}>{f.band}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Factor explainer */}
      <section>
        <h3 className="t-h3 mb-3">How the forecast works</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="t-body-sm font-semibold">Booked rooms</p>
            <p className="t-data mt-1 text-dim">Active or future stays whose check-in ≤ date ≤ check-out count as a base floor.</p>
          </div>
          <div className="card p-4">
            <p className="t-body-sm font-semibold">Day-of-week boost</p>
            <p className="t-data mt-1 text-dim">Fri/Sat +12%, Sun +6% on top of the booked baseline.</p>
          </div>
          <div className="card p-4">
            <p className="t-body-sm font-semibold">Historical blend</p>
            <p className="t-data mt-1 text-dim">Last 30 days of stays are averaged by day-of-week. 40% historical / 60% current booked.</p>
          </div>
          <div className="card p-4">
            <p className="t-body-sm font-semibold">Staffing formula</p>
            <p className="t-data mt-1 text-dim">needed = ceil(occupancy% ÷ coverage_factor). Night shift is 60% of day shift.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
