'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSignup() {
    if (!email.trim() || !password) return setError('Enter your email and password.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (err) { setError(err.message); return }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-white font-bold text-xl mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm mb-6">
            We sent a confirmation link to <span className="text-white">{email}</span>. Click it to activate your account.
          </p>
          <Link href="/login" className="text-accent hover:text-accent-hover text-sm transition-colors">
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
          <p className="text-slate-400 text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8+ characters"
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignup()}
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
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
