'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { trpc } from '@/trpc/react'

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
]

const inputCls = 'w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent hover:border-surface-500 transition-colors'
const labelCls = 'text-xs text-slate-400 mb-1 block'

// ── Binder Management ─────────────────────────────────────────────────────────
function BinderManager() {
  const utils = trpc.useUtils()
  const { data: profile, isLoading } = trpc.profiles.get.useQuery()
  const updateProfile = trpc.profiles.update.useMutation({
    onSuccess: () => utils.profiles.get.invalidate(),
  })
  const [newBinder, setNewBinder] = useState('')
  const [saved, setSaved] = useState(false)

  const binders: string[] = profile?.binderLists ?? []

  function addBinder() {
    const name = newBinder.trim()
    if (!name || binders.includes(name)) return
    const updated = [...binders, name]
    updateProfile.mutate({ binderLists: updated }, {
      onSuccess: () => { setNewBinder(''); setSaved(true); setTimeout(() => setSaved(false), 1500) },
    })
  }

  function removeBinder(name: string) {
    updateProfile.mutate({ binderLists: binders.filter(b => b !== name) })
  }

  if (isLoading) return <div className="animate-pulse h-20 bg-surface-700 rounded-xl" />

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={newBinder}
          onChange={e => setNewBinder(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBinder()}
          placeholder="New binder name…"
          className={inputCls}
        />
        <button
          onClick={addBinder}
          disabled={!newBinder.trim() || updateProfile.isPending}
          className="px-4 py-2 bg-accent hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0"
        >
          Add
        </button>
      </div>

      {saved && <p className="text-xs text-emerald-400">Binder added.</p>}

      {binders.length === 0 ? (
        <p className="text-xs text-slate-600 py-2">No binders yet. Add one above.</p>
      ) : (
        <div className="space-y-1.5">
          {binders.map(b => (
            <div key={b} className="flex items-center justify-between bg-surface-700 border border-surface-600 rounded-lg px-3 py-2">
              <span className="text-sm text-slate-300">{b}</span>
              <button
                onClick={() => removeBinder(b)}
                disabled={updateProfile.isPending}
                className="text-slate-600 hover:text-red-400 transition-colors ml-3"
                title="Remove binder"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Currency Setting ──────────────────────────────────────────────────────────
function CurrencySelector() {
  const utils = trpc.useUtils()
  const { data: profile, isLoading } = trpc.profiles.get.useQuery()
  const updateProfile = trpc.profiles.update.useMutation({
    onSuccess: () => utils.profiles.get.invalidate(),
  })
  const [saved, setSaved] = useState(false)
  const [currency, setCurrency] = useState('USD')

  useEffect(() => {
    if (profile?.currency) setCurrency(profile.currency)
  }, [profile?.currency])

  function save() {
    updateProfile.mutate({ currency }, {
      onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000) },
    })
  }

  if (isLoading) return <div className="animate-pulse h-10 bg-surface-700 rounded-xl" />

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <label className={labelCls}>Display Currency</label>
        <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
          {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <button
        onClick={save}
        disabled={updateProfile.isPending || currency === profile?.currency}
        className="px-4 py-2 bg-surface-700 border border-surface-600 hover:border-surface-500 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-all disabled:opacity-40 mb-0"
      >
        {saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  )
}

// ── Password Change ───────────────────────────────────────────────────────────
function PasswordSection() {
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setStatus({ type: 'error', msg: 'Passwords do not match.' }); return }
    if (newPw.length < 6) { setStatus({ type: 'error', msg: 'Password must be at least 6 characters.' }); return }
    setLoading(true); setStatus(null)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setLoading(false)
    if (error) { setStatus({ type: 'error', msg: error.message }) }
    else { setStatus({ type: 'success', msg: 'Password updated.' }); setNewPw(''); setConfirmPw('') }
  }

  return (
    <form onSubmit={handlePasswordChange} className="space-y-3">
      <div>
        <label className={labelCls}>New Password</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className={inputCls} required />
      </div>
      <div>
        <label className={labelCls}>Confirm New Password</label>
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputCls} required />
      </div>
      {status && <p className={`text-xs ${status.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{status.msg}</p>}
      <button type="submit" disabled={loading}
        className="px-4 py-2 bg-accent text-black font-semibold rounded-lg text-sm hover:bg-amber-400 transition-colors disabled:opacity-50">
        {loading ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const sectionCls = 'bg-surface-800 border border-surface-600 rounded-2xl p-5 space-y-4'
  const headerCls = 'text-xs font-semibold text-slate-400 uppercase tracking-wider'

  return (
    <div className="max-w-xl mx-auto px-6 py-8 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Settings</h1>
        <p className="text-slate-400 text-sm">Manage preferences, binders, and account security.</p>
      </div>

      {/* Currency */}
      <div className={sectionCls}>
        <h2 className={headerCls}>Display Currency</h2>
        <CurrencySelector />
      </div>

      {/* Binders */}
      <div className={sectionCls}>
        <h2 className={headerCls}>Binder Management</h2>
        <p className="text-xs text-slate-500">Binders group cards in your collection. Create them here, then assign cards from the card detail page.</p>
        <BinderManager />
      </div>

      {/* Password */}
      <div className={sectionCls}>
        <h2 className={headerCls}>Change Password</h2>
        <PasswordSection />
      </div>

      {/* Data migration */}
      <div className={sectionCls}>
        <h2 className={headerCls}>Import from Desktop</h2>
        <p className="text-slate-400 text-sm">Moving from the PokePrice desktop app? Import your cards.json file to migrate your collection.</p>
        <a
          href="/migrate"
          className="inline-flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import cards.json
        </a>
      </div>

      {/* Danger zone */}
      <div className="bg-surface-800 border border-red-900/30 rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-semibold text-red-500 uppercase tracking-wider">Danger Zone</h2>
        <p className="text-slate-400 text-sm">Sign out of your account on this device.</p>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
          className="px-4 py-2 bg-red-900/40 border border-red-500/40 text-red-400 rounded-lg text-sm font-medium hover:bg-red-900/60 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
