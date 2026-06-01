import { useState } from 'react'
import { Eye, EyeOff } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import ResetPasswordModal from '../components/ResetPasswordModal'

export default function LoginPage({ onCreateAccount }) {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handleLogin() {
    if (!username.trim() || !password) return setError('Please enter your username and password.')
    setError('')
    setLoading(true)
    try {
      const result = await login(username.trim(), password)
      if (!result.ok) setError(result.error || 'Login failed.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-surface-900 flex flex-col">
      {/* Custom title bar */}
      <div
        className="flex items-center justify-between px-4 h-10 bg-surface-900 border-b border-surface-600 select-none flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-accent font-bold text-sm tracking-widest">POKEPRICE</span>
        <div className="flex gap-1 items-center" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => window.api.windowMinimize()}
            className="w-8 h-8 rounded hover:bg-surface-500 flex items-center justify-center text-slate-400 hover:text-slate-200"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="2" y1="6.5" x2="11" y2="6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          <button
            onClick={() => window.api.windowMaximize()}
            className="w-8 h-8 rounded hover:bg-surface-500 flex items-center justify-center text-slate-400 hover:text-slate-200"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="2" width="9" height="9" stroke="currentColor" strokeWidth="1.8" rx="0.5"/></svg>
          </button>
          <button
            onClick={() => window.api.windowClose()}
            className="w-8 h-8 rounded hover:bg-red-600 flex items-center justify-center text-slate-400 hover:text-white"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><line x1="2.5" y1="2.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="10.5" y1="2.5" x2="2.5" y2="10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-white tracking-tight">
            <span className="text-accent">Poke</span>Price
          </span>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-surface-800 border border-surface-600 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Your username"
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
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="text-center">
            <button
              onClick={() => setShowReset(true)}
              className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {/* Create Account */}
        <div className="mt-4 text-center">
          <p className="text-slate-500 text-sm mb-2">Don't have an account?</p>
          <button
            onClick={onCreateAccount}
            className="w-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/50 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-[0_0_12px_rgba(34,211,238,0.15)] hover:shadow-[0_0_18px_rgba(34,211,238,0.3)]"
          >
            Create Account
          </button>
        </div>
      </div>

      {showReset && <ResetPasswordModal onClose={() => setShowReset(false)} />}
      </div>
    </div>
  )
}
