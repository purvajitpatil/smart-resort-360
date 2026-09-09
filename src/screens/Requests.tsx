/**
 * Requests screen.
 * Lists every service request this guest has submitted, with status chips
 * and an in-place star-rating UI for completed requests.
 */
import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Shell from '../components/Shell'
import {
  cancelRequest,
  rateRequest,
  listRequests,
  type ServiceRequest,
} from '../lib/domain'
import { logout, getStoredUser } from '../lib/api'
import { useAuth } from '../components/AuthContext'
import { Chip, Empty, Icon, statusTone } from '../components/ui'
import Toast from '../components/Toast'

const OPEN_STATUSES = new Set(['PENDING', 'ASSIGNED', 'IN_PROGRESS'])

export default function RequestsScreen() {
  const { onLogout } = useAuth()
  const [firstName, setFirstName] = useState<string>('there')
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ratingFor, setRatingFor] = useState<string | null>(null)
  const [ratingValue, setRatingValue] = useState<number>(5)
  const [ratingComment, setRatingComment] = useState<string>('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { items } = await listRequests()
      setRequests(items)
    } catch {
      setError('Could not load requests.')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    ;(async () => {
      const u = await getStoredUser()
      if (u) setFirstName((u.full_name ?? 'there').split(' ')[0])
    })()
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function handleRate(request: ServiceRequest) {
    setRatingFor(request.code)
    setRatingValue(request.user_rating ?? 5)
    setRatingComment('')
  }

  async function submitRating() {
    if (!ratingFor || submittingRating) return
    setSubmittingRating(true)
    try {
      await rateRequest(ratingFor, ratingValue, ratingComment.trim() || undefined)
      setToastMessage('Thank you for your rating!')
      setToastVisible(true)
      setRatingFor(null)
      setRatingComment('')
      await load()
    } catch {
      setToastMessage('Could not submit rating.')
      setToastVisible(true)
    } finally {
      setSubmittingRating(false)
    }
  }

  async function handleCancel(code: string) {
    setCancelling(code)
    try {
      await cancelRequest(code)
      setToastMessage('Request cancelled')
      setToastVisible(true)
      await load()
    } catch {
      setToastMessage('Could not cancel request')
      setToastVisible(true)
    } finally {
      setCancelling(null)
    }
  }

  async function handleLogout() {
    await logout()
    await onLogout()
  }

  const open = requests.filter((r) => OPEN_STATUSES.has(r.status))

  return (
    <Shell
      title="Your requests"
      subtitle={`${firstName}, track live`}
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
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#4f46e5" />
          <Text style={styles.loadingText}>Loading requests…</Text>
        </View>
      ) : null}

      {error && !loading ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && !error && requests.length === 0 ? (
        <Empty
          title="No requests"
          body="Any service requests you submit will appear here with live status."
        />
      ) : null}

      {!loading && open.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>In progress</Text>
          {open.map((r) => (
            <RequestCard
              key={r.code}
              r={r}
              onCancel={() => handleCancel(r.code)}
              onRate={() => handleRate(r)}
              cancelling={cancelling === r.code}
            />
          ))}
        </View>
      ) : null}

      {!loading && requests.filter((r) => !OPEN_STATUSES.has(r.status)).length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {requests
            .filter((r) => !OPEN_STATUSES.has(r.status))
            .map((r) => (
              <RequestCard
                key={r.code}
                r={r}
                onCancel={() => handleCancel(r.code)}
                onRate={() => handleRate(r)}
                cancelling={cancelling === r.code}
              />
            ))}
        </View>
      ) : null}

      {/* Rating form */}
      {ratingFor ? (
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>Rate {ratingFor}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setRatingValue(n)}
                accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
              >
                <MaterialCommunityIcons
                  name={n <= ratingValue ? 'star' : 'star-outline'}
                  size={32}
                  color={n <= ratingValue ? '#f59e0b' : '#9ca3af'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.ratingInput}
            placeholder="Optional comment"
            value={ratingComment}
            onChangeText={setRatingComment}
            multiline
          />
          <View style={styles.ratingActions}>
            <TouchableOpacity
              style={[styles.ratingButton, styles.ratingButtonGhost]}
              onPress={() => setRatingFor(null)}
              disabled={submittingRating}
            >
              <Text style={styles.ratingButtonGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ratingButton, styles.ratingButtonPrimary]}
              onPress={submitRating}
              disabled={submittingRating}
            >
              {submittingRating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.ratingButtonPrimaryText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Toast
        message={toastMessage ?? ''}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </Shell>
  )
}

function RequestCard({
  r,
  onCancel,
  onRate,
  cancelling,
}: {
  r: ServiceRequest
  onCancel: () => void
  onRate: () => void
  cancelling: boolean
}) {
  const tone = statusTone(r.status).tone
  const label = statusTone(r.status).label
  const isOpen = OPEN_STATUSES.has(r.status)
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestCode}>{r.code}</Text>
        <Chip tone={tone} live={r.status === 'IN_PROGRESS'}>
          {label}
        </Chip>
      </View>

      <Text style={styles.requestTitle}>{r.title}</Text>
      <Text style={styles.requestMeta}>
        {r.department ?? '—'} · {r.priority ?? '—'}
        {r.sla_minutes ? ` · SLA ${r.sla_minutes}m` : ''}
      </Text>

      {r.description ? <Text style={styles.requestDescription}>{r.description}</Text> : null}

      <View style={styles.requestActions}>
        {r.status === 'COMPLETED' ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRate}
            accessibilityLabel={`Rate ${r.code}`}
          >
            <MaterialCommunityIcons
              name={r.user_rating ? 'star' : 'star-plus-outline'}
              size={16}
              color={r.user_rating ? '#f59e0b' : '#4f46e5'}
            />
            <Text style={styles.actionText}>
              {r.user_rating ? `Rated ${r.user_rating}/5` : 'Rate this request'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {isOpen ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={onCancel}
            disabled={cancelling}
            accessibilityLabel={`Cancel ${r.code}`}
          >
            {cancelling ? (
              <ActivityIndicator color="#dc2626" size="small" />
            ) : (
              <Text style={[styles.actionText, styles.actionTextDanger]}>Cancel</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  loadingCenter: { padding: 24, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  errorText: { padding: 16, color: '#dc2626', fontSize: 14 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  requestCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestCode: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  requestTitle: { fontSize: 15, fontWeight: '500', color: '#111827', marginBottom: 4 },
  requestMeta: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  requestDescription: { fontSize: 13, color: '#374151', marginBottom: 8 },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonDanger: { backgroundColor: '#fee2e2' },
  actionText: { fontSize: 12, color: '#4f46e5', fontWeight: '500', marginLeft: 4 },
  actionTextDanger: { color: '#dc2626' },
  ratingCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  ratingTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
  ratingInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  ratingActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  ratingButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8 },
  ratingButtonGhost: { backgroundColor: 'transparent' },
  ratingButtonGhostText: { color: '#6b7280', fontWeight: '500' },
  ratingButtonPrimary: { backgroundColor: '#4f46e5' },
  ratingButtonPrimaryText: { color: '#fff', fontWeight: '600' },
  logoutButton: { padding: 8 },
})
