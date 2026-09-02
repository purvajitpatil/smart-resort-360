/**
 * Staff-facing API layer.
 */
export const API_BASE = '/api/v1'
const ACCESS_KEY = 'smrt360_staff_access'
const REFRESH_KEY = 'smrt360_staff_refresh'
const USER_KEY = 'smrt360_staff_user'

export interface StaffUser {
  id: string
  email: string
  full_name: string
  role: string
}

interface Envelope<T> {
  success: boolean
  data: T
  error: { code: string; message: string } | null
  meta?: Record<string, unknown>
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function resolveApiPath(path: string): string { return `${API_BASE}${path}` }

export function getAccessToken(): string | null {
  const token = localStorage.getItem(ACCESS_KEY)
  if (!token || token === 'undefined' || token === 'null') { clearAuth(); return null }
  return token
}
export function getStoredUser(): StaffUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as StaffUser } catch { return null }
}
function storeSession(access: string, refresh: string, user: StaffUser): void {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
export function clearAuth(): void {
  [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k))
}

export async function login(email: string, password: string): Promise<StaffUser> {
  const res = await fetch(resolveApiPath('/auth/login'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const env = await parseEnv<{ access_token: string; refresh_token: string; user: StaffUser }>(res)
  if (!res.ok || !env.success) throw new ApiError(env.error?.code ?? 'LOGIN_FAILED', env.error?.message ?? 'Login failed', res.status)
  storeSession(env.data.access_token, env.data.refresh_token, env.data.user)
  return env.data.user
}

export async function logout(): Promise<void> {
  try {
    const token = getAccessToken()
    await fetch(resolveApiPath('/auth/logout'), { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } finally { clearAuth() }
}

export async function api<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(resolveApiPath(path), { ...options, headers })
  const env = await parseEnv<T>(res)
  if (res.status === 401 && env.error?.code === 'TOKEN_EXPIRED' && !isRetry) {
    const ref = localStorage.getItem(REFRESH_KEY)
    if (ref) {
      const rr = await fetch(resolveApiPath('/auth/refresh'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: ref }) })
      const re = await parseEnv<{ access_token: string; refresh_token: string }>(rr)
      if (re.success && re.data?.access_token) {
        localStorage.setItem(ACCESS_KEY, re.data.access_token)
        if (re.data.refresh_token) localStorage.setItem(REFRESH_KEY, re.data.refresh_token)
        return api<T>(path, options, true)
      }
    }
  }
  if (!res.ok || !env.success) throw new ApiError(env.error?.code ?? 'REQUEST_FAILED', env.error?.message ?? `Error ${res.status}`, res.status)
  return env.data
}

async function parseEnv<T>(res: Response): Promise<Envelope<T>> {
  const text = await res.text()
  if (!text.trim()) return { success: res.ok, data: undefined as unknown as T, error: null }
  return JSON.parse(text) as Envelope<T>
}

/* ------------------------------------------------------------------ Types */
export interface Room { id: number; number: string; floor: number; room_type: string; status: string; capacity: number; rate_per_night: number }
export interface RequestOut {
  id: number; code: string; category: string; title: string; description: string | null; quantity: number
  priority: 'LOW' | 'MEDIUM' | 'HIGH'; status: string; guest_name: string; room_number: string | null
  department: string | null; assigned_to: string | null; sla_minutes: number | null; sla_deadline: string | null
  sla_overdue: boolean; resolved_at: string | null; created_at: string | null
  history: Array<{ from_status: string | null; to_status: string; note: string | null; at: string }>
  ai_created: boolean
}
export interface QueueStats { total: number; pending: number; in_progress: number; completed: number; overdue: number }
export interface EscalationItem {
  code: string; title: string; room: string | null; priority: string; status: string
  state: 'on_track' | 'at_risk' | 'breached' | 'closed'
  sla_minutes: number; elapsed_minutes: number; remaining_minutes: number; deadline: string
  percent_used: number; tier: number; tier_role: string; tier_note: string; night: boolean
}
export interface PrepAction { memory_id: number; key: string; action: string; because: string; confidence: number; kind: string; observations: number; stays_seen: number; auto: boolean }
export interface GuestBrief {
  returning_guest: boolean; has_history: boolean; memory_count: number
  actions: PrepAction[]
  cold_start: Array<{ key: string; ask: string | null; action: string; basis: string; kind: string; confidence: number }>
  memories: Array<{ id: number; key: string; summary: string; kind: string; status: string; confidence: number; observations: number; stays_seen: number; action: string | null; first_seen_at: string | null; last_seen_at: string | null }>
  guest: { id: number; name: string }; room: string | null
}
export interface HotelStats {
  hotel: { id: number; name: string; city: string }
  rooms: { total: number; clean: number; occupied: number; dirty: number; maintenance: number }
  occupancy_pct: number; checkins_today: number; checkouts_today: number
}

/* ------------------------------------------------------------------ Endpoints */
type HotelOverviewApi = {
  hotel: string; city: string; total_rooms: number; occupancy_pct: number
  rooms_by_status: Record<string, number>; active_stays: number; arrivals_today: number; departures_today: number
}

export async function getHotelOverview(hotelId = 1): Promise<HotelStats> {
  const data = await api<HotelOverviewApi>(`/hotel/overview?hotel_id=${hotelId}`)
  return {
    hotel: { id: hotelId, name: data.hotel, city: data.city },
    rooms: { total: data.total_rooms, clean: data.rooms_by_status.CLEAN ?? 0, occupied: data.rooms_by_status.OCCUPIED ?? 0, dirty: data.rooms_by_status.DIRTY ?? 0, maintenance: data.rooms_by_status.MAINTENANCE ?? 0 },
    occupancy_pct: data.occupancy_pct,
    checkins_today: data.arrivals_today,
    checkouts_today: data.departures_today,
  }
}
export const listRooms = (hotelId = 1) => api<{ items: Room[]; total: number }>(`/hotel/rooms?hotel_id=${hotelId}`)
export async function listAllRequests(hotelId = 1): Promise<{ items: RequestOut[]; total: number; stats: QueueStats }> {
  const [requests, queue] = await Promise.all([
    api<{ items: RequestOut[]; total: number }>(`/requests?hotel_id=${hotelId}&limit=100`),
    api<{ by_status: Record<string, number>; overdue_count: number }>('/requests/queue/stats'),
  ])
  return { ...requests, stats: { total: requests.total, pending: queue.by_status.PENDING ?? 0, in_progress: (queue.by_status.ASSIGNED ?? 0) + (queue.by_status.IN_PROGRESS ?? 0), completed: queue.by_status.COMPLETED ?? 0, overdue: queue.overdue_count } }
}
export function updateRequestStatus(code: string, action: 'assign' | 'start' | 'complete' | 'cancel', note?: string) {
  if (action === 'assign') return api<RequestOut>(`/requests/${code}/assign`, { method: 'PATCH', ...(note ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) } : {}) })
  return api<RequestOut>(`/requests/${code}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) })
}
export const getEscalations = (hotelId = 1) => api<{ items: EscalationItem[]; total: number; breached: number; at_risk: number; night_shift: boolean }>(`/ops/escalations?hotel_id=${hotelId}`)
export const getGuestBrief = (guestId: number) => api<GuestBrief>(`/ops/guests/${guestId}/brief`)
export const explainRouting = (title: string, category: string, at?: string) =>
  api<Record<string, unknown>>('/ops/routing/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, category, at }) })

/* --------------------------------------------------------------- Intelligence */
export interface SentimentByCat { category: string; avg: number; rated: number }
export interface SentimentReport {
  by_category: SentimentByCat[]
  overall: number
  total_rated: number
  window_days: number
}
export interface MaintenanceAlert {
  fault: string; count: number; request_codes: string[]
  severity: string; window_days: number; alert: string; action: string
}
export interface InventoryItem {
  id: number; name: string; category: string; unit: string
  quantity: number; reorder_threshold: number
}
export interface InventoryAlert extends InventoryItem {
  status: string; reorder_quantity: number; cost_per_unit: number
}
export interface RevenueReport {
  occupancy_pct: number; occupied_rooms: number; total_rooms: number
  adr: number; projected_daily_revenue: number; active_stays: number
  arrivals_today: number; departures_today: number; upcoming_bookings: number
}
export interface StaffLoad { by_department: Array<{ department: string; open_requests: number }>; total_open: number }
export interface DailyBrief {
  hotel: string; generated_at: string
  actions: Array<{ priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; title: string; reason: string; route: string }>
  signals: { occupancy_pct: number; projected_daily_revenue: number; open_requests: number; inventory_alerts: number }
}

/* --------------------------------------------------------------- Dynamic Pricing */
export interface PricingFactor { multiplier: number; label: string | null; pct_change: number }
export interface RateDay {
  date: string; day_of_week: string; is_weekend: boolean
  occupancy_pct: number; seasonal_label: string | null; day_of_week_label: string
  rates_by_type: Record<string, { base_rate: number; rate: number; pct_change: number }>
}
export interface PricingInsight {
  available: boolean; message?: string
  average_occupancy_7d: number | null; peak_day: string | null; peak_occupancy_pct: number | null
  surge_days: string[]; next_7_days: RateDay[]
}
export interface RateSimResult {
  base_rate: number; proposed_rate: number; room_type: string
  current_occupancy_pct: number; projected_occupancy_pct: number
  occupancy_change_pp: number; revenue_impact_pct: number; recommendation: string
}

export const getSentiment = (hotelId = 1) => api<SentimentReport>(`/hotel/sentiment?hotel_id=${hotelId}`)
export const getMaintenanceAlerts = (hotelId = 1) => api<{ alerts: MaintenanceAlert[]; total: number }>(`/hotel/maintenance/alerts?hotel_id=${hotelId}`)
export const getInventory = (hotelId = 1) => api<{ items: InventoryItem[]; count: number }>(`/hotel/inventory?hotel_id=${hotelId}`)
export const getInventoryAlerts = (hotelId = 1) => api<{ alerts: InventoryAlert[]; total: number; critical: number }>(`/hotel/inventory/alerts?hotel_id=${hotelId}`)
export const getRevenue = (hotelId = 1) => api<RevenueReport>(`/hotel/revenue?hotel_id=${hotelId}`)
export const getStaffLoad = (hotelId = 1) => api<StaffLoad>(`/hotel/staff-load?hotel_id=${hotelId}`)
export const getDailyBrief = () => api<DailyBrief>('/ops/daily-brief')

/* -------------------------------------------------------------------- Pricing */
export const getRateCalendar = (days = 14) => api<{ items: RateDay[]; days: number }>(`/hotel/rate-calendar?days=${days}`)
export const getPricingInsight = () => api<PricingInsight>('/hotel/pricing-insight')
export const simulateRate = (body: { room_type: string; base_rate: number; proposed_rate: number; current_occupancy_pct: number }) =>
  api<RateSimResult>('/hotel/rate-simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// ---------------- Guest segmentation ----------------
export interface SegmentOverview {
  segment: string
  icon: string
  count: number
  description: string
  recommended_action: string
}
export interface SegmentCountsResponse { segments: SegmentOverview[]; total: number }

export interface GuestSegment {
  segment: string
  icon: string
  description: string
  confidence: number
  signals: string[]
  recommended_action: string
}
export interface SegmentOffer {
  segment: string
  guest_name: string
  offer_headline: string
  offer_body: string
  channels: string[]
}

export const getSegmentOverview = () => api<SegmentCountsResponse>('/ops/segments')
export const getGuestSegment = (guestId: number) => api<GuestSegment>(`/ops/guests/${guestId}/segment`)
export const getSegmentOffer = (guestId: number) => api<SegmentOffer>('/ops/segment-offer', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guest_id: guestId }),
})

// ---------------- Staff scheduling ----------------
export interface ScheduleRosterDay {
  date: string; day_of_week: string; is_today: boolean; is_weekend: boolean; occupancy_pct: number
  departments: { department: string; color: string; shifts: ScheduleShift[] }[]
}
export interface ScheduleShift {
  shift: string; shift_label: string; start: string; end: string
  assigned: { id: number; name: string; position: string }[]; needed: number; available: number; gap: number; severity: string
}
export interface ScheduleRoster { start_date: string; end_date: string; days: ScheduleRosterDay[]; total_staff: number }
export interface CoverageGap {
  date: string; day_of_week: string; department: string; shift: string
  needed: number; available: number; gap: number; severity: string; occupancy_pct: number; recommendation: string
}
export interface ForecastDay { date: string; day_of_week: string; is_weekend: boolean; predicted_occupancy_pct: number; staffing_needed_total: number; band: string }
export interface ScheduleInsight { total_gaps: number; critical_gaps: number; high_gaps: number; avg_forecast_occupancy_7d: number; peak_day: string | null; peak_occupancy_pct: number | null; available: boolean }

export const getScheduleRoster = (start?: string) => api<ScheduleRoster>(`/hotel/schedule/roster${start ? `?start=${start}` : ''}`)
export const getCoverageGaps = (start?: string) => api<{ items: CoverageGap[]; total: number }>(`/hotel/schedule/coverage${start ? `?start=${start}` : ''}`)
export const getOccupancyForecast = (days = 7) => api<{ items: ForecastDay[]; days: number }>(`/hotel/schedule/forecast?days=${days}`)
export const getScheduleInsight = () => api<ScheduleInsight>('/hotel/schedule/insight')
