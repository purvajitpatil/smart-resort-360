/**
 * Guest Segmentation — overview of how the resort's guests are classified
 * by behavior (not manual tags). Each card maps to a real segment definition
 * with a recommended action that staff can act on right now.
 *
 * Drives targeted offers: every guest can be drilled into to see their
 * signals, the offer we should pitch, and the channels it should run on.
 */
import { useCallback, useEffect, useState } from 'react'
import { getGuestSegment, getSegmentOffer, getSegmentOverview, type GuestSegment, type SegmentOffer, type SegmentOverview } from '../lib/api'
import { AlertBanner, Chip, Icon, PageHeader, Skeleton } from '../components/ui'

export default function Segments() {
  const [segs, setSegs] = useState<SegmentOverview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<SegmentOverview | null>(null)
  const [drillGuestId, setDrillGuestId] = useState<string>('')
  const [drillSegment, setDrillSegment] = useState<GuestSegment | null>(null)
  const [drillOffer, setDrillOffer] = useState<SegmentOffer | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await getSegmentOverview()
      setSegs(r.segments); setTotal(r.total)
    } catch {
      setError('API unreachable — make sure the backend is running on port 8000.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const runDrill = useCallback(async (rawId: string) => {
    const guestId = Number(rawId)
    if (!guestId || Number.isNaN(guestId)) {
      setDrillSegment(null); setDrillOffer(null); return
    }
    setDrillLoading(true)
    try {
      const [seg, off] = await Promise.all([getGuestSegment(guestId), getSegmentOffer(guestId)])
      setDrillSegment(seg); setDrillOffer(off)
    } catch {
      setDrillSegment(null); setDrillOffer(null)
    } finally { setDrillLoading(false) }
  }, [])

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Guest Segments"
        subtitle="Behaviour-based classification — drives targeted offers, prep-card priority, and concierge routing."
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {loading ? <Skeleton h="h-64" /> : (
        <>
          {/* Top-line: total guests classified */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Total classified</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {total}
              </p>
              <p className="t-data text-dim">Active guests</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Distinct segments</p>
              <p className="t-display text-brand" style={{ fontWeight: 700, fontSize: 32 }}>
                {segs.filter(s => s.count > 0).length}
              </p>
              <p className="t-data text-dim">Behaviours represented</p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Largest segment</p>
              <p className="t-body-sm font-semibold text-brand">
                {segs[0] ? `${segs[0].icon} ${segs[0].segment}` : '—'}
              </p>
              <p className="t-data text-dim">
                {segs[0] ? `${segs[0].count} guest${segs[0].count === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <div className="stat-card flex flex-col gap-1">
              <p className="t-label text-dim">Engine</p>
              <p className="t-body-sm font-semibold text-success">Live</p>
              <p className="t-data text-dim">Memory-driven classification</p>
            </div>
          </div>

          {/* Segment cards */}
          <section>
            <h2 className="t-h3 mb-3">All segments</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {segs.map((s) => (
                <button
                  type="button"
                  key={s.segment}
                  onClick={() => setSelected(s)}
                  className="card p-5 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    borderColor: selected?.segment === s.segment ? 'var(--color-tint)' : undefined,
                    boxShadow: selected?.segment === s.segment ? '0 0 0 1px var(--color-tint)' : undefined,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--color-raised)', fontSize: 22 }}
                      >
                        {s.icon}
                      </div>
                      <div>
                        <p className="t-body-sm font-semibold">{s.segment}</p>
                        <p className="t-label text-dim">{s.count} guest{s.count === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <Chip tone={s.count > 0 ? 'brand' : 'neutral'}>{s.count > 0 ? 'active' : 'no guests'}</Chip>
                  </div>
                  <p className="t-data mt-3 text-muted">{s.description}</p>
                  <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--color-raised)' }}>
                    <p className="t-label text-dim">Recommended action</p>
                    <p className="t-body-sm mt-1">{s.recommended_action}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Per-guest drill-down */}
          <section>
            <h2 className="t-h3 mb-3">Per-guest drill-down</h2>
            <div className="card p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <p className="t-body-sm text-dim">
                  Enter a guest ID to see their assigned segment, the signals that triggered it, and the targeted offer to pitch.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="t-label">Guest ID</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    value={drillGuestId}
                    placeholder="e.g. 1"
                    onChange={(e) => { setDrillGuestId(e.target.value); void runDrill(e.target.value) }}
                  />
                </div>
                <p className="t-data text-dim">
                  Tip: try guest IDs 1, 2, or 3 to see different segments in action.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {drillLoading && <Skeleton h="h-40" />}
                {!drillLoading && !drillSegment && (
                  <div className="rounded-xl p-6 text-center" style={{ background: 'var(--color-raised)' }}>
                    <p className="t-body-sm text-dim">
                      Enter a guest ID to see their segment + offer.
                    </p>
                  </div>
                )}
                {drillSegment && (
                  <>
                    <div className="rounded-xl p-4" style={{ background: 'var(--color-raised)' }}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)', fontSize: 22 }}>
                          {drillSegment.icon}
                        </div>
                        <div>
                          <p className="t-body-sm font-semibold">{drillSegment.segment}</p>
                          <p className="t-label text-dim">
                            {Math.round(drillSegment.confidence * 100)}% confidence
                          </p>
                        </div>
                      </div>
                      <p className="t-data mt-3 text-muted">{drillSegment.description}</p>
                      {drillSegment.signals.length > 0 && (
                        <div className="mt-3 flex flex-col gap-1">
                          <p className="t-label text-dim">Signals</p>
                          <div className="flex gap-1 flex-wrap">
                            {drillSegment.signals.map((s) => <Chip key={s} tone="brand">{s}</Chip>)}
                          </div>
                        </div>
                      )}
                    </div>
                    {drillOffer && (
                      <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <p className="t-label text-success">Targeted offer for {drillOffer.guest_name}</p>
                        <p className="t-body-sm font-semibold mt-1">{drillOffer.offer_headline}</p>
                        <p className="t-data mt-2 text-muted">{drillOffer.offer_body}</p>
                        <div className="mt-3 flex gap-1 flex-wrap">
                          {drillOffer.channels.map((c) => <Chip key={c} tone="info">{c}</Chip>)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* How segmentation works */}
          {selected && (
            <section>
              <h2 className="t-h3 mb-3">"{selected.segment}" — how it's detected</h2>
              <div className="card p-5 flex flex-col gap-3">
                <p className="t-body-sm text-muted">{selected.description}</p>
                <div className="rounded-lg p-3" style={{ background: 'var(--color-raised)' }}>
                  <p className="t-label text-dim">Triggered when</p>
                  <p className="t-body-sm mt-1">{triggerFor(selected.segment)}</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: 'var(--color-raised)' }}>
                  <p className="t-label text-dim">Staff action</p>
                  <p className="t-body-sm mt-1">{selected.recommended_action}</p>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function triggerFor(segment: string): string {
  switch (segment) {
    case 'Power Guest':         return 'stays_seen >= 3 AND high memory count AND stated preferences'
    case 'Loyal Guest':         return 'stays_seen >= 3 AND comfort/food memories captured'
    case 'Business Traveller':  return 'quiet/privacy memory key OR 1-2 night stays'
    case 'Dietary / Family':    return 'food/vegetarian memory OR family travel group tag'
    case 'Comfort Seeker':      return 'pillow/temperature/amenity memory keys present'
    case 'First Timer':         return 'No memories on file, first active stay'
    case 'Returning Guest':     return '2+ stays but few memories captured'
    default:                    return 'Default classification'
  }
}
