/**
 * Inventory — staff-facing stock levels + reorder alerts.
 */
import { useCallback, useEffect, useState } from 'react'
import { getInventory, getInventoryAlerts, type InventoryAlert, type InventoryItem } from '../lib/api'
import { AlertBanner, Chip, Icon, PageHeader, Skeleton } from '../components/ui'

type Row = InventoryAlert | InventoryItem

function stockStatus(item: Row): { tone: 'success' | 'warning' | 'danger'; label: string; ratio: number } {
  const ratio = item.reorder_threshold > 0 ? item.quantity / item.reorder_threshold : 1
  if ('status' in item && item.status === 'CRITICAL') return { tone: 'danger',  label: 'Critical', ratio }
  if ('status' in item && item.status === 'LOW')      return { tone: 'warning', label: 'Low',     ratio }
  if (ratio <= 0.3)                                   return { tone: 'danger',  label: 'Critical', ratio }
  if (ratio <= 1)                                     return { tone: 'warning', label: 'Low',     ratio }
  return { tone: 'success', label: 'Healthy', ratio }
}

function stockColor(ratio: number): string {
  if (ratio <= 0.3) return 'var(--color-danger)'
  if (ratio <= 1)   return 'var(--color-warning)'
  return 'var(--color-success)'
}

function rowKey(item: Row, i: number): string { return 'id' in item ? String(item.id) : `i${i}` }

function mergeItems(items: InventoryItem[], alerts: InventoryAlert[]): Row[] {
  const byId = new Map(alerts.map(a => [a.id, a]))
  return items.map(it => byId.get(it.id) ?? it)
}

export default function Inventory() {
  const [rows, setRows]         = useState<Row[]>([])
  const [low, setLow]           = useState<number>(0)
  const [critical, setCritical]  = useState<number>(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [inv, al] = await Promise.all([getInventory(), getInventoryAlerts()])
      setRows(mergeItems(inv.items, al.alerts))
      setLow(al.total - al.critical)
      setCritical(al.critical)
    } catch { setError('API unreachable — make sure the backend is running on port 8000.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const categories = Array.from(new Set(rows.map(r => r.category)))

  return (
    <div className="p-8 flex flex-col gap-8">
      <PageHeader
        title="Inventory"
        subtitle="Live par levels &amp; reorder signals"
        onRefresh={load}
      />

      {error && <AlertBanner message={error} />}

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="stat-card flex flex-col gap-1">
            <p className="t-label text-dim">Line items</p>
            <p className="t-display" style={{ fontWeight: 700, fontSize: 32 }}>{rows.length}</p>
            <p className="t-data text-dim">{categories.length} categories</p>
          </div>
          <div className="stat-card flex flex-col gap-1">
            <p className="t-label text-dim">Healthy</p>
            <p className="t-display" style={{ fontWeight: 700, fontSize: 32, color: rows.length - low - critical > 0 ? 'var(--color-success)' : 'var(--color-ink-muted)' }}>
              {rows.length - low - critical}
            </p>
            <p className="t-data text-dim">Above reorder point</p>
          </div>
          <div className="stat-card flex flex-col gap-1">
            <p className="t-label text-dim">Low</p>
            <p className="t-display" style={{ fontWeight: 700, fontSize: 32, color: low > 0 ? 'var(--color-warning)' : 'var(--color-ink-muted)' }}>{low}</p>
            <p className="t-data text-dim">Below threshold</p>
          </div>
          <div className="stat-card flex flex-col gap-1">
            <p className="t-label text-dim">Critical</p>
            <p className="t-display" style={{ fontWeight: 700, fontSize: 32, color: critical > 0 ? 'var(--color-danger)' : 'var(--color-ink-muted)' }}>{critical}</p>
            <p className="t-data text-dim">Run-out risk</p>
          </div>
        </div>
      )}

      {/* Stock table */}
      <section>
        <h2 className="t-h3 mb-4">Stock levels</h2>
        {loading ? <Skeleton h="h-64" /> : (
          <div className="card overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th>Item</th><th>Category</th><th>On hand</th><th>Reorder point</th><th>Status</th><th>Stock level</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const st = stockStatus(r)
                  return (
                    <tr key={rowKey(r, i)}>
                      <td className="t-body-sm font-semibold">{r.name}</td>
                      <td className="t-body-sm text-dim">{r.category}</td>
                      <td className="t-body-sm">
                        {r.quantity} <span className="t-data text-dim">{r.unit}</span>
                      </td>
                      <td className="t-data text-dim">{r.reorder_threshold}</td>
                      <td><Chip tone={st.tone} live={st.tone !== 'success'}>{st.label}</Chip></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="track w-28" style={{ flexShrink: 0 }}>
                            <span style={{ width: `${Math.min(st.ratio * 100, 100)}%`, background: stockColor(st.ratio) }} />
                          </div>
                          <span className="t-data text-dim">
                            {st.ratio <= 1 ? `${(st.ratio * 100).toFixed(0)}% of par` : 'In stock'}
                          </span>
                        </div>
                      </td>
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
