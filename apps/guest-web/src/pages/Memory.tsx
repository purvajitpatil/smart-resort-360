/**
 * Guest memory / preferences screen.
 *
 * This is the privacy-forward face of the memory engine. Guests see:
 *  - Everything we have learned about them, with a confidence bar and the
 *    source ("observed 3 times across 2 stays" vs "you told us directly").
 *  - A clear, immediate forget action on each item.
 *  - A "Forget everything" nuclear option — and why this makes the product
 *    more trustworthy, not less.
 *
 * Design choice: the memory list is dark cards with confidence bars, exactly
 * as in the staff prep view, so guests see the same data the desk sees. No
 * hidden information, no different vocabulary on each side. That's the DPDP
 * story made tangible.
 */
import { useCallback, useEffect, useState } from 'react'
import { forgetAllMemories, forgetMemory, listMemories, type Memory } from '../lib/domain'
import Shell from '../components/Shell'
import { Chip, Confidence, Empty, ErrorNote, Icon, Loading, Section, timeAgo } from '../components/ui'

const KIND_LABEL: Record<string, string> = {
  STATED: 'You told us',
  OBSERVED: 'We noticed',
  INFERRED: 'We guessed',
}

const KIND_TONE: Record<string, 'success' | 'brand' | 'neutral'> = {
  STATED: 'success',
  OBSERVED: 'brand',
  INFERRED: 'neutral',
}

export default function MemoryPage() {
  const [data, setData] = useState<{ items: Memory[]; total: number; returning_guest: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forgetting, setForgetting] = useState<number | null>(null)
  const [wipingAll, setWipingAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listMemories())
    } catch {
      setError('Could not load your preferences. Check the API is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function forget(id: number) {
    setForgetting(id)
    try {
      await forgetMemory(id)
      setData((prev) => prev ? { ...prev, items: prev.items.filter((m) => m.id !== id), total: prev.total - 1 } : prev)
      notify('Preference removed.')
    } catch {
      notify('Could not remove that preference.')
    } finally {
      setForgetting(null)
    }
  }

  async function forgetAll() {
    if (!window.confirm('Remove all preferences? This cannot be undone.')) return
    setWipingAll(true)
    try {
      const res = await forgetAllMemories()
      setData((prev) => prev ? { ...prev, items: [], total: 0 } : prev)
      notify(`Cleared ${res.forgotten} preference${res.forgotten === 1 ? '' : 's'}.`)
    } catch {
      notify('Could not clear all preferences.')
    } finally {
      setWipingAll(false)
    }
  }

  const items = data?.items ?? []
  const returning = data?.returning_guest ?? false

  return (
    <Shell
      title="My preferences"
      subtitle={items.length > 0 ? `${items.length} learned` : undefined}
    >
      {loading ? <Loading rows={3} /> : null}
      {error && !loading ? <ErrorNote message={error} onRetry={load} /> : null}

      {!loading && !error ? (
        <div className="flex flex-col gap-6">
          {/* Explainer card */}
          <div
            className="card-guest rounded-xl p-4"
          >
            <p className="t-body-sm font-semibold">How this works</p>
            <p className="t-body-sm mt-1 text-[var(--color-ink-muted)]">
              Every time you make a request, Smart Resort 360 learns a preference. On
              your next stay, your room is ready before you ask. You control
              everything here — delete any preference, or all of them, any time.
            </p>
            {returning ? (
              <div className="mt-3">
                <Chip tone="success">Returning guest — cross-stay memory active</Chip>
              </div>
            ) : null}
          </div>

          {/* Memory list */}
          {items.length === 0 ? (
            <Empty
              title="Nothing learned yet"
              body="Make a few service requests and your preferences will build up here."
            />
          ) : (
            <Section
              title="What we know"
              action={
                <button
                  type="button"
                  className="t-label text-[#f87171]"
                  disabled={wipingAll}
                  onClick={forgetAll}
                >
                  {wipingAll ? 'Clearing…' : 'Forget all'}
                </button>
              }
            >
              <div className="flex flex-col gap-3">
                {items.map((m) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    forgetting={forgetting === m.id}
                    onForget={() => forget(m.id)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Privacy footer */}
          <div className="pb-2 text-center">
            <p className="t-body-sm text-[var(--color-ink-dim)]">
              Data is tied to your guest profile only.
              <br />
              Deleting is permanent. Nothing is sold or shared.
            </p>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="glass fixed inset-x-4 bottom-24 z-50 mx-auto max-w-[400px] rounded-xl border px-4 py-3"
          style={{ borderColor: 'var(--color-hair)' }}
        >
          <p className="t-body-sm">{toast}</p>
        </div>
      ) : null}
    </Shell>
  )
}

function MemoryCard({
  memory,
  forgetting,
  onForget,
}: {
  memory: Memory
  forgetting: boolean
  onForget: () => void
}) {
  const tone = KIND_TONE[memory.kind] ?? 'neutral'
  const label = KIND_LABEL[memory.kind] ?? memory.kind

  return (
    <div className="card rise flex flex-col gap-0 overflow-hidden">
      {/* Main */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="t-body-sm font-semibold">{memory.summary}</p>
          {memory.action ? (
            <p className="t-body-sm mt-1 text-[var(--color-ink-dim)]">→ {memory.action}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-quiet flex-none"
          style={{ padding: 8 }}
          disabled={forgetting}
          aria-label={`Forget: ${memory.summary}`}
          onClick={onForget}
        >
          {forgetting
            ? <span className="h-4 w-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
            : <Icon.Trash className="h-4 w-4" />}
        </button>
      </div>

      {/* Confidence bar */}
      <div className="hair-t flex items-center justify-between px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Chip tone={tone}>{label}</Chip>
            <span className="t-data text-[var(--color-ink-dim)]">
              {memory.observations}× seen
              {memory.stays_seen > 1 ? ` · ${memory.stays_seen} stays` : ''}
            </span>
          </div>
          <Confidence value={memory.confidence} />
        </div>
        {memory.last_seen_at ? (
          <span className="t-data text-[var(--color-ink-dim)]">{timeAgo(memory.last_seen_at)}</span>
        ) : null}
      </div>
    </div>
  )
}
