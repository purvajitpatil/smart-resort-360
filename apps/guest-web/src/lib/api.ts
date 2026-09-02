export const API_BASE = '/api/v1'

const ACCESS_KEY = 'smrt360_access'
const REFRESH_KEY = 'smrt360_refresh'
const USER_KEY = 'smrt360_user'

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
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
  const url = `${origin}${API_BASE}${path}`
  return url.startsWith('http') || url.startsWith('/') ? url : `/${url}`
}

export function getAccessToken(): string | null {
  const token = localStorage.getItem(ACCESS_KEY)
  if (!token || token === 'undefined' || token === 'null') {
    clearAuth()
    return null
  }
  return token
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function storeSession(access: string, refresh: string, user: User): void {
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch(resolveApiPath('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const envelope = await parseEnvelope<LoginResponse>(response)
  if (!response.ok || !envelope.success) {
    throw new ApiError(
      envelope.error?.code ?? 'LOGIN_FAILED',
      envelope.error?.message ?? 'Sign-in failed',
      response.status,
    )
  }
  storeSession(envelope.data.access_token, envelope.data.refresh_token, envelope.data.user)
  return envelope.data.user
}

export async function logout(): Promise<void> {
  try {
    const token = getAccessToken()
    await fetch(resolveApiPath('/auth/logout'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  } catch {
    // Ignore server errors during logout.
  } finally {
    clearAuth()
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(resolveApiPath(path), { ...options, headers })

  let envelope: Envelope<T>
  try {
    envelope = await parseEnvelope<T>(response)
  } catch {
    throw new ApiError('INVALID_RESPONSE', `Unexpected response from server (status ${response.status})`, response.status)
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

async function parseEnvelope<T>(response: Response): Promise<Envelope<T>> {
  const text = await response.text()
  if (!text.trim()) {
    return { success: response.ok, data: undefined as unknown as T, error: null }
  }
  return JSON.parse(text) as Envelope<T>
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const response = await fetch(resolveApiPath('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const envelope = await parseEnvelope<{ access_token: string; refresh_token: string }>(response)
    if (!response.ok || !envelope.success || !envelope.data?.access_token) return false
    localStorage.setItem(ACCESS_KEY, envelope.data.access_token)
    if (envelope.data.refresh_token) localStorage.setItem(REFRESH_KEY, envelope.data.refresh_token)
    return true
  } catch {
    return false
  }
}
