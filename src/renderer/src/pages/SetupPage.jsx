import { useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What was your childhood nickname?",
  "What is the name of the street you grew up on?",
]

export default function SetupPage() {
  const { setupAuth } = useAuth()
  const [step, setStep] = useState(1)

  // Step 1
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [step1Error, setStep1Error] = useState('')

  // Step 2
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0])
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [stayLoggedIn, setStayLoggedIn] = useState(true)
  const [step2Error, setStep2Error] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStep1() {
    if (!username.trim()) return setStep1Error('Username is required.')
    if (password.length < 6) return setStep1Error('Password must be at least 6 characters.')
    if (password !== confirmPassword) return setStep1Error('Passwords do not match.')
    setStep1Error('')
    setStep(2)
  }

  async function handleFinish() {
    if (!securityAnswer.trim()) return setStep2Error('Security answer is required.')
    setStep2Error('')
    setLoading(true)
    await setupAuth({ username: username.trim(), password, securityQuestion, securityAnswer, stayLoggedIn })
    setLoading(false)
  }

  return (
    <div className="h-screen w-screen bg-surface-900 flex items-center justify-center">
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <ShieldCheck size={28} className="text-accent" />
            <span className="text-2xl font-bold text-white tracking-tight">PokePrice</span>
          </div>
          <p className="text-slate-400 text-sm">Create your account to get started</p>
        </div>

        {/* Card */}
        <div className="bg-surface-800 border border-surface-600 rounded-2xl overflow-hidden">
          {/* Step indicator */}
          <div className="flex border-b border-surface-600">
            {[1, 2].map((n) => (
              <div
                key={n}
                className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${
                  step === n ? 'text-accent border-b-2 border-accent' : 'text-slate-500'
                }`}
              >
                Step {n} of 2 — {n === 1 ? 'Create Account' : 'Security Setup'}
              </div>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {step === 1 && (
              <>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                    placeholder="Enter a username"
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
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                      placeholder="At least 6 characters"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                      placeholder="Re-enter password"
                      className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {step1Error && <p className="text-red-400 text-sm">{step1Error}</p>}

                <button
                  onClick={handleStep1}
                  className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors mt-2"
                >
                  Next
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Security Question</label>
                  <select
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    className="w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                  >
                    {SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">Your Answer</label>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFinish()}
                    placeholder="Answer (case-insensitive)"
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
                    onClick={() => setStayLoggedIn((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${stayLoggedIn ? 'bg-accent' : 'bg-surface-600'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${stayLoggedIn ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {step2Error && <p className="text-red-400 text-sm">{step2Error}</p>}

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 bg-surface-700 hover:bg-surface-600 border border-surface-500 text-slate-300 font-semibold py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinish}
                    disabled={loading}
                    className="flex-1 bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Setting up…' : 'Finish Setup'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
