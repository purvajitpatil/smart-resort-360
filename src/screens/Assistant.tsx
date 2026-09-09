/**
 * AI Assistant screen.
 * Chat with the resort concierge. History is loaded from the backend on mount
 * and the most recent messages are appended locally after each send.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Shell from '../components/Shell'
import { Icon } from '../components/ui'
import { logout, getStoredUser } from '../lib/api'
import { useAuth } from '../components/AuthContext'
import { sendMessage, resetConversation, getConversation, type ChatMessage } from '../lib/domain'
import Toast from '../components/Toast'

export default function AssistantScreen() {
  const { onLogout } = useAuth()
  const [firstName, setFirstName] = useState('there')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const scrollRef = useRef<any>(null)

  useEffect(() => {
    ;(async () => {
      const u = await getStoredUser()
      if (u) setFirstName((u.full_name ?? 'there').split(' ')[0])
    })()
  }, [])

  // Load conversation on mount
  useEffect(() => {
    getConversation()
      .then((resp: any) => {
        const data = resp.messages ?? resp.data ?? []
        setMessages(Array.isArray(data) ? data : [])
      })
      .catch(() => setMessages([]))
  }, [])

  // Auto-scroll to the most recent message.
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      // Defer so the new message has been laid out.
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 50)
    }
  }, [messages, sending])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const reply: any = await sendMessage(text)
      // Backend may return either {reply: string}, {reply: ChatMessage}, or {messages: ChatMessage[]}.
      let assistantMsgs: ChatMessage[] = []
      if (Array.isArray(reply?.messages)) {
        assistantMsgs = reply.messages.filter((m: ChatMessage) => m.role === 'assistant')
      } else if (typeof reply?.reply === 'string') {
        assistantMsgs = [
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: reply.reply,
            created_at: new Date().toISOString(),
          },
        ]
      } else if (reply?.reply?.content) {
        assistantMsgs = [reply.reply]
      } else if (reply?.message?.content) {
        assistantMsgs = [reply.message]
      } else {
        assistantMsgs = [
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: 'I received that — let me look into it.',
            created_at: new Date().toISOString(),
          },
        ]
      }
      setMessages((prev) => [...prev, ...assistantMsgs])
    } catch (err: any) {
      setToastMessage(`Could not send message: ${err?.message ?? 'unknown error'}`)
      setToastVisible(true)
    } finally {
      setSending(false)
    }
  }, [input, sending])

  const handleReset = useCallback(async () => {
    if (resetting) return
    setResetting(true)
    try {
      await resetConversation()
      setMessages([])
      setToastMessage('Conversation reset')
      setToastVisible(true)
    } catch {
      setToastMessage('Could not reset conversation')
      setToastVisible(true)
    } finally {
      setResetting(false)
    }
  }, [resetting])

  const handleLogout = useCallback(async () => {
    await logout()
    await onLogout()
  }, [onLogout])

  return (
    <Shell
      title="AI Assistant"
      subtitle={`Hi ${firstName}, ask me anything`}
      right={
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.resetButton}
            disabled={resetting}
            accessibilityLabel="Reset conversation"
          >
            <Text style={styles.resetText}>{resetting ? 'Resetting…' : 'Reset'}</Text>
          </TouchableOpacity>
          <Pressable
            onPress={handleLogout}
            style={styles.logoutButton}
            accessibilityLabel="Log out"
          >
            <Icon.Logout size={22} color="#6b7280" />
          </Pressable>
        </View>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatContainer}
        keyboardVerticalOffset={80}
      >
        <View ref={scrollRef as any} style={styles.scroll}>
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="robot-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptyBody}>
                Try "I need extra pillows" or "What time is breakfast?"
              </Text>
            </View>
          ) : (
            messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <View
                  key={msg.id ?? i}
                  style={[
                    styles.messageBubble,
                    isUser ? styles.messageUser : styles.messageAssistant,
                  ]}
                >
                  {!isUser ? (
                    <MaterialCommunityIcons
                      name="robot-outline"
                      size={16}
                      color="#4f46e5"
                      style={styles.messageAvatar}
                    />
                  ) : null}
                  <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
                    {msg.content}
                  </Text>
                </View>
              )
            })
          )}

          {sending ? (
            <View style={[styles.messageBubble, styles.messageAssistant]}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={16}
                color="#4f46e5"
                style={styles.messageAvatar}
              />
              <View style={styles.typingRow}>
                <ActivityIndicator color="#4f46e5" size="small" />
                <Text style={[styles.messageText, styles.typingText]}>Assistant is thinking…</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a message…"
            value={input}
            onChangeText={setInput}
            autoCapitalize="sentences"
            returnKeyType="send"
            onSubmitEditing={send}
            editable={!sending}
            multiline
          />
          <TouchableOpacity
            onPress={send}
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            disabled={!input.trim() || sending}
            accessibilityLabel="Send message"
          >
            <Icon.Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Toast
        message={toastMessage ?? ''}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </Shell>
  )
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    marginRight: 8,
  },
  resetText: { fontSize: 12, fontWeight: '600', color: '#4f46e5' },
  logoutButton: { padding: 8 },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f8f9fc',
    minHeight: 360,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 8 },
  emptyBody: { fontSize: 13, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '85%',
    padding: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  messageUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  messageAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageAvatar: { marginRight: 6, marginBottom: 2 },
  messageText: { fontSize: 14, lineHeight: 20, color: '#111827', flexShrink: 1 },
  messageTextUser: { color: '#fff' },
  typingRow: { flexDirection: 'row', alignItems: 'center' },
  typingText: { marginLeft: 6, color: '#6b7280' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    marginRight: 8,
    backgroundColor: '#f9fafb',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
  },
  sendButtonDisabled: { opacity: 0.4 },
})
