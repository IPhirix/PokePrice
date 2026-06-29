'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleUpdate() {
    if (!password) return setError('Enter a new password.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setDone(true)
      setTimeout(() => router.push('/'), 2000)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-500/40 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Password updated</h2>
          <p className="text-slate-400 text-sm">Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-white tracking-tight">
            <span className="text-accent">Poke</span>Price
          </span>
          <p className="text-slate-400 text-sm mt-1">Set a new password</p>
        </div>

        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8+ characters"
              autoFocus
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUpdate()}
              placeholder="Same password again"
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleUpdate}
            disabled={loading}
            className="w-full bg-accent hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
