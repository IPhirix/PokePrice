'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleReset() {
    if (!email.trim()) return setError('Enter your email address.')
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      })
      if (err) { setError(err.message); return }
      setSent(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h2 className="text-white font-bold text-xl mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm mb-6">
            Reset link sent to <span className="text-white">{email}</span>. Click it to set a new password.
          </p>
          <Link href="/login" className="text-accent hover:text-amber-400 text-sm transition-colors">
            Back to sign in
          </Link>
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
          <p className="text-slate-400 text-sm mt-1">Reset your password</p>
        </div>

        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 space-y-4">
          <p className="text-slate-400 text-sm">
            Enter your account email and we&rsquo;ll send a reset link.
          </p>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleReset}
            disabled={loading}
            className="w-full bg-accent hover:bg-amber-400 text-black font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>

          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="text-accent hover:text-amber-400 transition-colors font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
