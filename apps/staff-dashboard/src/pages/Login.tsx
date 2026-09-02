import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, login } from '../lib/api'
import { AlertBanner } from '../components/ui'

const DEMO_ACCOUNTS = [
  { label: 'Staff',   email: 'suresh@smartresort360.demo',   password: 'DemoStaff!2026' },
  { label: 'Manager', email: 'manager@smartresort360.demo', password: 'DemoManager!2026' },
  { label: 'Admin',   email: 'admin@smartresort360.demo',   password: 'DemoManager!2026' },
]

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState(DEMO_ACCOUNTS[0].email)
  const [password, setPassword] = useState(DEMO_ACCOUNTS[0].password)
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)

  function pickDemo(acc: typeof DEMO_ACCOUNTS[0]) {
    setEmail(acc.email); setPassword(acc.password); setError(null)
  }

  async function submit() {
    setBusy(true); setError(null)
    try {
      await login(email.trim(), password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Cannot reach the API on port 8000.')
    } finally { setBusy(false) }
  }

  return (
    <div
      className="flex min-h-screen"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Left: brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-14 w-[42%]"
        style={{ background: 'var(--color-card)', borderRight: '1px solid var(--color-hair)' }}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary)' }}>
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 18h16M6 18v-5a6 6 0 0 1 12 0v5M12 5V7" />
            </svg>
          </div>
          <span className="t-label text-dim">Smart Resort 360 — Operations</span>
        </div>

        <div>
          <h1 className="t-display" style={{ color: 'var(--color-ink)', maxWidth: '11ch' }}>
            Every guest.<br />
            <span className="text-brand">Every shift.</span>
          </h1>
          <p className="t-body mt-5 text-muted" style={{ maxWidth: '36ch' }}>
            The only operations hub that remembers guest preferences across stays,
            routes requests by the clock, and escalates before SLAs breach.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {[
              { n: '87', label: 'Tests passing', sub: 'Backend fully covered' },
              { n: '15m', label: 'Night SLA', sub: 'Auto-compressed at 23:00' },
              { n: '3×', label: 'Trust tiers', sub: 'Stated > Observed > Inferred' },
            ].map(({ n, label, sub }) => (
              <div key={n} className="flex items-center gap-5">
                <span className="t-display text-brand" style={{ fontSize: 32, minWidth: 64, fontWeight: 700 }}>{n}</span>
                <div>
                  <p className="t-body-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{label}</p>
                  <p className="t-body-sm text-dim">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="t-data text-dim">SIH Hackathon Demo · Smart Resort 360 v1.0</p>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16">
        <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <h2 className="t-h2 mb-2">Staff sign-in</h2>
          <p className="t-body-sm mb-8 text-dim">Demo accounts are pre-loaded.</p>

          {/* Demo picker */}
          <div className="flex gap-2 mb-6">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.label}
                type="button"
                onClick={() => pickDemo(acc)}
                className="btn"
                style={{
                  flex: 1,
                  padding: '7px 0',
                  fontSize: 13,
                  background: email === acc.email ? 'var(--color-raised)' : 'transparent',
                  border: `1px solid ${email === acc.email ? 'rgba(79,70,229,0.6)' : 'var(--color-hair-strong)'}`,
                  color: email === acc.email ? 'var(--color-tint)' : 'var(--color-ink-muted)',
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-2 mb-4">
            <span className="t-label text-dim">Email</span>
            <input className="input" type="email" autoComplete="email" value={email}
              onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </label>
          <label className="flex flex-col gap-2 mb-5">
            <span className="t-label text-dim">Password</span>
            <input className="input" type="password" autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </label>

          {error && <div className="mb-4"><AlertBanner message={error} /></div>}

          <button type="button" className="btn btn-primary w-full" style={{ padding: 13 }} onClick={submit} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="t-body-sm mt-4 text-center text-dim">
            Guest app runs on port 5173.
          </p>
        </div>
      </div>
    </div>
  )
}
