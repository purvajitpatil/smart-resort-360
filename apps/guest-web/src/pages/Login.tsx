import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, login } from '../lib/api'

const DEMO = { email: 'guest@smartresort360.demo', password: 'DemoGuest!2026' }

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(DEMO.email)
  const [password, setPassword] = useState(DEMO.password)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check that the API is running on port 8000.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12">
      {/* The hero is the promise, not a logo lockup: this room already knows you. */}
      <div className="rise mb-10">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: 'var(--color-primary)' }}
          >
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 18h16M6 18v-5a6 6 0 0 1 12 0v5M12 5V7" />
            </svg>
          </div>
          <span className="t-label text-[var(--color-ink-dim)]">Smart Resort 360</span>
        </div>

        <h1 className="t-display max-w-[14ch]">
          The room already
          <br />
          <span style={{ color: 'var(--color-tint)' }}>knows you.</span>
        </h1>
        <p className="t-body mt-4 max-w-[34ch] text-[var(--color-ink-muted)]">
          Sign in to pick up exactly where your last stay left off.
        </p>
      </div>

      <div className="card-guest flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-2">
          <span className="t-label text-[var(--color-ink-dim)]">Email</span>
          <input
            className="field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="t-label text-[var(--color-ink-dim)]">Password</span>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>

        {error ? (
          <p className="t-body-sm rounded border border-[rgba(220,38,38,0.35)] bg-[rgba(220,38,38,0.1)] px-3 py-2 text-[#f87171]">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="btn btn-primary btn-round mt-1 w-full"
          onClick={submit}
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>

      <p className="t-body-sm mt-6 text-center text-[var(--color-ink-dim)]">
        Demo account is pre-filled. Staff dashboard runs on port 5174.
      </p>
    </div>
  )
}
