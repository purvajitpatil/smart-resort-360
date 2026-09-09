/**
 * Login screen.
 * Captures email + password, hits /auth/login, stores the token, and calls
 * onLoginSuccess to flip the App-level state to the main tabs.
 */
import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { login } from '../lib/api'
import Toast from '../components/Toast'

export default function LoginScreen({
  onLoginSuccess,
}: {
  onLoginSuccess?: () => void
} = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
      if (onLoginSuccess) onLoginSuccess()
    } catch (err: any) {
      // Distinguish network errors from auth errors so the user knows
      // whether to check Wi-Fi or their credentials.
      const isNetwork =
        err?.code === 'INVALID_RESPONSE' ||
        /network|fetch failed|timeout/i.test(String(err?.message ?? ''))
      if (isNetwork) {
        setError(
          'Cannot reach the resort server. Make sure your phone is on the same Wi-Fi as the backend.',
        )
        setToastMessage('Network error — check Wi-Fi and server.')
      } else {
        setError(err?.message ?? 'Login failed')
        setToastMessage('Login failed. Check your credentials.')
      }
      setToastVisible(true)
    } finally {
      setLoading(false)
    }
  }, [email, password, onLoginSuccess])

  const useDemoCreds = useCallback(() => {
    setEmail('guest@smartresort360.demo')
    setPassword('DemoGuest!2026')
  }, [])

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="home-city" size={48} color="#4f46e5" />
          <Text style={styles.logoText}>StaySmart Guest</Text>
          <Text style={styles.logoSubtitle}>Your resort, in your pocket</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="guest@smartresort360.demo"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
          />

          {error ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#dc2626" />
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            accessibilityLabel="Sign in"
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            onPress={useDemoCreds}
            style={styles.demoButton}
            accessibilityLabel="Use demo credentials"
          >
            <MaterialCommunityIcons name="key-outline" size={16} color="#4f46e5" />
            <Text style={styles.demoButtonText}>Use demo credentials</Text>
          </TouchableOpacity>

          <Text style={styles.demoHint}>
            guest@smartresort360.demo · DemoGuest!2026
          </Text>
        </View>
      </View>

      <Toast
        message={toastMessage ?? ''}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4f46e5',
    marginTop: 8,
  },
  logoSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 4,
    backgroundColor: '#fff',
    color: '#111827',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  errorBoxText: {
    color: '#dc2626',
    fontSize: 13,
    flexShrink: 1,
    marginLeft: 6,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    gap: 6,
  },
  demoButtonText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  demoHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
})
