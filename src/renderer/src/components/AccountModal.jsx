import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'

const COUNTRIES = [
  'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'China', 'Czech Republic',
  'Denmark', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'India', 'Ireland',
  'Italy', 'Japan', 'Luxembourg', 'Mexico', 'Netherlands', 'New Zealand', 'Norway',
  'Poland', 'Portugal', 'Romania', 'Singapore', 'South Korea', 'Spain', 'Sweden',
  'Switzerland', 'United Kingdom', 'United States',
].sort()

const STATE_PROVINCES = {
  'United States': [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
    'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma',
    'Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee',
    'Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
    'Washington D.C.',
  ],
  'Canada': [
    'Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador',
    'Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island',
    'Quebec','Saskatchewan','Yukon',
  ],
  'Australia': [
    'Australian Capital Territory','New South Wales','Northern Territory','Queensland',
    'South Australia','Tasmania','Victoria','Western Australia',
  ],
  'United Kingdom': ['England','Northern Ireland','Scotland','Wales'],
}

const COUNTRY_TO_CURRENCY = {
  'united states': 'USD', 'usa': 'USD',
  'united kingdom': 'GBP',
  'canada': 'CAD',
  'australia': 'AUD',
  'japan': 'JPY',
  'germany': 'EUR', 'france': 'EUR', 'spain': 'EUR', 'italy': 'EUR',
  'netherlands': 'EUR', 'belgium': 'EUR', 'austria': 'EUR', 'portugal': 'EUR',
  'ireland': 'EUR', 'greece': 'EUR', 'finland': 'EUR', 'luxembourg': 'EUR',
}

const CLEAR_OPTIONS = [
  { key: 'collection', label: 'Collection', desc: 'Remove all cards from your collection' },
  { key: 'watchlist', label: 'Watchlist', desc: 'Remove all cards from your watchlist' },
  { key: 'trades', label: 'Trades', desc: 'Clear all trade history records' },
  { key: 'favorites', label: 'Favorite Pokémon', desc: 'Clear all favorited Pokémon in the Pokédex' },
  { key: 'all', label: 'Everything', desc: 'Clear collection, watchlist, trades, and favorites' },
]

const ACTIVITY_DOT = {
  card_added_collection: 'bg-emerald-500',
  card_added_watchlist: 'bg-blue-500',
  binder_created: 'bg-purple-500',
  card_added_binder: 'bg-indigo-400',
  alert_set: 'bg-amber-500',
  trade_logged: 'bg-rose-400',
}

const SELECT_CLS = 'w-full px-3 py-1.5 bg-surface-700 border border-surface-500 rounded-lg text-white text-sm focus:outline-none focus:border-accent appearance-none cursor-pointer'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function ProfileField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className="text-slate-300 text-xs truncate">{value || '—'}</span>
    </div>
  )
}

export default function AccountModal({ onClose }) {
  const { format, currency, setCurrency } = useCurrency()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ firstName: '', username: '', country: '', state: '', email: '' })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [dateJoined, setDateJoined] = useState(null)
  const [confirmClearTarget, setConfirmClearTarget] = useState(null)
  const [clearSelection, setClearSelection] = useState(CLEAR_OPTIONS[0].key)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      const p = s.profile || {}
      setProfile({
        firstName: p.firstName || '',
        username: p.username || '',
        country: p.country || p.city || '',
        state: p.state || '',
        email: p.email || '',
      })
      setDateJoined(s.dateJoined || null)
    })
    loadStats()
    loadActivity()
  }, [])

  async function loadStats() {
    const s = await window.api.getAccountStats()
    setStats(s)
  }

  async function loadActivity() {
    try {
      const a = await window.api.getActivity()
      setActivity(a || [])
    } catch { setActivity([]) }
  }

  function removeActivityItem(id) {
    setActivity((prev) => prev.filter((item) => item.id !== id))
    window.api.removeActivity(id).catch(() => {})
  }

  async function saveProfile() {
    await window.api.setSettings({ profile: draft })
    setProfile(draft)
    if (draft.country) {
      const detected = COUNTRY_TO_CURRENCY[draft.country.toLowerCase().trim()]
      if (detected && detected !== currency) setCurrency(detected)
    }
    setEditing(false)
  }

  function handleCountryChange(country) {
    const statesForCountry = STATE_PROVINCES[country] || []
    const currentState = draft.state || ''
    setDraft((d) => ({
      ...d,
      country,
      state: statesForCountry.includes(currentState) ? currentState : '',
    }))
  }

  async function handleClear() {
    if (!confirmClearTarget) return
    setBusy(true)
    if (confirmClearTarget === 'favorites' || confirmClearTarget === 'all') {
      localStorage.removeItem('pokeprice-favorites')
    }
    if (confirmClearTarget !== 'favorites') {
      await window.api.clearAccountData(confirmClearTarget)
    }
    setConfirmClearTarget(null)
    setBusy(false)
    await loadStats()
    await loadActivity()
  }

  async function handleDelete() {
    if (deleteInput !== 'DELETE') return
    setBusy(true)
    localStorage.removeItem('pokeprice-favorites')
    await window.api.deleteAccount()
    onClose()
    window.location.reload()
  }

  const initials = profile.firstName ? profile.firstName.slice(0, 2).toUpperCase() : '?'
  const confirmOpt = CLEAR_OPTIONS.find((o) => o.key === confirmClearTarget)
  const stateOptions = STATE_PROVINCES[draft.country] || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Confirmation overlay */}
        {confirmClearTarget && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-xl">
            <div className="bg-surface-700 border border-surface-500 rounded-xl p-5 mx-6 shadow-2xl w-full max-w-sm">
              <h4 className="text-white font-semibold text-sm mb-1">Clear {confirmOpt?.label}?</h4>
              <p className="text-slate-400 text-xs mb-4">{confirmOpt?.desc}. This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={busy}
                  className="flex-1 py-2 text-sm font-medium bg-red-700/80 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {busy ? 'Clearing…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmClearTarget(null)}
                  className="flex-1 py-2 text-sm font-medium bg-surface-600 hover:bg-surface-500 text-slate-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700 flex-shrink-0">
          <h2 className="text-white font-semibold text-base">My Account</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Profile */}
          <div className="p-5 border-b border-surface-700">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center flex-shrink-0">
                <span className="text-accent font-bold text-xl">{initials}</span>
              </div>

              <div className="flex-1 min-w-0">
                {!editing ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <ProfileField label="Name" value={profile.firstName} />
                    <ProfileField label="Username" value={profile.username ? `@${profile.username}` : ''} />
                    <div className="col-span-2">
                      <ProfileField label="Email Address" value={profile.email} />
                    </div>
                    <ProfileField label="Country" value={profile.country} />
                    <ProfileField label="State / Province" value={profile.state} />
                    <div className="col-span-2">
                      <ProfileField
                        label="Member Since"
                        value={dateJoined
                          ? new Date(dateJoined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                          : ''}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Name</label>
                      <input
                        value={draft.firstName || ''}
                        onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-surface-700 border border-surface-500 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                      <input
                        value={draft.email || ''}
                        onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-surface-700 border border-surface-500 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Country</label>
                      <select
                        value={draft.country || ''}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className={SELECT_CLS}
                      >
                        <option value="">— Select —</option>
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">State / Province</label>
                      {stateOptions.length > 0 ? (
                        <select
                          value={draft.state || ''}
                          onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                          className={SELECT_CLS}
                        >
                          <option value="">— Select —</option>
                          {stateOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={draft.state || ''}
                          onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                          placeholder="State / Province"
                          className="w-full px-3 py-1.5 bg-surface-700 border border-surface-500 rounded-lg text-white text-sm focus:outline-none focus:border-accent"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0">
                {!editing ? (
                  <button
                    onClick={() => { setDraft({ ...profile }); setEditing(true) }}
                    className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 hover:text-white rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={saveProfile}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-600/50 text-emerald-400 rounded-lg transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-3 py-1.5 text-xs font-medium bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-400 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Account Metrics */}
          <div className="p-5 border-b border-surface-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Account Metrics</h3>
            {stats ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-surface-700 rounded-lg px-3 py-3">
                    <p className="text-xs text-slate-400 mb-1">Collection Value</p>
                    <p className="text-accent font-bold text-base">{format(stats.totalValue)}</p>
                  </div>
                  <div className="bg-surface-700 rounded-lg px-3 py-3">
                    <p className="text-xs text-slate-400 mb-1">Total Profit / Loss</p>
                    <p className={`font-bold text-base ${
                      stats.totalProfit > 0 ? 'text-emerald-400' : stats.totalProfit < 0 ? 'text-red-400' : 'text-white'
                    }`}>
                      {stats.totalProfit != null ? format(stats.totalProfit) : '—'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Collection', value: stats.portfolioCount },
                    { label: 'Watchlist', value: stats.watchlistCount },
                    { label: 'Sealed', value: stats.sealedCount },
                    { label: 'Trades', value: stats.tradeCount },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-700 rounded-lg px-2 py-2 text-center">
                      <p className="text-white font-semibold text-sm">{value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm">Loading…</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="p-5 border-b border-surface-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Activity</h3>
            {activity.length === 0 ? (
              <p className="text-slate-500 text-sm">No activity yet.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto -mx-2 px-2 space-y-0.5">
                {activity.slice(0, 5).map((item) => {
                  const hasCard = !!item.cardId
                  return (
                    <div key={item.id} className="group flex items-start gap-3 py-2 px-2 rounded-lg">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${ACTIVITY_DOT[item.type] || 'bg-slate-500'}`} />
                      <div
                        className={`flex-1 min-w-0 flex items-start gap-3 ${hasCard ? 'hover:bg-surface-700 cursor-pointer rounded-lg -mx-1 px-1 transition-colors' : ''}`}
                        onClick={hasCard ? () => { navigate(`/card/${item.cardId}`); onClose() } : undefined}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-300 text-xs truncate">{item.message}</p>
                          {item.detail && <p className="text-slate-500 text-xs truncate mt-0.5">{item.detail}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          <span className="text-slate-600 text-xs">{timeAgo(item.date)}</span>
                          {hasCard && (
                            <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeActivityItem(item.id)}
                        className="flex-shrink-0 mt-0.5 p-0.5 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                        title="Remove"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Clear Account Data */}
          <div className="p-5 border-b border-surface-700">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Clear Account Data</h3>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={clearSelection}
                  onChange={(e) => setClearSelection(e.target.value)}
                  className={SELECT_CLS + ' w-full pr-8'}
                >
                  {CLEAR_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <button
                onClick={() => setConfirmClearTarget(clearSelection)}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  clearSelection === 'all'
                    ? 'bg-red-900/30 hover:bg-red-900/50 border-red-700/50 text-red-400'
                    : 'bg-surface-600 hover:bg-surface-500 border-surface-500 text-slate-400 hover:text-white'
                }`}
              >
                Clear
              </button>
            </div>
            {clearSelection && (
              <p className="text-slate-500 text-xs mt-2">
                {CLEAR_OPTIONS.find((o) => o.key === clearSelection)?.desc}
              </p>
            )}
          </div>

          {/* Danger Zone */}
          <div className="p-5">
            <h3 className="text-xs font-semibold text-red-400/70 uppercase tracking-wider mb-3">Danger Zone</h3>
            {!showDelete ? (
              <button
                onClick={() => setShowDelete(true)}
                className="w-full py-2 text-sm font-medium bg-red-900/20 hover:bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg transition-colors"
              >
                Delete Account
              </button>
            ) : (
              <div className="p-3 bg-red-900/20 border border-red-700/40 rounded-lg">
                <p className="text-red-300 text-sm font-medium mb-1">This will permanently delete all your data.</p>
                <p className="text-slate-400 text-xs mb-3">
                  Type <span className="text-white font-mono">DELETE</span> to confirm.
                </p>
                <input
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-1.5 mb-2 bg-surface-700 border border-surface-500 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteInput !== 'DELETE' || busy}
                    className="flex-1 py-1.5 text-sm font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-40"
                  >
                    Delete Everything
                  </button>
                  <button
                    onClick={() => { setShowDelete(false); setDeleteInput('') }}
                    className="flex-1 py-1.5 text-sm font-medium bg-surface-600 hover:bg-surface-500 text-slate-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
