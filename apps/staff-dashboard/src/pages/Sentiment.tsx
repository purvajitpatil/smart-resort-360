/**
 * Sentiment + Predictive maintenance — staff-facing signal page.
 */
import { useCallback, useEffect, useState } from 'react'
import { getMaintenanceAlerts, getSentiment, type MaintenanceAlert, type SentimentReport } from '../lib/api'
import { AlertBanner, Chip, EmptyState, Icon, PageHeader, Skeleton } from '../components/ui'

const CAT_COLOR: Record<string, string> = {
  FOOD: 'var(--color-success)',
  HOUSEKEEPING: 'var(--color-info)',
  MAINTENANCE: 'var(--color-warning)',
  CONCIERGE: '#7c3aed',
  FRONT_DESK: 'var(--color-info)',
  DEFAULT: 'var(--color-tint)',
}

function catColor(cat: string): string { return CAT_COLOR[cat.toUpperCase()] ?? CAT_COLOR.DEFAULT }
function pct(value: number): string { return `${Math.round(value * 100)}%` }

export default function Sentiment() {
  const [sent, setSent]      = useState<SentimentReport | null>(null)
  const [alerts, setAlerts]  = useState<MaintenanceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [s, a] = await Promise.all([getSentiment(), getMaintenanceAlerts()])
      setSent(s); setAlerts(a.alerts)
    } catch { setError('API unreachable — make sure the backend is running on port 8000.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Guest Sentiment"
        subtitle="Live ratings + predictive maintenance signals"
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {loading ? <Skeleton h="h-64" /> : sent && (
        <>
          {/* Overall + per-category */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="stat-card flex flex-col items-start justify-center gap-1">
              <p className="t-label text-dim">Overall rating</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {sent.overall.toFixed(1)}
              </p>
              <p className="t-data text-dim">{sent.total_rated} rated · {sent.window_days}d window</p>
            </div>
            {sent.by_category.map(c => (
              <div key={c.category} className="stat-card flex flex-col items-start justify-center gap-1">
                <p className="t-label text-dim">{c.category}</p>
                <p className="t-display" style={{ color: catColor(c.category), fontWeight: 700, fontSize: 32 }}>
                  {c.avg.toFixed(1)}
                  <span className="t-data text-dim" style={{ fontSize: 14, fontWeight: 400 }}> /5</span>
                </p>
                <p className="t-data text-dim">{c.rated} rating{c.rated !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>

          {/* Category comparison bars */}
          {sent.by_category.length > 0 && (
            <section>
              <h2 className="t-h3 mb-4">By department</h2>
              <div className="card p-5 flex flex-col gap-4">
                {sent.by_category.map(c => (
                  <div key={c.category} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="t-body-sm font-semibold">{c.category}</p>
                      <span className="t-data text-dim">{c.avg.toFixed(1)} / 5</span>
                    </div>
                    <div className="track w-full">
                      <span style={{ width: pct(c.avg / 5), background: catColor(c.category) }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Predictive maintenance */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="t-h3">Predictive maintenance</h2>
              {alerts.length > 0 && <Chip tone="danger" live>{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</Chip>}
            </div>
            {alerts.length === 0 ? (
              <EmptyState icon={Icon.Check} label="No fault patterns detected" />
            ) : (
              <div className="flex flex-col gap-4">
                {alerts.map((a, i) => (
                  <div key={i} className="card p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Chip tone={a.severity === 'HIGH' ? 'danger' : a.severity === 'MEDIUM' ? 'warning' : 'info'}>
                        {a.count}× {a.fault}
                      </Chip>
                      <span className="t-data text-dim">
                        <Icon.Clock className="h-3.5 w-3.5 inline mr-1" />{a.window_days} days
                      </span>
                    </div>
                    <p className="t-body-sm font-semibold">{a.alert}</p>
                    <div className="flex items-center gap-2">
                      <Icon.Alert className="h-4 w-4 flex-none text-brand" />
                      <p className="t-body-sm text-brand">Suggested: {a.action}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {a.request_codes.map(code => <Chip key={code} tone="neutral">{code}</Chip>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
