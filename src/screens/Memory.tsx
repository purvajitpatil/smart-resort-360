/**
 * Preferences / Memory screen.
 * Shows guest memories and lets them add new ones.
 *
 * The page is rendered inside a Shell that already has its own ScrollView,
 * so we do not wrap the list in another ScrollView (which would cause the
 * "VirtualizedLists should never be nested inside plain ScrollViews" warning).
 */
import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import Shell from '../components/Shell'
import {
  stateMemory,
  forgetMemory,
  forgetAllMemories,
  listMemories,
  type Memory,
} from '../lib/domain'
import { logout } from '../lib/api'
import { getStoredUser } from '../lib/storage'
import { Chip, Empty, Icon, timeAgo } from '../components/ui'
import Toast from '../components/Toast'
import { useAuth } from '../components/AuthContext'

export default function MemoryScreen() {
  const { onLogout } = useAuth()
  const [firstName, setFirstName] = useState('there')
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState('')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { items } = await listMemories()
      setMemories(items)
    } catch {
      setError('Could not load memories.')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    ;(async () => {
      const u = await getStoredUser()
      if (u) {
        setFirstName((u.full_name ?? 'there').split(' ')[0])
      }
    })()
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const addMemory = useCallback(async () => {
    if (!key.trim() || !summary.trim() || saving) return
    setSaving(true)
    try {
      await stateMemory(key.trim(), summary.trim())
      setKey('')
      setSummary('')
      setToastMessage('Memory saved')
      setToastVisible(true)
      await load()
    } catch {
      setToastMessage('Could not save memory.')
      setToastVisible(true)
    } finally {
      setSaving(false)
    }
  }, [key, summary, saving, load])

  const handleDelete = useCallback(async (id: number) => {
    try {
      await forgetMemory(id)
      setToastMessage('Memory deleted')
      setToastVisible(true)
      await load()
    } catch {
      setToastMessage('Could not delete memory')
      setToastVisible(true)
    }
  }, [load])

  const handleDeleteAll = useCallback(async () => {
    try {
      await forgetAllMemories()
      setToastMessage('All memories deleted')
      setToastVisible(true)
      await load()
    } catch {
      setToastMessage('Could not delete memories')
      setToastVisible(true)
    }
  }, [load])

  const handleLogout = useCallback(async () => {
    await logout()
    await onLogout()
  }, [onLogout])

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Shell
        title="Preferences"
        subtitle={`What we remember for ${firstName}`}
        onRefresh={onRefresh}
        refreshing={refreshing}
        right={
          <Pressable
            onPress={handleLogout}
            style={styles.logoutButton}
            accessibilityLabel="Log out"
          >
            <Icon.Logout size={22} color="#6b7280" />
          </Pressable>
        }
      >
        {/* Loading */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#4f46e5" />
            <Text style={styles.loadingText}>Loading memories…</Text>
          </View>
        ) : null}

        {error && !loading ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Add-memory form */}
        {!loading ? (
          <View style={styles.formSection}>
            <Text style={styles.formSectionTitle}>Add a preference</Text>
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="What did you tell us? (e.g. amenity.pillows)"
                value={key}
                onChangeText={setKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Write it so we remember next time"
                value={summary}
                onChangeText={setSummary}
                autoCapitalize="sentences"
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.addButton, saving && styles.addButtonDisabled]}
                onPress={addMemory}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.addButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Memories list */}
        {!loading && !error && memories.length === 0 ? (
          <Empty
            title="No preferences yet"
            body="Things you tell us during your stay help us serve you better next time."
          />
        ) : null}

        {memories.map((m) => (
          <View key={m.id} style={styles.memoryCard}>
            <View style={styles.memoryHeader}>
              <View style={styles.memoryInfo}>
                <Text style={styles.memoryKey}>{m.key}</Text>
                <Chip
                  tone={m.confidence >= 0.65 ? 'success' : m.confidence >= 0.35 ? 'warning' : 'danger'}
                  live={m.status === 'ACTIVE'}
                >
                  {`Confidence: ${Math.round(m.confidence * 100)}%`}
                </Chip>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(m.id)}
                style={styles.deleteButton}
                accessibilityLabel={`Delete memory ${m.key}`}
              >
                <Icon.Trash size={18} color="#dc2626" />
              </TouchableOpacity>
            </View>
            <Text style={styles.memorySummary}>{m.summary}</Text>
            <View style={styles.memoryMeta}>
              <Text style={styles.metaText}>First: {timeAgo(m.first_seen_at)}</Text>
              <View style={styles.metaDivider} />
              <Text style={styles.metaText}>Last: {timeAgo(m.last_seen_at)}</Text>
              <View style={styles.metaDivider} />
              <Text style={styles.metaText}>
                {m.stays_seen} stay{m.stays_seen !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        ))}

        {memories.length > 0 ? (
          <View style={styles.clearAllContainer}>
            <TouchableOpacity
              onPress={handleDeleteAll}
              style={styles.clearAllButton}
              accessibilityLabel="Delete all preferences"
            >
              <Icon.Trash size={14} color="#b91c1c" />
              <Text style={styles.clearAllText}>Delete all preferences</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Toast
          message={toastMessage ?? ''}
          visible={toastVisible}
          onDismiss={() => setToastVisible(false)}
        />
      </Shell>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fc' },
  loading: { padding: 24, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  errorText: { padding: 16, color: '#dc2626', fontSize: 14 },
  formSection: { marginBottom: 16 },
  formSectionTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  inputMultiline: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  addButton: {
    marginTop: 4,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  memoryCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memoryInfo: { flex: 1, flexDirection: 'column' },
  memoryKey: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  memorySummary: { fontSize: 13, color: '#374151', marginBottom: 8 },
  memoryMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11, color: '#6b7280' },
  metaDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    height: 12,
    marginHorizontal: 8,
  },
  deleteButton: { padding: 6 },
  clearAllContainer: { marginTop: 8, alignItems: 'center', marginBottom: 16 },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearAllText: { fontSize: 12, color: '#b91c1c', fontWeight: '500', marginLeft: 6 },
  logoutButton: { padding: 8 },
})
