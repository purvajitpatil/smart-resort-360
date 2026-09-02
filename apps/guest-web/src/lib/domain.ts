/**
 * Domain types and typed endpoint wrappers.
 *
 * Kept apart from `api.ts` (which owns transport, tokens and refresh) so the
 * screens import meaning rather than URLs.
 */
import { api } from './api'

/* ---------------------------------------------------------------- Stay */

export interface Room {
  id: number
  number: string
  floor: number
  room_type: string
  status: string
  capacity: number
  rate_per_night: number
}

export interface Stay {
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

export const getStay = () => api<Stay>('/guest/stay/current')

/* ------------------------------------------------------------- Requests */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface RequestHistory {
  from_status: string | null
  to_status: string
  note: string | null
  at: string
}

export interface ServiceRequest {
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
  sla_minutes?: number | null
  sla_deadline: string | null
  sla_overdue: boolean
  resolved_at: string | null
  created_at?: string
  history?: RequestHistory[]
  user_rating?: number | null
}

export const listRequests = () =>
  api<{ items: ServiceRequest[]; total: number }>('/requests/mine')

export const createRequest = (body: {
  category: string
  title: string
  description?: string
  quantity?: number
  priority: Priority
}) =>
  api<ServiceRequest>('/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const cancelRequest = (code: string) =>
  api<ServiceRequest>(`/requests/${code}/cancel`, { method: 'POST' })

export const rateRequest = (code: string, rating: number, comment?: string) =>
  api<{ rated: boolean; code: string; rating: number }>(`/requests/mine/${code}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment }),
  })

/* --------------------------------------------------------------- Memory */

export type MemoryKind = 'STATED' | 'OBSERVED' | 'INFERRED'

export interface Memory {
  id: number
  key: string
  summary: string
  kind: MemoryKind
  status: string
  confidence: number
  observations: number
  stays_seen: number
  action: string | null
  first_seen_at: string | null
  last_seen_at: string | null
}

export const listMemories = () =>
  api<{ items: Memory[]; total: number; returning_guest: boolean }>('/memory/mine')

export const forgetMemory = (id: number) =>
  api<{ forgotten: Memory }>(`/memory/mine/${id}`, { method: 'DELETE' })

export const forgetAllMemories = () =>
  api<{ forgotten: number }>('/memory/mine', { method: 'DELETE' })

export const stateMemory = (key: string, summary: string) =>
  api<Memory>('/memory/mine/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, summary }),
  })

/* ----------------------------------------------------------------- Chat */

export interface ChatMessage {
  id: number | string
  role: 'user' | 'assistant' | string
  content: string
  created_at: string
  meta?: Record<string, unknown> | null
}

export interface ChatReply {
  messages?: ChatMessage[]
  reply?: ChatMessage
  message?: ChatMessage
  actions?: unknown[]
  [key: string]: unknown
}

export const getConversation = () => api<ChatReply>('/chat/conversation')

export const sendMessage = (content: string) =>
  api<ChatReply>('/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })

export const resetConversation = () => api<unknown>('/chat/conversation', { method: 'DELETE' })

/* -------------------------------------------------------- Notifications */

export interface Notification {
  id: number
  channel: string
  title: string
  body: string
  read: boolean
  demo: boolean
  created_at: string
}

export const listNotifications = () =>
  api<{ items: Notification[]; total: number; unread: number }>('/notifications')

export const markAllRead = () => api<unknown>('/notifications/read-all', { method: 'POST' })

/* ---------------------------------------------------------------- Travel */

export interface Poi {
  id: number
  name: string
  category: string
  rating: number
  price_level: number
  visit_minutes: number
  description: string | null
}

export interface Recommendation {
  poi: Poi
  score: number
  factors: Record<string, number>
  reason: string
}

export const listRecommendations = () =>
  api<{ items: Recommendation[]; total: number }>('/recommendations')

/* ------------------------------------------------------------ Catalogue */

/**
 * The request catalogue the quick-action grid is built from.
 * Categories match the backend router's vocabulary exactly so the guest's
 * choice lands in the right department without a translation layer.
 */
export const CATALOGUE: {
  category: string
  label: string
  items: { title: string; priority: Priority }[]
}[] = [
  {
    category: 'Housekeeping',
    label: 'Housekeeping',
    items: [
      { title: 'Extra pillows', priority: 'LOW' },
      { title: 'Extra towels', priority: 'LOW' },
      { title: 'Mineral water bottles', priority: 'LOW' },
      { title: 'Clean the room', priority: 'LOW' },
    ],
  },
  {
    category: 'Food',
    label: 'Food & drink',
    items: [
      { title: 'Vegetarian thali', priority: 'LOW' },
      { title: 'Masala chai', priority: 'LOW' },
      { title: 'Late-night snack', priority: 'LOW' },
    ],
  },
  {
    category: 'Maintenance',
    label: 'Maintenance',
    items: [
      { title: 'Room not cooling', priority: 'MEDIUM' },
      { title: 'Room is noisy', priority: 'MEDIUM' },
      { title: 'Water leak in bathroom', priority: 'HIGH' },
    ],
  },
  {
    category: 'Front Desk',
    label: 'Front desk',
    items: [
      { title: 'Late checkout', priority: 'LOW' },
      { title: 'Airport cab', priority: 'MEDIUM' },
    ],
  },
]
