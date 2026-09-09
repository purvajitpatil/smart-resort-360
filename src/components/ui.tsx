/**
 * Shared presentational primitives for the guest app.
 */
import React from 'react'
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

type IconProps = { size?: number; color?: string }

export const Icon: Record<string, (p: IconProps) => React.ReactElement> = {
  Home: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="home" size={size} color={color} />,
  Chat: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="chat" size={size} color={color} />,
  List: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />,
  Spark: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="star-four-points" size={size} color={color} />,
  Bot: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="robot" size={size} color={color} />,
  Send: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="send" size={size} color={color} />,
  Back: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="arrow-left" size={size} color={color} />,
  Check: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="check" size={size} color={color} />,
  Key: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="key" size={size} color={color} />,
  Bell: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="bell" size={size} color={color} />,
  Trash: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="trash-can" size={size} color={color} />,
  Clock: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="clock" size={size} color={color} />,
  Logout: ({ size = 24, color }: IconProps) => <MaterialCommunityIcons name="logout" size={size} color={color} />,
}

// ------------------------------------------------------------------ Chips

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'

export function statusTone(status: string): { tone: Tone; label: string } {
  switch (status) {
    case 'COMPLETED': return { tone: 'success', label: 'Done' }
    case 'IN_PROGRESS': return { tone: 'warning', label: 'In progress' }
    case 'ASSIGNED': return { tone: 'info', label: 'Assigned' }
    case 'PENDING': return { tone: 'brand', label: 'Received' }
    case 'CANCELLED': return { tone: 'neutral', label: 'Cancelled' }
    case 'REJECTED': return { tone: 'danger', label: 'Declined' }
    default: return { tone: 'neutral', label: status }
  }
}

export interface ChipProps {
  tone?: Tone
  live?: boolean
  children: React.ReactNode
}

const TONE_COLORS: Record<Tone, string> = {
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  brand: '#8b5cf6',
  neutral: '#6b7280',
}

export const Chip = (props: ChipProps): React.ReactElement => {
  const { tone = 'neutral', live = false, children } = props
  const bg = TONE_COLORS[tone]
  return (
    <View style={[styles.chip, { backgroundColor: bg }, live && styles.chipLive]}>
      <Text style={styles.chipText}>{children}</Text>
    </View>
  )
}

// ------------------------------------------------------------------ Layout

export interface SectionProps {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}

export const Section = (props: SectionProps): React.ReactElement => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{props.title}</Text>
        {props.action}
      </View>
      <View style={styles.sectionBody}>{props.children}</View>
    </View>
  )
}

export interface EmptyProps {
  title: string
  body: string
  action?: React.ReactNode
}

export const Empty = (props: EmptyProps): React.ReactElement => {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{props.title}</Text>
      <Text style={styles.emptyBody}>{props.body}</Text>
      {props.action ? <View style={styles.emptyAction}>{props.action}</View> : null}
    </View>
  )
}

export interface LoadingProps {
  rows?: number
}

export const Loading = (props: LoadingProps): React.ReactElement => {
  const rows = props.rows ?? 3
  return (
    <View style={styles.loadingContainer}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.skeleton, i > 0 ? styles.skeletonSpacing : null]} />
      ))}
    </View>
  )
}

export interface ErrorNoteProps {
  message: string
  onRetry?: () => void
}

export const ErrorNote = (props: ErrorNoteProps): React.ReactElement => {
  return (
    <View style={styles.errorNote}>
      <Text style={styles.errorText}>{props.message}</Text>
      {props.onRetry ? (
        <Pressable style={styles.errorButton} onPress={props.onRetry}>
          <Text style={styles.errorButtonText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export interface ConfidenceProps {
  value: number
}

export const Confidence = (props: ConfidenceProps): React.ReactElement => {
  const pct = Math.round(props.value * 100)
  return (
    <View style={styles.confidenceContainer}>
      <View style={[styles.confidenceTrack, { width: `${Math.max(6, pct)}%` }]}>
        <View style={styles.confidenceFillInner} />
      </View>
      <Text style={styles.confidenceText}>{pct}%</Text>
    </View>
  )
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

// ------------------------------------------------------------------ Buttons

export interface ButtonProps {
  onPress: () => void
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'default' | 'large' | 'small'
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}

const VARIANT_STYLES: Record<NonNullable<ButtonProps['variant']>, ViewStyle> = {
  primary: { backgroundColor: '#4f46e5' },
  secondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  ghost: { backgroundColor: 'transparent' },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d1d5db' },
}

const SIZE_STYLES: Record<NonNullable<ButtonProps['size']>, ViewStyle> = {
  default: { paddingHorizontal: 16 },
  large: { height: 52, paddingHorizontal: 20 },
  small: { height: 36, paddingHorizontal: 12 },
}

export const Button = (props: ButtonProps): React.ReactElement => {
  const {
    onPress,
    children,
    variant = 'primary',
    size = 'default',
    disabled = false,
    loading = false,
    style,
  } = props
  const variantStyle = VARIANT_STYLES[variant]
  const sizeStyle = SIZE_STYLES[size]

  // Choose the text color that matches the background.
  const textColorByVariant: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: '#ffffff',
    secondary: '#374151',
    ghost: '#4f46e5',
    outline: '#374151',
  }
  const textColor = textColorByVariant[variant]

  return (
    <Pressable
      style={[
        styles.button,
        sizeStyle,
        variantStyle,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : '#4f46e5'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: textColor },
            size === 'small' && styles.buttonTextSmall,
            size === 'large' && styles.buttonTextLarge,
            (disabled || loading) && styles.buttonTextDim,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  )
}

// ------------------------------------------------------------------ Styles

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  chipLive: {
    borderWidth: 2,
    borderColor: '#fff',
  },

  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionBody: {},

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyAction: {
    marginTop: 16,
  },

  loadingContainer: {
    marginTop: 8,
  },
  skeleton: {
    height: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  skeletonSpacing: {
    marginTop: 8,
  },

  errorNote: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 8,
  },
  errorButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#dc2626',
    borderRadius: 6,
    alignItems: 'center',
  },
  errorButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceTrack: {
    height: 4,
    width: 60,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFillInner: {
    height: '100%',
    backgroundColor: '#fff',
  },
  confidenceText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },

  button: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonTextSmall: {
    fontSize: 13,
  },
  buttonTextLarge: {
    fontSize: 17,
  },
  buttonTextDim: {
    color: '#9ca3af',
  },
})