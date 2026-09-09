/**
 * Authentication gate — redirects to login if no access token.
 *
 * Adapted from apps/guest-web/src/components/RequireAuth.tsx
 */
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import { getAccessToken } from '../lib/storage'

interface RequireAuthProps {
  children: ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const navigation = useNavigation<any>()

  useEffect(() => {
    // Check auth state on mount
    getAccessToken().then((token) => {
      if (!token) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
      }
    })
  }, [navigation])

  // Return null while checking, then children once verified
  return <>{children}</>
}