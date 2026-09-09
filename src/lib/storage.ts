/**
 * AsyncStorage wrapper matching the localStorage interface used by
 * apps/guest-web/src/lib/api.ts so the same code can be reused.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

const ACCESS_KEY = 'smrt360_access'
const REFRESH_KEY = 'smrt360_refresh'
const USER_KEY = 'smrt360_user'

export interface User {
  id: string
  email: string
  full_name: string
  role: string
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

export async function getAccessToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem(ACCESS_KEY)
  if (!token || token === 'undefined' || token === 'null') {
    await clearAuth()
    return null
  }
  return token
}

export async function getRefreshToken(): Promise<string | null> {
  return await AsyncStorage.getItem(REFRESH_KEY)
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export async function storeSession(access: string, refresh: string, user: User): Promise<void> {
  await AsyncStorage.setItem(ACCESS_KEY, access)
  await AsyncStorage.setItem(REFRESH_KEY, refresh)
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_KEY)
  await AsyncStorage.removeItem(REFRESH_KEY)
  await AsyncStorage.removeItem(USER_KEY)
}