/**
 * Escalations — the demo-money screen.
 *
 * Two panels:
 *  1. Live sweep table — every request currently in flight with its tier badge
 *     and SLA bar. Overdue rows glow red.
 *  2. Routing explainer — type a complaint, pick a time, get the full
 *     plain-English walkthrough of how the engine would route it.
 *     The "2AM noise complaint" demo hits the most interesting paths.
 */
import { useCallback, useEffect, useState } from 'react'
import { explainRouting, getEscalations, type EscalationItem } from '../lib/api'
import { AlertBanner, Chip, EmptyState, Icon, PageHeader, Skeleton, type Tone } from '../components/ui'

const STATE_TONE: Record<string, Tone> = {
  on_track: 'success', at_risk: 'warning', breached: 'danger', closed: 'neutral',
}

const DEMO_SCENARIOS = [
  { label: '2AM noise complaint',   title: 'Noisy neighbours',  category: 'COMPLAINT', at: '02:00' },
  { label: 'Noon towel request',    title: 'Extra towels',      category: 'HOUSEKEEPING', at: '12:00' },
  { label: '3PM maintenance fault', title: 'AC not working',   category: 'MAINTENANCE', at: '15:00' },
  { label: '11PM urgent complaint', title: 'Water leaking',    category: 'COMPLAINT', at: '23:30' },
]

export default function Escalations() {
  const [items, setItems]     = useState<EscalationItem[]>([])
  const [meta, setMeta]     = useState<{ breached: number; at_risk: number; night_shift: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Explainer state
  const [title, setTitle]         = useState('Noisy neighbours')
  const [category, setCategory]   = useState('COMPLAINT')
  const [at, setAt]             = useState('02:00')
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState<Record<string, unknown> | null>(null)
  const [explainErr, setExplainErr]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await getEscalations()
      setItems(r.items)
      setMeta({ breached: r.breached, at_risk: r.at_risk, night_shift: r.night_shift })
    } catch { setError('Could not load escalations.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function explain() {
    setExplaining(true); setExplanation(null); setExplainErr(null)
    try {
      const r = await explainRouting(title, category, at)
      setExplanation(r)
    } catch (e: unknown) {
      setExplainErr(e instanceof Error ? e.message : 'Explanation failed')
    }
    setExplaining(false)
  }

  function pickScenario(s: typeof DEMO_SCENARIOS[0]) {
    setTitle(s.title); setCategory(s.category); setAt(s.at)
    setExplanation(null); setExplainErr(null)
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Escalations"
        subtitle="Live SLA queue with tier routing and the routing explainer"
        rightSlot={
          meta?.night_shift ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <Icon.Moon className="h-4 w-4" style={{ color: '#818cf8' }} />
              <span className="t-body-sm" style={{ color: '#818cf8' }}>Night shift active</span>
            </div>
          ) : undefined
        }
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {/* Summary chips */}
      {meta && (
        <div className="flex gap-3">
          {meta.breached > 0 && <Chip tone="danger" live>{meta.breached} SLA breached</Chip>}
          {meta.at_risk  > 0 && <Chip tone="warning">{meta.at_risk} at risk</Chip>}
          {meta.breached === 0 && meta.at_risk === 0 && <Chip tone="success">All requests on track</Chip>}
        </div>
      )}

      {/* Live sweep table */}
      <section>
        <h2 className="t-h3 mb-4">Live queue</h2>
        {loading ? <Skeleton h="h-48" /> : null}
        {!loading && items.length === 0 && !error ? (
          <EmptyState icon={Icon.Check} label="Queue is clear." />
        ) : null}
        {!loading && items.length > 0 ? (
          <div className="card overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th>Request</th><th>Room</th><th>Tier</th><th>State</th><th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.code} className={item.state === 'breached' ? 'bg-danger-10' : undefined}>
                    <td>
                      <p className="t-body-sm font-semibold">{item.title}</p>
                      <p className="t-data mt-0.5 text-dim">{item.code}</p>
                    </td>
                    <td className="t-body-sm">{item.room ?? '—'}</td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="t-label font-semibold text-dim">Tier {item.tier}</span>
                        <span className="t-data text-dim">{item.tier_role}</span>
                      </div>
                    </td>
                    <td>
                      <Chip tone={STATE_TONE[item.state] ?? 'neutral'} live={item.state === 'breached'}>
                        {(item.state as string).replace('_', ' ')}
                      </Chip>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1.5" style={{ minWidth: 100 }}>
                        <span className="t-data" style={{
                          color: item.state === 'breached' ? 'var(--color-danger)'
                            : item.state === 'at_risk' ? 'var(--color-warning)'
                            : 'var(--color-ink-dim)',
                        }}>
                          {item.state === 'breached' ? 'Overdue' : `${Math.max(0, item.remaining_minutes)}m left`}
                        </span>
                        <div className={`track${item.state === 'breached' ? ' track-danger' : item.state === 'at_risk' ? ' track-warning' : ''}`}>
                          <span style={{ width: `${Math.max(2, 100 - item.percent_used)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {/* Routing explainer */}
      <section>
        <h2 className="t-h3 mb-1">Routing explainer</h2>
        <p className="t-body-sm mb-5 text-dim">
          See exactly how the SLA engine classifies any request at any time of day.
        </p>

        {/* Scenario quick picks */}
        <div className="flex gap-2 flex-wrap mb-5">
          {DEMO_SCENARIOS.map(s => (
            <button
              key={s.label}
              type="button"
              className={`btn btn-ghost ${title === s.title ? 'btn-ghost' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                background: title === s.title ? 'var(--color-raised)' : undefined,
              }}
              onClick={() => pickScenario(s)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-2">
              <span className="t-label text-dim">Complaint title</span>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="t-label text-dim">Category</span>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                {['COMPLAINT','HOUSEKEEPING','MAINTENANCE','ROOM_SERVICE','CONCIERGE','FRONT_DESK'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="t-label text-dim">Time of day</span>
              <input className="input" type="time" value={at} onChange={e => setAt(e.target.value)} />
            </label>
          </div>

          <button type="button" className="btn btn-primary self-start flex items-center gap-2"
            disabled={explaining} onClick={explain}>
            <Icon.Info className="h-4 w-4" />
            {explaining ? 'Explaining…' : 'Explain routing'}
          </button>

          {explainErr && <p className="t-body-sm text-danger">{explainErr}</p>}
          {explanation && <ExplainResult data={explanation} />}
        </div>
      </section>
    </div>
  )
}

function ExplainResult({ data }: { data: Record<string, unknown> }) {
  const steps = data.steps as string[] | undefined
  return (
    <div className="flex flex-col gap-4 pt-2" style={{ borderTop: '1px solid var(--color-hair)' }}>
      <div className="flex flex-wrap gap-3">
        {(['priority','department','sla_minutes','tier','tier_role','night'] as const).map(k => {
          const v = data[k]
          if (v === undefined || v === null) return null
          return (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="t-label text-dim" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {k.replace(/_/g, ' ')}
              </span>
              <span className="t-body-sm font-semibold">
                {typeof v === 'boolean' ? (v ? '🌙 Yes (night)' : 'No (day)') : String(v)}
              </span>
            </div>
          )
        })}
      </div>

      {steps && steps.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="t-label text-dim" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Engine walkthrough
          </p>
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="t-label flex-none rounded px-2 py-0.5 font-semibold"
                style={{ background: 'var(--color-inset)', color: 'var(--color-ink-dim)', minWidth: 24, textAlign: 'center' }}>
                {i + 1}
              </span>
              <p className="t-body-sm">{s}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
