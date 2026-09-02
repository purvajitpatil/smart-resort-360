import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredUser, logout } from '../lib/api'
import {
  CATALOGUE,
  createRequest,
  getStay,
  listMemories,
  listRequests,
  type Memory,
  type ServiceRequest,
  type Stay,
} from '../lib/domain'
import Shell from '../components/Shell'
import { Chip, Empty, ErrorNote, Icon, Loading, Section, statusTone } from '../components/ui'

const OPEN = new Set(['PENDING', 'ASSIGNED', 'IN_PROGRESS'])

export default function Home() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const firstName = (user?.full_name ?? 'there').split(' ')[0]

  const [stay, setStay] = useState<Stay | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, r, m] = await Promise.allSettled([getStay(), listRequests(), listMemories()])
      if (s.status === 'fulfilled') setStay(s.value)
      if (r.status === 'fulfilled') setRequests(r.value.items)
      if (m.status === 'fulfilled') setMemories(m.value.items)
      if (s.status === 'rejected' && r.status === 'rejected') {
        setError('Could not load your stay. The API may not be running.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function quickRequest(category: string, title: string, priority: 'LOW' | 'MEDIUM' | 'HIGH') {
    setSending(title)
    try {
      const created = await createRequest({ category, title, priority })
      setRequests((prev) => [created, ...prev])
      setToast(`${title} — sent to ${created.department ?? 'the team'}`)
      void listMemories().then((m) => setMemories(m.items))
      setTimeout(() => setToast(null), 3200)
    } catch {
      setToast('Could not send that request. Try again.')
      setTimeout(() => setToast(null), 3200)
    } finally {
      setSending(null)
    }
  }

  const open = requests.filter((r) => OPEN.has(r.status))
  // Only memories we are confident enough to have acted on already.
  const prepared = memories.filter((m) => m.confidence >= 0.65 && m.action).slice(0, 3)
  const returning = memories.some((m) => m.stays_seen > 1)

  return (
    <Shell>
      {/* ---- Greeting ------------------------------------------------- */}
      <div className="rise mb-6 flex items-start justify-between">
        <div>
          <p className="t-label text-[var(--color-ink-dim)]">
            {returning ? 'Welcome back' : 'Welcome'}
          </p>
          <h1 className="t-h1 mt-1">Hello, {firstName}</h1>
        </div>
        <button
          type="button"
          className="btn btn-quiet"
          style={{ padding: 10 }}
          aria-label="Sign out"
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
        >
          <Icon.Logout />
        </button>
      </div>

      {loading ? <Loading rows={3} /> : null}
      {error && !loading ? <ErrorNote message={error} onRetry={load} /> : null}

      {!loading && stay ? (
        <div className="flex flex-col gap-7">
          {/* ---- Stay card ---------------------------------------------- */}
          <div className="card-guest rise overflow-hidden">
            <div className="flex items-start justify-between p-5 pb-4">
              <div>
                <p className="t-label text-[var(--color-ink-dim)]">{stay.hotel_name}</p>
                <p className="t-display mt-2 leading-none" style={{ color: 'var(--color-tint)' }}>
                  {stay.room?.number ?? '—'}
                </p>
                <p className="t-body-sm mt-2 text-[var(--color-ink-muted)]">
                  {stay.room?.room_type ?? 'Room'} · Floor {stay.room?.floor ?? '—'}
                </p>
              </div>
              <Chip tone={stay.checkout_today ? 'warning' : 'success'} live>
                {stay.checkout_today ? 'Checkout today' : 'Checked in'}
              </Chip>
            </div>

            <div className="hair-t grid grid-cols-3 divide-x divide-[var(--color-hair)]">
              <Cell label="Check in" value={fmtDate(stay.check_in)} />
              <Cell label="Check out" value={fmtDate(stay.check_out)} />
              <Cell
                label="Nights left"
                value={String(Math.max(0, stay.days_remaining))}
                accent
              />
            </div>
          </div>

          {/* ---- Prepared for you -------------------------------------- */}
          {/* The differentiator, stated plainly: not "AI powered", but the
              specific things we did because of what we remember. */}
          {prepared.length > 0 ? (
            <Section
              title="Ready before you asked"
              action={
                <button
                  type="button"
                  className="t-label text-[var(--color-tint)]"
                  onClick={() => navigate('/app/memory')}
                >
                  Manage
                </button>
              }
            >
              <div className="card-guest flex flex-col divide-y divide-[var(--color-hair)]">
                {prepared.map((m) => (
                  <div key={m.id} className="flex items-start gap-3 p-4">
                    <span
                      className="mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full"
                      style={{ background: 'rgba(22,163,74,0.16)', color: '#4ade80' }}
                    >
                      <Icon.Check className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="t-body-sm font-medium">{m.action}</p>
                      <p className="t-body-sm mt-0.5 text-[var(--color-ink-dim)]">
                        {m.summary}
                        {m.stays_seen > 1 ? ` · across ${m.stays_seen} stays` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* ---- Quick actions ------------------------------------------ */}
          <Section title="Ask for something">
            <div className="flex flex-col gap-4">
              {CATALOGUE.map((group) => (
                <div key={group.category}>
                  <p className="t-body-sm mb-2 text-[var(--color-ink-dim)]">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        disabled={sending !== null}
                        className="btn btn-ghost btn-round"
                        onClick={() => quickRequest(group.category, item.title, item.priority)}
                      >
                        {sending === item.title ? 'Sending…' : item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ---- Live requests ------------------------------------------ */}
          <Section
            title="In progress"
            action={
              open.length > 0 ? (
                <button
                  type="button"
                  className="t-label text-[var(--color-tint)]"
                  onClick={() => navigate('/app/requests')}
                >
                  See all
                </button>
              ) : null
            }
          >
            {open.length === 0 ? (
              <Empty
                title="Nothing pending"
                body="Anything you ask for shows up here with a live status."
              />
            ) : (
              <div className="card flex flex-col divide-y divide-[var(--color-hair)]">
                {open.slice(0, 3).map((r) => {
                  const tone = statusTone(r.status)
                  return (
                    <button
                      key={r.code}
                      type="button"
                      className="row flex items-center justify-between gap-3 text-left"
                      onClick={() => navigate('/app/requests')}
                    >
                      <div className="min-w-0">
                        <p className="t-body-sm truncate font-medium">{r.title}</p>
                        <p className="t-data mt-1 text-[var(--color-ink-dim)]">
                          {r.code} · {r.department ?? 'Routing…'}
                        </p>
                      </div>
                      <Chip tone={tone.tone} live={r.status === 'IN_PROGRESS'}>
                        {tone.label}
                      </Chip>
                    </button>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      ) : null}

      {!loading && !stay && !error ? (
        <Empty
          title="No active stay"
          body="Once you're checked in, your room, requests and preferences appear here."
        />
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

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-4 py-3">
      <p className="t-label text-[var(--color-ink-dim)]">{label}</p>
      <p
        className="t-data mt-2"
        style={{ fontSize: 15, color: accent ? 'var(--color-tint)' : 'var(--color-ink)' }}
      >
        {value}
      </p>
    </div>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' })
}
