/**
 * Guest Memory — staff-facing brief viewer.
 *
 * Staff look up a guest by their ID to see:
 *  - Prep actions generated from high-confidence memories
 *  - Cold-start suggestions for first-time guests
 *  - Raw memory list with confidence bars
 *
 * This is where the "feel like home" story becomes tangible for judges:
 * the same data that preps the room before the guest arrives.
 */
import { useState } from 'react'
import { getGuestBrief, type GuestBrief, type PrepAction } from '../lib/api'
import { AlertBanner, Chip, Icon, PageHeader, Skeleton } from '../components/ui'

const KIND_LABEL: Record<string, string> = { STATED: 'You told us', OBSERVED: 'We noticed', INFERRED: 'We guessed' }
const KIND_TONE: Record<string, string> = { STATED: 'success', OBSERVED: 'brand', INFERRED: 'neutral' }

const DEMO_GUESTS = [
  { label: 'Guest 1 (Priya)', id: 1 },
  { label: 'Guest 2 (Aarav)', id: 2 },
]

export default function MemoryPage() {
  const [guestId, setGuestId] = useState<number>(1)
  const [brief, setBrief]     = useState<GuestBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function load(id: number) {
    setLoading(true); setError(null); setBrief(null)
    try { setBrief(await getGuestBrief(id)) }
    catch (e: unknown) {
      setError(e instanceof Error ? e.message : `No brief for guest ${id}.`)
    }
    setLoading(false)
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Guest Memory"
        subtitle="Cross-stay preference engine · DPDP-compliant · Trust-tiered"
      />

      {/* Guest picker */}
      <div className="card p-5 flex flex-col gap-4">
        <p className="t-body-sm font-semibold">Look up a guest brief</p>
        <div className="flex gap-3 flex-wrap items-end">
          {/* Demo quick-picks */}
          <div className="flex gap-2">
            {DEMO_GUESTS.map(g => (
              <button key={g.id} type="button"
                className={`btn ${guestId === g.id ? 'btn-ghost' : 'btn-ghost'}`}
                style={{
                  fontSize: 13,
                  padding: '7px 14px',
                  background: guestId === g.id ? 'var(--color-raised)' : 'transparent',
                  border: `1px solid ${guestId === g.id ? 'rgba(79,70,229,0.6)' : 'var(--color-hair-strong)'}`,
                  color: guestId === g.id ? 'var(--color-tint)' : 'var(--color-ink-muted)',
                }}
                onClick={() => { setGuestId(g.id); void load(g.id) }}
              >{g.label}</button>
            ))}
          </div>
          {/* Guest ID input */}
          <label className="flex flex-col gap-1.5" style={{ minWidth: 120, maxWidth: 180 }}>
            <span className="t-label text-dim">Guest ID</span>
            <input className="input" type="number" min={1} value={guestId}
              onChange={e => setGuestId(Number(e.target.value))} />
          </label>
          <button type="button" className="btn btn-primary flex items-center gap-2"
            disabled={loading} onClick={() => void load(guestId)}>
            <Icon.Brain className="h-4 w-4" />
            {loading ? 'Loading…' : 'Load brief'}
          </button>
        </div>
      </div>

      {error && <AlertBanner message={error} />}
      {loading && <Skeleton h="h-48" />}

      {brief && !loading && (
        <div className="flex flex-col gap-6">
          {/* Guest header */}
          <div className="card p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full flex items-center justify-center flex-none text-xl font-bold"
              style={{ background: 'var(--color-raised)', color: 'var(--color-tint)' }}>
              {brief.guest.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="t-h3">{brief.guest.name}</p>
              <div className="flex gap-2 mt-1">
                {brief.returning_guest
                  ? <Chip tone="success">Returning guest</Chip>
                  : <Chip tone="neutral">First stay</Chip>
                }
                {brief.room && <Chip tone="brand">Room {brief.room}</Chip>}
                <span className="t-data text-dim">{brief.memory_count} preferences</span>
              </div>
            </div>
          </div>

          {/* Prep actions */}
          {brief.actions.length > 0 && (
            <section>
              <h2 className="t-h3 mb-3">Prep actions</h2>
              <p className="t-body-sm mb-4 text-dim">
                High-confidence memories → concrete steps the desk should take before check-in.
              </p>
              <div className="flex flex-col gap-3">
                {brief.actions.map((a, i) => <PrepCard key={i} action={a} />)}
              </div>
            </section>
          )}

          {/* Cold start suggestions */}
          {brief.cold_start.length > 0 && (
            <section>
              <h2 className="t-h3 mb-3">First-stay suggestions</h2>
              <p className="t-body-sm mb-4 text-dim">
                Guest has no history. These are cohort-based guesses — phrased as questions, not assumptions.
              </p>
              <div className="card overflow-hidden">
                <table>
                  <thead><tr><th>Ask the guest</th><th>Suggested action</th><th>Basis</th></tr></thead>
                  <tbody>
                    {brief.cold_start.map((s, i) => (
                      <tr key={i}>
                        <td className="t-body-sm">{s.ask ?? s.key}</td>
                        <td className="t-body-sm text-dim">{s.action}</td>
                        <td><Chip tone="neutral">{s.basis}</Chip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Full memory list */}
          {brief.memories.length > 0 && (
            <section>
              <h2 className="t-h3 mb-4">All memories ({brief.memories.length})</h2>
              <div className="card overflow-hidden">
                <table>
                  <thead><tr><th>Preference</th><th>Kind</th><th>Confidence</th><th>Seen</th></tr></thead>
                  <tbody>
                    {brief.memories.map(m => (
                      <tr key={m.id}>
                        <td>
                          <p className="t-body-sm font-semibold">{m.summary}</p>
                          {m.action && <p className="t-data mt-0.5 text-dim">→ {m.action}</p>}
                        </td>
                        <td>
                          <Chip tone={KIND_TONE[m.kind] as 'success' | 'brand' | 'neutral'}>
                            {KIND_LABEL[m.kind] ?? m.kind}
                          </Chip>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5">
                            <span className="t-data">{(m.confidence * 100).toFixed(0)}%</span>
                            <div className="track" style={{ width: 80 }}>
                              <span style={{ width: `${m.confidence * 100}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="t-data text-dim">
                          {m.observations}× · {m.stays_seen} stay{m.stays_seen !== 1 ? 's' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function PrepCard({ action }: { action: PrepAction }) {
  const tone = KIND_TONE[action.kind] ?? 'neutral'
  return (
    <div className="card rise flex items-start gap-4 p-4">
      <div className="h-10 w-10 rounded-lg flex-none flex items-center justify-center"
        style={{ background: action.auto ? 'rgba(79,70,229,0.12)' : 'var(--color-inset)' }}>
        {action.auto
          ? <Icon.Brain className="h-5 w-5 text-brand" />
          : <Icon.Check className="h-5 w-5 text-dim" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="t-body-sm font-semibold">{action.action}</p>
        <p className="t-body-sm mt-0.5 text-dim">{action.because}</p>
        <div className="flex items-center gap-2 mt-2">
          <Chip tone={tone as 'success' | 'brand' | 'neutral'}>{KIND_LABEL[action.kind] ?? action.kind}</Chip>
          <span className="t-data text-dim">
            {(action.confidence * 100).toFixed(0)}% confidence · {action.observations}× observed
            {action.stays_seen > 1 ? ` · ${action.stays_seen} stays` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}
