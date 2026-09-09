/**
 * Auth context — exposes the App-level logout handler to any descendant
 * screen. We can't rely on React Navigation's `reset` because the tabs
 * stack is mounted *inside* a stack screen that owns the Login/Main
 * swap. The single source of truth is `hasToken` in App.tsx, so the
 * log-out handler has to live there too — this context is how the
 * screens reach it.
 */
import { createContext, useContext } from 'react'

export interface AuthContextValue {
  onLogout: () => Promise<void> | void
}

export const AuthContext = createContext<AuthContextValue>({
  onLogout: () => {
    /* default no-op so screens render cleanly outside of a provider */
  },
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
