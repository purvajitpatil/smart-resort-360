/**
 * Toast notification component for transient messages.
 */
import { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface ToastProps {
  message: string
  visible: boolean
  onDismiss?: () => void
  duration?: number
}

export default function Toast({
  message,
  visible,
  onDismiss,
  duration = 3200,
}: ToastProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        onDismiss?.()
      }, duration)
      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [visible, onDismiss, duration])

  if (!show) return null

  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 100,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 14,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
})