import { useState, useRef } from 'react'
import { Eye, EyeOff } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { CURRENCIES } from '../context/CurrencyContext'

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

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What was your childhood nickname?",
  "What is the name of the street you grew up on?",
]

const STEP_LABELS = ['Account', 'Profile', 'Security']

export default function CreateAccountPage({ onCancel }) {
  const { createAccount } = useAuth()
  const fileInputRef = useRef(null)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 — Account
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Step 2 — Profile
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [profilePicture, setProfilePicture] = useState(null)

  // Step 3 — Security
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0])
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [stayLoggedIn, setStayLoggedIn] = useState(true)

  function handlePictureSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 200; canvas.height = 200
        const ctx = canvas.getContext('2d')
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200)
        setProfilePicture(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  function validateStep1() {
    if (!username.trim()) return 'Username is required.'
    if (username.trim().length < 3) return 'Username must be at least 3 characters.'
    if (password.length < 6) return 'Password must be at least 6 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  function validateStep2() {
    if (!firstName.trim()) return 'Name is required.'
    return null
  }

  function validateStep3() {
    if (!securityAnswer.trim()) return 'Security answer is required.'
    return null
  }

  function handleNext() {
    const err = step === 1 ? validateStep1() : validateStep2()
    if (err) return setError(err)
    setError('')
    setStep(s => s + 1)
  }

  async function handleFinish() {
    const err = validateStep3()
    if (err) return setError(err)
    setError('')
    setLoading(true)
    try {
      const result = await createAccount({
        username,
        password,
        securityQuestion,
        securityAnswer,
        stayLoggedIn,
        profile: { firstName, email, currency, state, zipCode, profilePicture },
      })
      if (!result.ok) setError(result.error || 'Failed to create account.')
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-surface-900 flex items-center justify-center">
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-surface-600 border-t-accent animate-spin" />
          <p className="text-white font-semibold text-sm">Creating your account…</p>
        </div>
      )}
      <div className="w-full max-w-md mx-4">

        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-2xl font-bold text-white tracking-tight">
            <span className="text-accent">Poke</span>Price
          </span>
          <p className="text-slate-400 text-sm mt-1">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-surface-800 border border-surface-600 rounded-2xl overflow-hidden">

          {/* Step indicator */}
          <div className="flex border-b border-surface-700">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const active = step === n
              const done = step > n
              return (
                <div key={n} className="flex-1 py-3 flex flex-col items-center gap-0.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    done ? 'bg-accent text-black' : active ? 'bg-accent/20 border border-accent text-accent' : 'bg-surface-700 text-slate-500'
                  }`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`text-[10px] font-medium transition-colors ${active ? 'text-accent' : done ? 'text-slate-400' : 'text-slate-600'}`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="p-6">

            {/* ── Step 1: Account ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNext()}
                    placeholder="Choose a username"
                    autoFocus
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleNext()}
                      placeholder="At least 6 characters"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleNext()}
                      placeholder="Re-enter password"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Profile ── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Profile picture */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full bg-accent/10 border-2 border-accent/30 hover:border-accent/60 flex items-center justify-center overflow-hidden transition-colors group"
                  >
                    {profilePicture ? (
                      <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-accent/60 group-hover:text-accent transition-colors">
                        {firstName ? firstName[0].toUpperCase() : '+'}
                      </span>
                    )}
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-accent text-xs hover:underline">
                    {profilePicture ? 'Change photo' : 'Upload photo'}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePictureSelect} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Your name"
                      autoFocus
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">Currency</label>
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                    >
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">State / Province</label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                    >
                      <option value="">— Select —</option>
                      {Object.entries(STATE_PROVINCES).map(([country, states]) => (
                        <optgroup key={country} label={country}>
                          {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">Zip Code</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={e => setZipCode(e.target.value)}
                      placeholder="e.g. 60601"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Security ── */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-slate-400 text-sm">This is used to recover your account if you forget your password.</p>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Security Question</label>
                  <select
                    value={securityQuestion}
                    onChange={e => setSecurityQuestion(e.target.value)}
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                  >
                    {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Your Answer</label>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={e => setSecurityAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFinish()}
                    placeholder="Answer (not case-sensitive)"
                    autoFocus
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-slate-300 text-sm font-medium">Stay logged in</p>
                    <p className="text-slate-500 text-xs mt-0.5">Skip login on future launches</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStayLoggedIn(v => !v)}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${stayLoggedIn ? 'bg-accent' : 'bg-surface-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${stayLoggedIn ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

            {/* Navigation buttons */}
            <div className="flex gap-3 mt-5">
              {(step > 1 || onCancel) && (
                <button
                  onClick={step > 1 ? () => { setStep(s => s - 1); setError('') } : onCancel}
                  className="flex-1 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 font-semibold py-2.5 rounded-lg text-sm transition-colors"
                >
                  {step > 1 ? 'Back' : 'Sign In'}
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={handleNext}
                  className={`font-bold py-2.5 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black transition-colors ${step > 1 || onCancel ? 'flex-1' : 'w-full'}`}
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className={`font-bold py-2.5 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black transition-colors disabled:opacity-50 ${onCancel ? 'flex-1' : 'w-full'}`}
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
