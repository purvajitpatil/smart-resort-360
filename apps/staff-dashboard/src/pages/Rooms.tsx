import { useCallback, useEffect, useState } from 'react'
import { listRooms, type Room } from '../lib/api'
import { Chip, Icon, PageHeader, Skeleton, type Tone } from '../components/ui'

const STATUS_TONE: Record<string, Tone> = {
  CLEAN: 'success', OCCUPIED: 'brand', DIRTY: 'warning', MAINTENANCE: 'danger',
}

export default function Rooms() {
  const [rooms, setRooms]     = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const r = await listRooms(); setRooms(r.items) }
    catch { setError('Could not load rooms.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const byFloor = rooms.reduce<Record<number, Room[]>>((acc, r) => {
    ;(acc[r.floor] ??= []).push(r); return acc
  }, {})

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Rooms"
        subtitle="All rooms by floor with status and nightly rate"
        onRefresh={load}
      />

      {error && (
        <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.28)' }}>
          <p className="t-body-sm text-danger">{error}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-2 flex-wrap">
        {[['Clean','success'],['Occupied','brand'],['Dirty','warning'],['Maintenance','danger']].map(([l,t]) => (
          <span key={l} className={`chip chip-${t}`}>{l}</span>
        ))}
      </div>

      {loading ? <Skeleton h="h-64" /> : null}

      {!loading && Object.keys(byFloor).length === 0 && !error ? (
        <div className="card text-center py-12">
          <p className="t-body-sm text-dim">No rooms loaded. Seed some data via the backend.</p>
        </div>
      ) : null}

      {!loading && Object.entries(byFloor)
        .sort(([a],[b]) => Number(a) - Number(b))
        .map(([floor, rs]) => (
          <section key={floor}>
            <h2 className="t-h3 mb-3">Floor {floor}</h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
              {rs.map(room => (
                <div key={room.id} className="card rise flex flex-col gap-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="t-h3">#{room.number}</p>
                    <Chip tone={STATUS_TONE[room.status] ?? 'neutral'}>{room.status}</Chip>
                  </div>
                  <p className="t-data text-dim">{room.room_type}</p>
                  <p className="t-data text-dim">₹{room.rate_per_night}/night</p>
                </div>
              ))}
            </div>
          </section>
        ))
      }
    </div>
  )
}
