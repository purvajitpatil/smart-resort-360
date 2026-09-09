/**
 * Home screen — mirrors apps/guest-web/src/pages/Home.tsx
 * Shows stay card, prepared actions, quick actions, and live requests.
 */
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Shell from '../components/Shell'
import {
  CATALOGUE,
  createRequest,
  getStay,
  listMemories,
  listRequests,
  type Memory,
  type ServiceRequest,
  type Stay,
} from '../lib/domain'
import { logout, getStoredUser } from '../lib/api'
import { Chip, Empty, ErrorNote, Icon, Loading, statusTone, timeAgo, Button } from '../components/ui'
import Toast from '../components/Toast'
import { useAuth } from '../components/AuthContext'

const OPEN_STATUSES = new Set(['PENDING', 'ASSIGNED', 'IN_PROGRESS'])

export default function HomeScreen() {
  const navigation = useNavigation<any>()
  const { onLogout } = useAuth()
  const [firstName, setFirstName] = useState('there')
  const [stay, setStay] = useState<Stay | null>(null)
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    ;(async () => {
      const u = await getStoredUser()
      if (u) {
        setFirstName((u.full_name ?? 'there').split(' ')[0])
      }
    })()
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [s, r, m] = await Promise.allSettled([getStay(), listRequests(), listMemories()])
      if (s.status === 'fulfilled') setStay(s.value)
      if (r.status === 'fulfilled') setRequests(r.value.items)
      if (m.status === 'fulfilled') setMemories(m.value.items)
      if (s.status === 'rejected' && r.status === 'rejected') {
        setError('Could not load your stay. The API may not be running.')
      }
    } catch {
      setError('Could not load your stay.')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function quickRequest(category: string, title: string, priority: 'LOW' | 'MEDIUM' | 'HIGH') {
    setSending(title)
    try {
      const created = await createRequest({ category, title, priority })
      setRequests((prev) => [created, ...prev])
      setToastMessage(`${title} — sent to ${created.department ?? 'the team'}`)
      setToastVisible(true)
      const m = await listMemories()
      setMemories(m.items)
    } catch {
      setToastMessage('Could not send that request. Try again.')
      setToastVisible(true)
    } finally {
      setSending(null)
    }
  }

  const handleLogout = async () => {
    // Clear tokens first so any in-flight requests 401 immediately,
    // then flip the App-level auth state so the Login screen mounts.
    await logout()
    await onLogout()
  }

  const open = requests.filter((r) => OPEN_STATUSES.has(r.status))
  const prepared = memories.filter((m) => m.confidence >= 0.65 && m.action).slice(0, 3)

  return (
    <Shell
      title={`Hi, ${firstName}`}
      subtitle={stay ? `${stay.hotel_name} · Room ${stay.room?.number ?? '—'}` : undefined}
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
      {loading ? <Loading rows={3} /> : null}
      {error && !loading ? <ErrorNote message={error} onRetry={onRefresh} /> : null}

      {!loading && stay ? (
        <View style={styles.content}>
          {/* ---- Stay card ---------------------------------------------- */}
          <View style={styles.stayCard}>
            <View style={styles.stayHeader}>
              <View style={styles.stayInfo}>
                <Text style={styles.stayHotel}>{stay.hotel_name}</Text>
                <Text style={styles.stayRoom}>
                  {stay.room?.number ?? '—'}
                </Text>
                <Text style={styles.stayMeta}>
                  {stay.room?.room_type ?? 'Room'} · Floor {stay.room?.floor ?? '—'}
                </Text>
              </View>
              <Chip tone={stay.checkout_today ? 'warning' : 'success'} live={!stay.checkout_today}>
                {stay.checkout_today ? 'Checkout today' : 'Checked in'}
              </Chip>
            </View>

            <View style={styles.stayGrid}>
              <Cell label="Check in" value={fmtDate(stay.check_in)} />
              <View style={styles.cellDivider} />
              <Cell label="Check out" value={fmtDate(stay.check_out)} />
              <View style={styles.cellDivider} />
              <Cell label="Nights left" value={String(Math.max(0, stay.days_remaining))} accent />
            </View>
          </View>

          {/* ---- Prepared for you -------------------------------------- */}
          {prepared.length > 0 ? (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Ready before you asked</Text>
                <Pressable
                  onPress={() => navigation.navigate('Memory')}
                  style={styles.manageButton}
                >
                  <Text style={styles.manageText}>Manage</Text>
                </Pressable>
              </View>
              <View style={styles.preparedList}>
                {prepared.map((m) => (
                  <View key={m.id} style={styles.preparedItem}>
                    <View style={styles.preparedIcon}>
                      <Icon.Check size={18} color="#22c55e" />
                    </View>
                    <View style={styles.preparedText}>
                      <Text style={styles.preparedAction}>{m.action}</Text>
                      <Text style={styles.preparedSummary}>
                        {m.summary}
                        {m.stays_seen > 1 ? ` · across ${m.stays_seen} stays` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ---- Quick actions ------------------------------------------ */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Ask for something</Text>
            <View style={styles.catalogue}>
              {CATALOGUE.map((group) => (
                <View key={group.category} style={styles.catalogueGroup}>
                  <Text style={styles.catalogueLabel}>{group.label}</Text>
                  <View style={styles.catalogueButtons}>
                    {group.items.map((item) => (
                      <View key={item.title} style={styles.catalogueButtonWrap}>
                        <Button
                          onPress={() => quickRequest(group.category, item.title, item.priority)}
                          disabled={sending !== null}
                          variant="secondary"
                          size="small"
                        >
                          {sending === item.title ? 'Sending…' : item.title}
                        </Button>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ---- Live requests ------------------------------------------ */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>In progress</Text>
              {open.length > 0 ? (
                <Pressable
                  onPress={() => navigation.navigate('Requests')}
                  style={styles.manageButton}
                >
                  <Text style={styles.manageText}>See all</Text>
                </Pressable>
              ) : null}
            </View>
            {open.length === 0 ? (
              <Empty
                title="Nothing pending"
                body="Anything you ask for shows up here with a live status."
              />
            ) : (
              <View style={styles.requestsList}>
                {open.slice(0, 3).map((r) => {
                  const tone = statusTone(r.status)
                  return (
                    <Pressable
                      key={r.code}
                      onPress={() => navigation.navigate('Requests')}
                      style={styles.requestRow}
                    >
                      <View style={styles.requestLeft}>
                        <Text style={styles.requestTitle}>{r.title}</Text>
                        <Text style={styles.requestMeta}>
                          {r.code} · {r.department ?? 'Routing…'}
                        </Text>
                      </View>
                      <Chip tone={tone.tone} live={r.status === 'IN_PROGRESS'}>
                        {tone.label}
                      </Chip>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      ) : null}

      {!loading && !stay && !error ? (
        <Empty
          title="No active stay"
          body="Once you're checked in, your room, requests and preferences appear here."
        />
      ) : null}

      <Toast
        message={toastMessage ?? ''}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </Shell>
  )
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, accent && styles.cellValueAccent]}>{value}</Text>
    </View>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  stayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  stayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stayInfo: { flex: 1 },
  stayHotel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  stayRoom: { fontSize: 28, fontWeight: '700', color: '#4f46e5', marginBottom: 2 },
  stayMeta: { fontSize: 13, color: '#9ca3af' },
  stayGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cellDivider: { width: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  cell: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  cellLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  cellValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cellValueAccent: { color: '#4f46e5' },
  sectionWrap: { marginBottom: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  preparedList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  preparedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  preparedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  preparedText: { flex: 1 },
  preparedAction: { fontSize: 14, fontWeight: '500', color: '#111827' },
  preparedSummary: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  manageButton: { paddingVertical: 4, paddingHorizontal: 4 },
  manageText: { fontSize: 14, color: '#4f46e5', fontWeight: '500' },
  catalogue: { marginTop: 8 },
  catalogueGroup: { marginBottom: 12 },
  catalogueLabel: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  catalogueButtons: { flexDirection: 'row', flexWrap: 'wrap' },
  catalogueButtonWrap: { marginRight: 8, marginBottom: 8 },
  requestsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  requestLeft: { flex: 1 },
  requestTitle: { fontSize: 14, fontWeight: '500', color: '#111827' },
  requestMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  logoutButton: { padding: 8 },
})
