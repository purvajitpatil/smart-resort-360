/**
 * Staff-side domain types and API wrappers.
 */
import { api } from './api'

/* ---------------------------------------------------------------- Hotel */
export interface RoomOut {
  id: number; number: string; floor: number; room_type: string; status: string; capacity: number
}
export interface StaffStats {
  rooms: { total: number; clean: number; occupied: number; dirty: number; under_repair: number }
  requests: { pending: number; in_progress: number; completed_today: number; overdue: number }
  check_ins_today: number; check_outs_today: number; occupancy_pct: number
}

export const getHotelStats = () => api<StaffStats>('/hotel/overview')
export const listRooms = () => api<{ items: RoomOut[]; total: number }>('/hotel/rooms')

/* ------------------------------------------------------------- Requests */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
export interface RequestHistory { from_status: string | null; to_status: string; note: string | null; at: string }
export interface ServiceRequest {
  id: number; code: string; category: string; title: string; description: string | null
  quantity: number; priority: Priority; status: string; room_number: string | null
  department: string | null; assigned_to: string | null; guest_name: string
  sla_minutes: number | null; sla_deadline: string | null; sla_overdue: boolean
  resolved_at: string | null; created_at: string; history: RequestHistory[]
}
export interface QueueStats { total: number; pending: number; in_progress: number; overdue: number }

export const listBoardRequests = (params?: string) =>
  api<{ items: ServiceRequest[]; total: number; stats: QueueStats }>('/requests' + (params ? '?' + params : ''))
export const assignRequest = (code: string, note?: string) =>
  api<ServiceRequest>(`/requests/${code}/assign${note ? '?note=' + encodeURIComponent(note) : ''}`, { method: 'PATCH' })
export const startRequest = (code: string) =>
  api<ServiceRequest>(`/requests/${code}/start`, { method: 'PATCH' })
export const completeRequest = (code: string) =>
  api<ServiceRequest>(`/requests/${code}/complete`, { method: 'PATCH' })

/* --------------------------------------------------------------- Memory */
export interface MemoryAction {
  memory_id: number; key: string; action: string; because: string
  confidence: number; kind: string; observations: number; stays_seen: number; auto: boolean
}
export interface GuestBrief {
  guest: { id: number; name: string }; room: string | null; returning_guest: boolean
  has_history: boolean; memory_count: number
  actions: MemoryAction[]; cold_start: { key: string; ask: string | null; action: string; basis: string; kind: string; confidence: number }[]
}
export const getGuestBrief = (guestId: number) => api<GuestBrief>(`/ops/guests/${guestId}/brief`)

/* ---------------------------------------------------------- Escalations */
export interface EscalationRow {
  code: string; title: string; room: string | null; priority: string; status: string
  state: 'on_track' | 'at_risk' | 'breached' | 'closed'
  sla_minutes: number; elapsed_minutes: number; remaining_minutes: number
  deadline: string; percent_used: number; tier: number; tier_role: string; tier_note: string; night: boolean
}
export interface EscalationData {
  items: EscalationRow[]; total: number; breached: number; at_risk: number; night_shift: boolean
}
export const getEscalations = (hotelId = 1) =>
  api<EscalationData>(`/ops/escalations?hotel_id=${hotelId}`)

export const explainRouting = (title: string, category: string, at?: string) =>
  api<{ priority: string; department: string; sla_minutes: number; night: boolean; walkthrough: string }>(
    '/ops/routing/explain',
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, at }) }
  )
