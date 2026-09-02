import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api, getStoredUser, logout } from '../lib/api'
import type { User } from '../lib/api'

interface Room {
  id: number
  number: string
  floor: number
  room_type: string
  status: string
  capacity: number
  rate_per_night: number
}

interface Stay {
  id: number
  check_in: string
  check_out: string
  status: string
  room: Room | null
  hotel_name: string
  hotel_city: string
  days_remaining: number
  checkout_today: boolean
}

type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

interface RequestItem {
  id: number
  code: string
  category: string
  title: string
  description: string | null
  quantity: number
  priority: Priority
  status: string
  room_number: string | null
  department: string | null
  assigned_to: string | null
  sla_deadline: string | null
  sla_overdue: boolean
  resolved_at: string | null
}

interface Recommendation {
  poi: {
    id: number
    name: string
    category: string
    rating: number
    price_level: number
    visit_minutes: number
    description: string | null
  }
  score: number
  factors: Record<string, number>
  reason: string
}

interface PlanStop {
  id: number
  position: number
  stop_type: string
  name: string
  poi_id: number | null
  start_time: string
  end_time: string
  travel_minutes: number
  distance_km: number
  status: string
  reason: string | null
}

interface PlanDay {
  id: number
  day_index: number
  date: string
  stops: PlanStop[]
}

interface Itinerary {
  id: number
  city: string
  start_date: string
  end_date: string
  status: string
  score: number
  explanation: string
  replanned: boolean
  days: PlanDay[]
}

interface ToolCall {
  tool: string
  status: string
  summary: string
  detail: Record<string, unknown>
}

interface ChatMessageItem {
  id: number
  role: string
  content: string
  intent: string | null
  created_at: string
  tool_calls: ToolCall[]
}

interface ChatReply {
  assistant: string
  intent: string
  mode: string
  tool_calls: ToolCall[]
  actions: string[]
}

interface NotificationItem {
  id: number
  channel: string
  title: string
  body: string
  read: boolean
  demo: boolean
  created_at: string
}

const CHAT_SUGGESTIONS = [
  'Suggest things to do today',
  'Plan tomorrow for me',
  'Send towels to my room',
  'What is the weather now?',
]

const TOOL_STATUS_STYLE: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  skipped: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
}

const CATEGORIES = [
  'Housekeeping',
  'Food & Beverage',
  'Maintenance',
  'IT & Media',
  'Concierge',
  'Other',
]

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ASSIGNED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
}

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: 'bg-bg text-ink-muted border-ink-muted/25',
  MEDIUM: 'bg-brand/10 text-brand border-brand/25',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[status] ?? STATUS_BADGE.PENDING}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[priority]}`}>
      {priority}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user] = useState<User | null>(() => getStoredUser())

  const [stay, setStay] = useState<Stay | null>(null)
  const [stayLoading, setStayLoading] = useState(true)
  const [stayError, setStayError] = useState<string | null>(null)

  const [requests, setRequests] = useState<RequestItem[]>([])
  const [requestsError, setRequestsError] = useState<string | null>(null)

  const [category, setCategory] = useState('Housekeeping')
  const [title, setTitle] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [priority, setPriority] = useState<Priority>('LOW')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)

  const [plans, setPlans] = useState<Itinerary[]>([])
  const [planError, setPlanError] = useState<string | null>(null)
  const [planBusy, setPlanBusy] = useState(false)
  const [planMessage, setPlanMessage] = useState<string | null>(null)

  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [notifError, setNotifError] = useState<string | null>(null)
  const [notifBusy, setNotifBusy] = useState(false)

  async function loadStay() {
    try {
      const data = await api<Stay>('/guest/stay/current')
      setStay(data)
      setStayError(null)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to load your stay.'
      setStay(null)
      setStayError(err instanceof ApiError && err.code === 'NO_ACTIVE_STAY' ? null : message)
    } finally {
      setStayLoading(false)
    }
  }

  async function loadRequests() {
    try {
      const data = await api<{ items: RequestItem[]; total: number }>('/requests/mine')
      setRequests(data.items)
      setRequestsError(null)
    } catch (err) {
      setRequestsError(err instanceof ApiError ? err.message : 'Unable to load your requests.')
    }
  }

  async function loadRecommendations(refresh = true) {
    setRecLoading(true)
    setRecError(null)
    try {
      const data = await api<{ items: Recommendation[] }>(`/recommendations${refresh ? '?refresh=true' : ''}`)
      setRecommendations(data.items)
    } catch (err) {
      setRecError(err instanceof ApiError ? err.message : 'Unable to load recommendations.')
    } finally {
      setRecLoading(false)
    }
  }

  useEffect(() => {
    void loadStay()
    void loadRequests()
    void loadRecommendations()
    void loadPlans()
    void loadConversation()
    void loadNotifs()
  }, [])

  async function handleSubmitRequest() {
    if (!title.trim()) {
      setSubmitError('Please describe what you need.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    setSubmitMessage(null)
    try {
      const created = await api<RequestItem>('/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          quantity,
          priority,
          description: description.trim() || null,
        }),
      })
      setSubmitMessage(`Request ${created.code} placed. Our team has been notified.`)
      setRequests((prev) => [created, ...prev])
      setTitle('')
      setDescription('')
      setQuantity(1)
      setPriority('LOW')
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to place the request.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(code: string) {
    try {
      const updated = await api<RequestItem>(`/requests/${code}/cancel`, { method: 'POST' })
      setRequests((prev) => prev.map((r) => (r.code === code ? updated : r)))
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to cancel the request.')
    }
  }

  async function loadPlans() {
    try {
      const data = await api<{ items: Itinerary[]; total: number }>('/itineraries')
      setPlans(data.items)
      setPlanError(null)
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Unable to load your plan.')
    }
  }

  async function loadConversation() {
    try {
      const data = await api<{ messages: ChatMessageItem[] }>('/chat/conversation')
      setChatMessages(data.messages)
      setChatError(null)
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : 'Unable to load the concierge.')
    }
  }

  async function loadNotifs() {
    try {
      const data = await api<{ items: NotificationItem[]; unread: number }>('/notifications')
      setNotifs(data.items)
      setNotifError(null)
    } catch (err) {
      setNotifError(err instanceof ApiError ? err.message : 'Unable to load your inbox.')
    }
  }

  async function handleSend(text?: string) {
    const message = (text ?? chatInput).trim()
    if (!message || chatBusy) return
    setChatBusy(true)
    setChatError(null)
    setChatInput('')
    try {
      await api<ChatReply>('/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      await loadConversation()
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : 'The concierge could not answer right now.')
    } finally {
      setChatBusy(false)
    }
  }

  async function handleMarkAllRead() {
    setNotifBusy(true)
    try {
      await api<{ marked_read: number }>('/notifications/read-all', { method: 'POST' })
      await loadNotifs()
    } catch (err) {
      setNotifError(err instanceof ApiError ? err.message : 'Unable to update your inbox.')
    } finally {
      setNotifBusy(false)
    }
  }

  function formatTime(iso: string) {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  async function handleCreatePlan() {
    setPlanBusy(true)
    setPlanMessage(null)
    setPlanError(null)
    try {
      await api<Itinerary>('/itineraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: new Date().toISOString().slice(0, 10),
          days: 3,
          start_time: '09:00',
          end_time: '21:00',
        }),
      })
      setPlanMessage('3-day plan built from the curated Jaipur catalogue.')
      await loadPlans()
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Unable to build your plan.')
    } finally {
      setPlanBusy(false)
    }
  }

  async function handleReplan(itinerary: Itinerary) {
    const targets = itinerary.days[0]?.stops.filter((s) => s.status === 'PLANNED').map((s) => s.id) ?? []
    if (targets.length === 0) return
    setPlanBusy(true)
    setPlanMessage(null)
    setPlanError(null)
    try {
      const updated = await api<Itinerary>(`/itineraries/${itinerary.id}/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'WEATHER',
          severity: 'MEDIUM',
          message: 'Expected rain moved up the schedule',
          affected_stop_ids: targets,
        }),
      })
      setPlans((prev) => prev.map((p) => (p.id === itinerary.id ? updated : p)))
      setPlanMessage('Day 1 rebuilt around the weather — the replan is logged as a disruption event.')
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Unable to replan.')
    } finally {
      setPlanBusy(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-gray-200 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-xl font-bold text-brand">Smart Resort 360</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-muted">{user?.full_name ?? 'Guest'}</span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">Welcome back{user ? `, ${user.full_name.split(' ')[0]}` : ''}</h1>

        <section className="mt-6 rounded-xl border border-gray-100 bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Your stay</h2>
          {stayLoading ? (
            <p className="mt-3 text-sm text-ink-muted">Checking your stay...</p>
          ) : stay ? (
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1.5">
                <p className="text-xl font-semibold text-ink">
                  {stay.hotel_name} · {stay.hotel_city}
                </p>
                {stay.room ? (
                  <p className="text-sm text-ink-muted">
                    Room <span className="font-semibold text-ink">{stay.room.number}</span> —{' '}
                    {stay.room.room_type} · Floor {stay.room.floor}
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">Room assignment pending.</p>
                )}
                <p className="text-sm text-ink-muted">
                  {stay.check_in} → {stay.check_out}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {stay.checkout_today && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Checkout today
                  </span>
                )}
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {stay.days_remaining} day{stay.days_remaining === 1 ? '' : 's'} remaining
                </span>
              </div>
            </div>
          ) : stayError ? (
            <p className="mt-3 text-sm text-red-600">{stayError}</p>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              You don't currently have an active stay. Check with the front desk to confirm your check-in.
            </p>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <section className="rounded-xl border border-gray-100 bg-surface p-6 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Concierge</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Ask in plain words — the concierge calls real tools against your stay, never invented answers.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-brand/25 bg-brand/5 px-3 py-1 text-xs font-medium text-brand">
                rule-based demo · real tools
              </span>
            </div>

            <div className="mt-4 h-80 overflow-y-auto rounded-lg border border-gray-100 bg-bg p-4">
              {chatMessages.length === 0 && !chatError && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-ink-muted">Start a conversation with your concierge.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {CHAT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={chatBusy}
                        onClick={() => void handleSend(s)}
                        className="rounded-full border border-brand/25 bg-brand/5 px-3 py-1 text-xs font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {chatError}
                </div>
              )}

              {chatMessages.map((m) =>
                m.role === 'USER' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm text-white shadow-sm">
                      {m.content}
                      {m.created_at && (
                        <span className="mt-0.5 block text-right text-[10px] text-white/70">{formatTime(m.created_at)}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="mt-3 flex justify-start">
                    <div className="max-w-[85%]">
                      {m.tool_calls.length > 0 && (
                        <div className="mb-1 flex flex-wrap gap-1.5">
                          {m.tool_calls.map((t) => (
                            <span
                              key={`${m.id}-${t.tool}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                TOOL_STATUS_STYLE[t.status] ?? TOOL_STATUS_STYLE.ok
                              }`}
                              title={t.summary}
                            >
                              {t.status === 'ok' ? '✓' : t.status === 'error' ? '!' : '·'} {t.tool}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="rounded-2xl rounded-bl-sm border border-gray-100 bg-surface px-3.5 py-2 text-sm text-ink shadow-sm">
                        {m.content}
                        <span className="mt-0.5 block text-right text-[10px] text-ink-muted">{formatTime(m.created_at)}</span>
                      </div>
                      {m.intent && (
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">intent: {m.intent}</p>
                      )}
                      {m.tool_calls.length > 0 && (
                        <button
                          type="button"
                          className="mt-1 text-[11px] font-medium text-brand hover:text-brand-dark"
                          title={m.tool_calls.map((t) => `${t.tool}: ${t.summary}`).join('\n')}
                        >
                          why this answer?
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}

              {chatBusy && (
                <div className="mt-3 flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-gray-100 bg-surface px-3.5 py-2 text-sm text-ink-muted shadow-sm">
                    typing…
                  </div>
                </div>
              )}
            </div>

            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void handleSend()
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask for recommendations, a plan, the weather or a request…"
                className="w-full rounded-lg border border-gray-200 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={chatBusy || !chatInput.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-gray-100 bg-surface p-6 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Inbox</h2>
                <p className="mt-1 text-sm text-ink-muted">WhatsApp-style messages from the hotel.</p>
              </div>
              {(() => {
                const unread = notifs.filter((n) => !n.read).length
                return unread > 0 ? (
                  <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">
                    {unread} new
                  </span>
                ) : null
              })()}
            </div>

            {notifError && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{notifError}</div>
            )}

            <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {notifs.length === 0 && !notifError && (
                <li className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-ink-muted">
                  No messages yet.
                </li>
              )}
              {notifs.map((n) => (
                <li
                  key={n.id}
                  className={`flex max-w-[92%] gap-2 rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-sm ${
                    n.read ? 'bg-bg text-ink-muted' : 'bg-[#dcf8c6] text-ink'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm ${n.read ? 'text-ink-muted' : 'font-medium text-ink'}`}>{n.body}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-muted">
                      <span>{new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-1 text-[9px] font-semibold uppercase text-emerald-700">
                        {n.channel}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={notifBusy || notifs.every((n) => n.read)}
              onClick={() => void handleMarkAllRead()}
              className="mt-3 rounded-lg border border-brand/25 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
            >
              {notifBusy ? 'Updating…' : 'Mark all as read'}
            </button>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-100 bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink">Housekeeping & service</h2>
            <p className="mt-1 text-sm text-ink-muted">Tell us what you need and we'll take it from there.</p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full rounded-lg border border-gray-200 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">What do you need?</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Extra pillows, an iron, a late checkout"
                  className="w-full rounded-lg border border-gray-200 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Details (optional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Anything else we should know?"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">Quantity</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="w-24 rounded-lg border border-gray-200 bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                />
              </label>

              {submitError && (
                <div className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700" role="alert">
                  {submitError}
                </div>
              )}
              {submitMessage && (
                <div className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700" role="status">
                  {submitMessage}
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitRequest()}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Placing request…' : 'Place request'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink">My requests</h2>
            <p className="mt-1 text-sm text-ink-muted">Track everything you've asked us for.</p>

            {requestsError && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{requestsError}</div>
            )}

            <ul className="mt-4 space-y-3">
              {requests.length === 0 && !requestsError && (
                <li className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-ink-muted">
                  No requests yet — place your first one on the left.
                </li>
              )}
              {requests.map((r) => (
                <li key={r.code} className="rounded-lg border border-gray-100 bg-bg px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{r.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {r.code} · {r.category}
                        {r.department ? ` · ${r.department}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PriorityBadge priority={r.priority} />
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span>
                      Qty {r.quantity} · Room {r.room_number ?? '—'}
                    </span>
                    {r.assigned_to && <span>Assigned to {r.assigned_to}</span>}
                    {r.sla_deadline && !['COMPLETED', 'CANCELLED'].includes(r.status) && (
                      <span className={r.sla_overdue ? 'font-semibold text-red-600' : ''}>
                        SLA due {new Date(r.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {r.sla_overdue ? ' · overdue' : ''}
                      </span>
                    )}
                    {r.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => void handleCancel(r.code)}
                        className="ml-auto rounded-md border border-gray-200 px-2 py-0.5 text-xs font-medium text-ink-muted transition hover:border-red-300 hover:text-red-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-gray-100 bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Your travel plan</h2>
              <p className="mt-1 text-sm text-ink-muted">
                A real constraint solver builds your days — travel time, opening hours and your preferences included.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={planBusy}
                onClick={() => void handleCreatePlan()}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                {planBusy ? 'Planning…' : 'Build a 3-day plan'}
              </button>
            </div>
          </div>

          {planError && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{planError}</div>}
          {planMessage && (
            <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
              {planMessage}
            </div>
          )}

          {plans.length === 0 && !planError && (
            <p className="mt-4 text-sm text-ink-muted">
              No itinerary yet — let the planner build one around your interests and hotel location.
            </p>
          )}

          <div className="mt-4 space-y-5">
            {plans.map((itinerary) => (
              <div key={itinerary.id} className="rounded-lg border border-gray-100 bg-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {itinerary.city} · {itinerary.start_date} → {itinerary.end_date}
                      {itinerary.replanned && (
                        <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          replanned after weather
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{itinerary.explanation}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-brand">
                      score {Math.round(itinerary.score * 100)}
                    </span>
                    <button
                      type="button"
                      disabled={planBusy}
                      onClick={() => void handleReplan(itinerary)}
                      className="rounded-md border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
                    >
                      Replan for rain
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {itinerary.days.map((day) => (
                    <div key={day.id} className="rounded-lg border border-gray-200/70 bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Day {day.day_index} · {day.date}
                      </p>
                      <ol className="mt-2 space-y-2">
                        {day.stops.length === 0 && (
                          <li className="text-xs italic text-ink-muted">free time</li>
                        )}
                        {day.stops.map((stop) => {
                          const removed = stop.status === 'REMOVED'
                          const replaced = stop.status === 'REPLACED'
                          return (
                            <li
                              key={stop.id}
                              className={`flex items-start gap-2 text-sm ${
                                removed ? 'text-gray-400 line-through' : 'text-ink'
                              }`}
                            >
                              <span
                                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                                  removed ? 'bg-gray-300' : replaced ? 'bg-emerald-500' : 'bg-brand'
                                }`}
                              />
                              <div className="min-w-0">
                                <p className="font-medium">
                                  {stop.start_time}
                                  {stop.stop_type === 'MEAL' ? (
                                    <span className="ml-1 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                                      meal
                                    </span>
                                  ) : (
                                    <span className="ml-1 rounded bg-brand/10 px-1 py-0.5 text-[10px] font-semibold uppercase text-brand">
                                      visit
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm">{stop.name}</p>
                                <p className="text-xs text-ink-muted">
                                  {stop.start_time}–{stop.end_time} · {stop.travel_minutes} min travel
                                  {replaced ? ' · replaced' : ''}
                                </p>
                              </div>
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-gray-100 bg-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Explore Jaipur</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Scored fresh from our curated catalogue — every pick is explainable.
              </p>
            </div>
            <button
              type="button"
              disabled={recLoading}
              onClick={() => void loadRecommendations(true)}
              className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/10 disabled:opacity-50"
            >
              {recLoading ? 'Refreshing…' : 'Refresh picks'}
            </button>
          </div>

          {recError && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{recError}</div>}

          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {recommendations.length === 0 && !recError && (
              <li className="text-sm text-ink-muted">Loading recommendations…</li>
            )}
            {recommendations.map((rec, idx) => (
              <li key={rec.poi.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-bg px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{rec.poi.name}</p>
                  <p className="text-xs text-ink-muted">
                    {rec.poi.category} · ⭐ {rec.poi.rating.toFixed(1)} · ~{rec.poi.visit_minutes} min
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{rec.reason}</p>
                </div>
                <span className="ml-auto shrink-0 text-sm font-semibold text-brand">{Math.round(rec.score * 100)}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-surface">
        <p className="mx-auto max-w-5xl px-4 py-4 text-sm text-ink-muted">
          Signed in as {user?.role ?? 'guest'} · Smart Resort 360 demo.
        </p>
      </footer>
    </div>
  )
}