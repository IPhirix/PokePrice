'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogin() {
    if (!email.trim() || !password) return setError('Enter your email or username and password.')
    setError('')
    setLoading(true)
    try {
      let resolvedEmail = email.trim()
      if (!resolvedEmail.includes('@')) {
        const res = await fetch('/api/auth/lookup-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: resolvedEmail }),
        })
        if (!res.ok) { setError('No account found for that username.'); return }
        const data = await res.json()
        resolvedEmail = data.email
      }
      const { error: err } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password })
      if (err) { setError(err.message); return }
      router.push('/')
      router.refresh()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-white tracking-tight">
            <span className="text-accent">Poke</span>Price
          </span>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Email or Username</label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="you@example.com or jason"
              autoFocus
              className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Your password"
                className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-black font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <p className="text-slate-500">
              No account?{' '}
              <Link href="/signup" className="text-accent hover:text-amber-400 transition-colors font-medium">
                Create one
              </Link>
            </p>
            <Link href="/forgot-password" className="text-slate-500 hover:text-slate-300 transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
