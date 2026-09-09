/**
 * The guest app frame: a scrolling canvas with a fixed header.
 *
 * The tab bar is owned by the bottom-tabs navigator; this Shell is the
 * per-screen container, so it does NOT add bottom padding for a tab bar.
 * The `right` slot is a header action (logout, reset, etc.).
 */
import type { ReactNode } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

interface ShellProps {
  children: ReactNode
  title?: string
  subtitle?: string
  right?: ReactNode
  /** Optional pull-to-refresh handler. When provided, the scroll view becomes
   *  a RefreshControl so the user can manually reload the screen. */
  onRefresh?: () => void
  /** Loading flag for the refresh spinner. */
  refreshing?: boolean
}

export default function Shell({
  children,
  title,
  subtitle,
  right,
  onRefresh,
  refreshing = false,
}: ShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {title ? (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{title}</Text>
              {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
            </View>
            {right ? <View style={styles.headerRight}>{right}</View> : null}
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f9fc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
})
