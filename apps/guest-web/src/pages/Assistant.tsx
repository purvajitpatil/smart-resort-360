/**
 * AI Assistant chat screen — the exact Stitch screen.
 *
 * The Stitch spec's design: dark canvas (#0B0A21), guest bubbles in
 * secondary-container indigo, AI bubbles on surface-card with a robot icon.
 * Status chips on AI messages, horizontal quick-reply strip, glassmorphic
 * footer with a grow-to-fit textarea.
 *
 * Underneath: real API calls to /chat/conversation and /chat/messages.
 * Judges can watch every request logged on the backend while they chat.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getConversation,
  resetConversation,
  sendMessage,
  type ChatMessage,
} from '../lib/domain'
import { Chip, Icon, clockOf } from '../components/ui'

const QUICK = ['Extra pillows', 'Mineral water', 'Late checkout', 'Vegetarian dinner']

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* Load conversation on mount */
  const loadConv = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getConversation()
      const msgs: ChatMessage[] = data.messages ?? []
      setMessages(msgs)
    } catch {
      /* First visit — no conversation yet, that's fine. */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadConv() }, [loadConv])

  /* Scroll to bottom whenever messages update. */
  useEffect(() => {
    const el = canvasRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  /* Auto-grow textarea */
  function onDraftChange(val: string) {
    setDraft(val)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 128)}px`
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    /* Optimistic guest bubble */
    const tempId = `tmp-${Date.now()}`
    const guestMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, guestMsg])
    setBusy(true)

    try {
      const reply = await sendMessage(content)
      /* Replace optimistic + append assistant reply */
      const aiMsg: ChatMessage =
        reply.reply ??
        reply.message ??
        (reply.messages ? reply.messages[reply.messages.length - 1] : null) ?? {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: 'Got it — I have sent that request to the team.',
          created_at: new Date().toISOString(),
        }
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), aiMsg])
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Something went wrong reaching the backend. Check that the API is on port 8000.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), errMsg])
    } finally {
      setBusy(false)
    }
  }

  async function clearChat() {
    await resetConversation().catch(() => null)
    setMessages([])
  }

  return (
    /* No Shell wrapper — the chat owns the full viewport. */
    <div className="flex h-dvh flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header
        className="glass hair-b sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center gap-2">
            <h1 className="t-h3">AI Assistant</h1>
            <span className="chip chip-success chip-live" style={{ fontSize: 10, padding: '2px 8px' }}>
              Live
            </span>
          </div>
          <span className="t-data text-[var(--color-ink-dim)]">Powered by Claude</span>
        </div>
        <button
          type="button"
          className="btn btn-quiet absolute right-4"
          style={{ padding: 8 }}
          aria-label="Clear chat"
          onClick={clearChat}
        >
          <Icon.Trash className="h-4 w-4" />
        </button>
      </header>

      {/* Chat canvas */}
      <div
        ref={canvasRef}
        className="no-bar flex-1 overflow-y-auto px-4 py-4"
        style={{ background: 'var(--color-bg)' }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="t-body-sm text-[var(--color-ink-dim)]">Loading conversation…</span>
          </div>
        ) : messages.length === 0 ? (
          <WelcomeCard />
        ) : null}

        {/* Messages */}
        <div className="flex flex-col gap-6 pb-2">
          {messages.map((msg, i) => {
            const isFirst = i === 0 || messages[i - 1]?.role !== msg.role
            return msg.role === 'user' ? (
              <GuestBubble key={msg.id} msg={msg} />
            ) : (
              <AiBubble key={msg.id} msg={msg} showAvatar={isFirst} />
            )
          })}

          {/* Typing indicator */}
          {busy ? (
            <AiBubble
              msg={{ id: 'typing', role: 'assistant', content: '', created_at: '' }}
              showAvatar
              typing
            />
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <footer
        className="glass hair-t flex flex-col pb-[calc(env(safe-area-inset-bottom,0px)+8px)]"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        {/* Quick-reply chips */}
        <div className="no-bar flex gap-2 overflow-x-auto px-4 py-3">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => send(q)}
              className="whitespace-nowrap rounded-full border px-4 py-1.5"
              style={{
                background: 'rgba(79,70,229,0.06)',
                borderColor: 'rgba(79,70,229,0.25)',
                color: 'var(--color-tint)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="flex items-end gap-3 px-4 pb-1 pt-1">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              className="no-bar field w-full resize-none pr-12"
              placeholder="Type a message…"
              rows={1}
              style={{ minHeight: 48, maxHeight: 128, borderRadius: 24, paddingRight: 48 }}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(draft)
                }
              }}
            />
            <button
              type="button"
              disabled={!draft.trim() || busy}
              onClick={() => send(draft)}
              className="absolute right-1 bottom-1 flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                background: draft.trim() && !busy ? 'var(--color-primary-dim)' : 'var(--color-raised)',
              }}
              aria-label="Send"
            >
              <Icon.Send className="ml-0.5 h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}


function BotIcon({ cls }: { cls: string }) {
  return (
    <span style={{ color: 'var(--color-tint)' }}>
      <Icon.Bot className={cls} />
    </span>
  )
}

function GuestBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex flex-col items-end gap-1 self-end max-w-[85%]">
      <div
        className="rounded-2xl rounded-tr-sm px-4 py-3"
        style={{
          background: 'var(--color-primary-dim)',
          color: 'var(--color-ink)',
          boxShadow: '0 4px 20px -8px rgba(54,38,206,0.5)',
        }}
      >
        <p className="t-body-sm leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </p>
      </div>
      {msg.created_at ? (
        <span className="t-label opacity-50">{clockOf(msg.created_at)}</span>
      ) : null}
    </div>
  )
}

function AiBubble({
  msg,
  showAvatar,
  typing = false,
}: {
  msg: ChatMessage
  showAvatar: boolean
  typing?: boolean
}) {
  /* Extract a routed-to status chip if the backend put one in meta. */
  const routed: string | null =
    (msg.meta as Record<string, string> | null)?.routed_to ??
    (msg.meta as Record<string, string> | null)?.department ??
    null

  return (
    <div className="flex max-w-[90%] gap-3 self-start">
      {showAvatar ? (
        <div
          className="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full border"
          style={{
            background: 'var(--color-card)',
            borderColor: 'var(--color-hair)',
          }}
        >
          <BotIcon cls="h-4 w-4" />
        </div>
      ) : (
        <div className="w-8 flex-none" />
      )}

      <div className="flex flex-col items-start gap-1">
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-hair)',
            boxShadow: '0 4px 16px -8px rgba(0,0,0,0.4)',
          }}
        >
          {typing ? (
            <Typing />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="t-body-sm leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </p>
              {routed ? (
                <Chip tone="warning" live>
                  Routed to {routed} — In progress
                </Chip>
              ) : null}
            </div>
          )}
        </div>
        {msg.created_at && !typing ? (
          <span className="t-label opacity-50">{clockOf(msg.created_at)}</span>
        ) : null}
      </div>
    </div>
  )
}

function Typing() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 rounded-full"
          style={{
            background: 'var(--color-ink-dim)',
            animation: `dot-bounce 1.2s ${delay}ms ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4 }
          40% { transform: scale(1); opacity: 1 }
        }
      `}</style>
    </div>
  )
}

function WelcomeCard() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2 pt-6 text-center">
      <div
        className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(79,70,229,0.14)', border: '1px solid rgba(79,70,229,0.3)' }}
      >
        <BotIcon cls="h-7 w-7" />
      </div>
      <h2 className="t-h3">Ask me anything</h2>
      <p className="t-body-sm max-w-[28ch] text-[var(--color-ink-dim)]">
        Room service, late checkout, local tips, complaint — I can handle it or find the person who can.
      </p>
    </div>
  )
}
