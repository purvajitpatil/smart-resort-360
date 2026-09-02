/**
 * Dynamic Pricing — rate calendar + rate simulator.
 *
 * Surfaces the rules engine: every rate cell links to the occupancy %, weekend
 * premium, seasonal factor, and lead-time factor that produced it. The
 * simulator below lets the GM model "what if I push this rate" with the
 * projected occupancy and revenue impact.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPricingInsight, getRateCalendar, simulateRate, type PricingInsight, type RateDay, type RateSimResult } from '../lib/api'
import { AlertBanner, Chip, Icon, inr, PageHeader, Skeleton } from '../components/ui'

function factorLabel(pct: number): { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string } {
  if (pct > 15) return { tone: 'danger', label: `+${pct}%` }
  if (pct > 5) return { tone: 'warning', label: `+${pct}%` }
  if (pct < -5) return { tone: 'success', label: `${pct}%` }
  return { tone: 'neutral', label: `${pct >= 0 ? '+' : ''}${pct}%` }
}

export default function Pricing() {
  const [cal, setCal] = useState<RateDay[]>([])
  const [insight, setInsight] = useState<PricingInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Simulator state
  const [simRoomType, setSimRoomType] = useState<string>('Deluxe')
  const [simCurrentOcc, setSimCurrentOcc] = useState<number>(70)
  const [simBase, setSimBase] = useState<number>(5000)
  const [simProposed, setSimProposed] = useState<number>(5500)
  const [simResult, setSimResult] = useState<RateSimResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [c, i] = await Promise.all([getRateCalendar(14), getPricingInsight()])
      setCal(c.items)
      setInsight(i)
      // Set simulator baseline to today's rate
      if (c.items.length > 0 && Object.keys(c.items[0].rates_by_type).length > 0) {
        const firstType = Object.keys(c.items[0].rates_by_type)[0]
        setSimRoomType(firstType)
        setSimBase(c.items[0].rates_by_type[firstType].base_rate)
        setSimProposed(c.items[0].rates_by_type[firstType].rate)
      }
    } catch {
      setError('API unreachable — make sure the backend is running on port 8000.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const roomTypes = useMemo(() => {
    if (cal.length === 0) return []
    return Object.keys(cal[0].rates_by_type)
  }, [cal])

  const runSimulator = useCallback(async () => {
    setSimLoading(true)
    try {
      const r = await simulateRate({
        room_type: simRoomType, base_rate: simBase, proposed_rate: simProposed,
        current_occupancy_pct: simCurrentOcc,
      })
      setSimResult(r)
    } catch {
      setSimResult(null)
    } finally { setSimLoading(false) }
  }, [simRoomType, simBase, simProposed, simCurrentOcc])

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Dynamic Pricing"
        subtitle="AI-driven rates from occupancy, lead time, day-of-week, and Jaipur seasonality"
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {loading ? <Skeleton h="h-64" /> : insight && (
        <>
          {/* Top-line KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Avg occupancy (7d)</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {insight.average_occupancy_7d?.toFixed(1) ?? '—'}%
              </p>
              <p className="t-data text-dim">Forecast horizon</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Peak day</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 18 }}>
                {insight.peak_day ?? '—'}
              </p>
              <p className="t-data text-dim">Top projected occupancy</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Surge days</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {insight.surge_days.length}
              </p>
              <p className="t-data text-dim">{'>'}85% projected occupancy</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Rate engine</p>
              <p className="t-body-sm font-semibold text-success">Live</p>
              <p className="t-data text-dim">4 factors blended per night</p>
            </div>
          </div>

          {/* Rate calendar */}
          <section>
            <h2 className="t-h3 mb-3">Next 14 days — rate card</h2>
            <div className="card overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Occupancy</th>
                    {roomTypes.map(rt => <th key={rt}>{rt}</th>)}
                    <th>Signals</th>
                  </tr>
                </thead>
                <tbody>
                  {cal.map((d) => (
                    <tr key={d.date}>
                      <td>
                        <p className="t-body-sm font-semibold">{d.date.slice(5)}</p>
                        <p className="t-data text-dim">{d.day_of_week}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="track w-24">
                            <span style={{
                              width: `${Math.min(d.occupancy_pct, 100)}%`,
                              background: d.occupancy_pct >= 85 ? '#ef4444' : d.occupancy_pct >= 60 ? '#f59e0b' : 'var(--color-tint)',
                            }} />
                          </div>
                          <span className="t-body-sm">{d.occupancy_pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      {roomTypes.map(rt => {
                        const r = d.rates_by_type[rt]
                        const factor = factorLabel(r.pct_change)
                        return (
                          <td key={rt}>
                            <p className="t-body-sm font-semibold">{inr(r.rate)}</p>
                            <Chip tone={factor.tone}>{factor.label}</Chip>
                          </td>
                        )
                      })}
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {d.is_weekend && <Chip tone="warning">weekend</Chip>}
                          {d.seasonal_label && <Chip tone="brand">{d.seasonal_label}</Chip>}
                          {!d.is_weekend && !d.seasonal_label && <span className="t-data text-dim">—</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Rate simulator */}
          <section>
            <h2 className="t-h3 mb-3">Rate simulator</h2>
            <div className="card p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <p className="t-body-sm text-dim">
                  Model "what if I push this rate?" and see the projected occupancy + revenue impact.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="t-label">Room type</label>
                  <select className="input" value={simRoomType} onChange={(e) => setSimRoomType(e.target.value)}>
                    {roomTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="t-label">Current occupancy %</label>
                  <input type="number" className="input" min={0} max={100} value={simCurrentOcc}
                    onChange={(e) => setSimCurrentOcc(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="t-label">Base rate (₹)</label>
                    <input type="number" className="input" min={1} value={simBase}
                      onChange={(e) => setSimBase(Number(e.target.value))} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="t-label">Proposed rate (₹)</label>
                    <input type="number" className="input" min={1} value={simProposed}
                      onChange={(e) => setSimProposed(Number(e.target.value))} />
                  </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={runSimulator} disabled={simLoading}>
                  {simLoading ? 'Simulating…' : 'Run simulation'}
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {!simResult && (
                  <div className="rounded-xl p-6 text-center" style={{ background: 'var(--color-raised)' }}>
                    <p className="t-body-sm text-dim">
                      Set a rate and click "Run simulation" to see the impact.
                    </p>
                  </div>
                )}
                {simResult && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl p-4" style={{ background: 'var(--color-raised)' }}>
                        <p className="t-label text-dim">Projected occupancy</p>
                        <p className="t-display font-bold" style={{ fontSize: 28 }}>
                          {simResult.projected_occupancy_pct.toFixed(1)}%
                        </p>
                        <p className="t-data" style={{ color: simResult.occupancy_change_pp >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {simResult.occupancy_change_pp >= 0 ? '+' : ''}{simResult.occupancy_change_pp} pp
                        </p>
                      </div>
                      <div className="rounded-xl p-4" style={{ background: 'var(--color-raised)' }}>
                        <p className="t-label text-dim">Revenue impact</p>
                        <p className="t-display font-bold" style={{ fontSize: 28, color: simResult.revenue_impact_pct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {simResult.revenue_impact_pct >= 0 ? '+' : ''}{simResult.revenue_impact_pct}%
                        </p>
                        <p className="t-data text-dim">vs. base rate</p>
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <p className="t-label text-brand">AI recommendation</p>
                      <p className="t-body-sm mt-1">{simResult.recommendation}</p>
                    </div>
                    <p className="t-data text-dim">
                      Base {inr(simResult.base_rate)} → proposed {inr(simResult.proposed_rate)} at {simResult.current_occupancy_pct}% occupancy.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Factor explainer */}
          <section>
            <h2 className="t-h3 mb-3">How the engine works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FactorCard
                name="Occupancy"
                desc="Above 80% → premium (+20%). Above 90% → surge (+35%). Below 40% → discount (-15%)."
              />
              <FactorCard
                name="Lead time"
                desc="Last-minute (≤2 days) +10%. Advance (≥14 days) -10%. Deep advance (≥30 days) -15%."
              />
              <FactorCard
                name="Seasonality"
                desc="Jaipur Diwali (Oct-Nov) +30%, Dec peak +25%, summer (May-Jul) -15%."
              />
              <FactorCard
                name="Day of week"
                desc="Friday and Saturday +15%. Sunday +5%. Weekday base."
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function FactorCard({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="card p-4">
      <p className="t-body-sm font-semibold">{name}</p>
      <p className="t-data mt-1 text-dim">{desc}</p>
    </div>
  )
}
