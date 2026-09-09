/**
 * Transport-agnostic API layer — mirrors apps/guest-web/src/lib/api.ts
 * but uses AsyncStorage via the storage adapter.
 */
import { getAccessToken, getRefreshToken, getStoredUser, storeSession, clearAuth } from './storage'
export { getStoredUser, clearAuth }

// On web, fall back to same-origin /api/v1.
// On native (Expo Go), prefer EXPO_PUBLIC_API_BASE from .env, otherwise default to a known LAN IP.
//
// IMPORTANT: update this default if your computer's IP changes (run `ipconfig`).
// The .env value (set at bundle time) takes precedence, so for production/demo you
// should keep .env in sync.
const NATIVE_DEFAULT_API = 'http://192.168.0.119:8000/api/v1'

function getApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return '/api/v1'



  }
  return NATIVE_DEFAULT_API
}

const API_BASE = getApiBase()

// Log the resolved base once on module load so you can confirm in Metro logs
// that the phone is talking to the right backend.
if (typeof console !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[StaySmart] API base resolved to:', API_BASE)
}

export interface User {
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

function resolveApiPath(path: string): string {
  return `${API_BASE}${path}`
}

async function parseEnvelope<T>(response: Response): Promise<Envelope<T>> {
  const text = await response.text()
  if (!text.trim()) {
    return { success: response.ok, data: undefined as unknown as T, error: null }
  }
  return JSON.parse(text) as Envelope<T>
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch(resolveApiPath('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const envelope = await parseEnvelope<{ access_token: string; refresh_token: string; user: User }>(response)
  if (!response.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.code ?? 'LOGIN_FAILED',
      envelope.error?.message ?? 'Sign-in failed',
      response.status,
    )
  }
  await storeSession(envelope.data.access_token, envelope.data.refresh_token, envelope.data.user)
  return envelope.data.user
}

export async function logout(): Promise<void> {
  try {
    const token = await getAccessToken()
    if (token) {
      await fetch(resolveApiPath('/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch {
    // Ignore server errors during logout.
  } finally {
    await clearAuth()
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  const token = await getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(resolveApiPath(path), { ...options, headers })

  let envelope: Envelope<T>
  try {
    envelope = await parseEnvelope<T>(response)
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      `Unexpected response from server (status ${response.status})`,
      response.status,
    )
  }

  const tokenExpired = response.status === 401 && envelope.error?.code === 'TOKEN_EXPIRED'
  if (tokenExpired && !isRetry) {
    const refreshed = await refreshTokens()
    if (refreshed) {
      return api<T>(path, options, true)
    }
  }

  if (!response.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.code ?? 'REQUEST_FAILED',
      envelope.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
    )
  }

  return envelope.data
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false
  try {
    const response = await fetch(resolveApiPath('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const envelope = await parseEnvelope<{ access_token: string; refresh_token: string }>(response)
    if (!response.ok || !envelope.success || !envelope.data?.access_token) return false
    const user = await getStoredUser()
    if (!user) return false
    await storeSession(
      envelope.data.access_token,
      envelope.data.refresh_token ?? refreshToken,
      user,
    )
    return true
  } catch {
    return false
  }
}