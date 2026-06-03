import { useState, useEffect } from 'react'
import { Eye, EyeOff, X } from './icons'

export default function ResetPasswordModal({ onClose }) {
  const [tab, setTab] = useState('security')

  // Username step (shared across both tabs)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameConfirmed, setUsernameConfirmed] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  // Reset token (granted after successful verification)
  const [resetToken, setResetToken] = useState(null)

  // New password step
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [finalError, setFinalError] = useState('')
  const [finalSuccess, setFinalSuccess] = useState(false)
  const [finalLoading, setFinalLoading] = useState(false)

  // Security question flow
  const [secQuestion, setSecQuestion] = useState(null)
  const [secAnswer, setSecAnswer] = useState('')
  const [secError, setSecError] = useState('')
  const [secLoading, setSecLoading] = useState(false)

  // Email flow
  const [emailAddress, setEmailAddress] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  useEffect(() => {
    if (tab === 'security' && usernameConfirmed && !secQuestion) {
      window.api.auth.getSecurityQuestionForUser({ username: usernameInput }).then(setSecQuestion)
    }
  }, [tab, usernameConfirmed, secQuestion, usernameInput])

  async function handleConfirmUsername() {
    if (!usernameInput.trim()) return setUsernameError('Please enter your username.')
    if (tab === 'security') {
      const q = await window.api.auth.getSecurityQuestionForUser({ username: usernameInput })
      if (!q) return setUsernameError('No account found with that username.')
      setSecQuestion(q)
    }
    setUsernameError('')
    setUsernameConfirmed(true)
  }

  async function handleVerifyAnswer() {
    if (!secAnswer.trim()) return setSecError('Please enter your answer.')
    setSecLoading(true); setSecError('')
    const result = await window.api.auth.verifySecurityAnswerForUser({ username: usernameInput, answer: secAnswer })
    setSecLoading(false)
    if (!result.ok) return setSecError(result.error || 'Incorrect answer.')
    setResetToken(result.resetToken)
  }

  async function handleSendCode() {
    if (!emailAddress.trim()) return setEmailError('Please enter your email address.')
    setEmailLoading(true); setEmailError('')
    const result = await window.api.auth.sendResetEmail({ username: usernameInput, email: emailAddress })
    setEmailLoading(false)
    if (!result.ok) return setEmailError(result.error || 'Failed to send code.')
    setCodeSent(true)
  }

  async function handleVerifyCode() {
    if (!code.trim()) return setEmailError('Please enter the code.')
    setEmailLoading(true); setEmailError('')
    const result = await window.api.auth.verifyEmailCode({ code, email: emailAddress })
    setEmailLoading(false)
    if (!result.ok) return setEmailError(result.error || 'Incorrect code.')
    setResetToken(result.resetToken)
  }

  async function handleResetPassword() {
    if (newPassword.length < 6) return setFinalError('Password must be at least 6 characters.')
    if (newPassword !== confirmPassword) return setFinalError('Passwords do not match.')
    setFinalLoading(true); setFinalError('')
    const result = await window.api.auth.resetPassword({ resetToken, newPassword })
    setFinalLoading(false)
    if (!result.ok) return setFinalError(result.error || 'Reset failed.')
    setFinalSuccess(true)
  }

  function handleTabChange(t) {
    setTab(t)
    setUsernameConfirmed(false)
    setSecQuestion(null)
    setSecAnswer(''); setSecError('')
    setEmailAddress(''); setCodeSent(false); setCode(''); setEmailError('')
    setResetToken(null)
    setFinalSuccess(false)
    setFinalError('')
  }

  const inputCls = 'w-full bg-surface-700 border border-surface-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface-800 border border-surface-600 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-600 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Reset Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {finalSuccess ? (
          <div className="p-6 text-center space-y-4">
            <p className="text-emerald-400 font-semibold">Password reset successfully!</p>
            <p className="text-slate-400 text-sm">You can now sign in with your new password.</p>
            <button onClick={onClose} className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
              Back to Login
            </button>
          </div>
        ) : resetToken ? (
          <div className="p-6 space-y-4">
            <p className="text-slate-300 text-sm">Enter a new password for your account.</p>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">New Password</label>
              <div className="relative">
                <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" autoFocus className={inputCls + ' pr-10'} />
                <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleResetPassword()} placeholder="Re-enter new password" className={inputCls} />
            </div>
            {finalError && <p className="text-red-400 text-sm">{finalError}</p>}
            <button onClick={handleResetPassword} disabled={finalLoading} className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              {finalLoading ? 'Saving…' : 'Set New Password'}
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-surface-600">
              {[['security', 'Security Question'], ['email', 'Email Code']].map(([id, label]) => (
                <button key={id} onClick={() => handleTabChange(id)}
                  className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === id ? 'text-accent border-b-2 border-accent' : 'text-slate-400 hover:text-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-4">
              {/* Username (always first) */}
              {!usernameConfirmed ? (
                <>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">Your Username</label>
                    <input type="text" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConfirmUsername()} placeholder="Enter your username" autoFocus className={inputCls} />
                  </div>
                  {usernameError && <p className="text-red-400 text-sm">{usernameError}</p>}
                  <button onClick={handleConfirmUsername} className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors">
                    Continue
                  </button>
                </>
              ) : (
                <>
                  {tab === 'security' && (
                    <>
                      {secQuestion && (
                        <div className="bg-surface-700 rounded-lg px-4 py-3">
                          <p className="text-slate-400 text-xs mb-1">Your security question:</p>
                          <p className="text-white text-sm font-medium">{secQuestion}</p>
                        </div>
                      )}
                      <div>
                        <label className="block text-slate-300 text-sm font-medium mb-1.5">Your Answer</label>
                        <input type="text" value={secAnswer} onChange={e => setSecAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyAnswer()} placeholder="Case-insensitive" autoFocus className={inputCls} />
                      </div>
                      {secError && <p className="text-red-400 text-sm">{secError}</p>}
                      <button onClick={handleVerifyAnswer} disabled={secLoading} className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                        {secLoading ? 'Verifying…' : 'Verify Answer'}
                      </button>
                    </>
                  )}

                  {tab === 'email' && (
                    <>
                      {!codeSent ? (
                        <>
                          <p className="text-slate-400 text-sm">We'll send a 6-digit code to your email.</p>
                          <div>
                            <label className="block text-slate-300 text-sm font-medium mb-1.5">Email Address</label>
                            <input type="email" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendCode()} placeholder="your@email.com" autoFocus className={inputCls} />
                          </div>
                          {emailError && <p className="text-red-400 text-sm">{emailError}</p>}
                          <button onClick={handleSendCode} disabled={emailLoading} className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                            {emailLoading ? 'Sending…' : 'Send Code'}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-slate-400 text-sm">Enter the code sent to <span className="text-slate-200">{emailAddress}</span>.</p>
                          <div>
                            <label className="block text-slate-300 text-sm font-medium mb-1.5">Reset Code</label>
                            <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && handleVerifyCode()} placeholder="123456" maxLength={6} autoFocus className={inputCls + ' tracking-widest text-center text-lg'} />
                          </div>
                          {emailError && <p className="text-red-400 text-sm">{emailError}</p>}
                          <button onClick={handleVerifyCode} disabled={emailLoading} className="w-full bg-accent hover:bg-accent-hover text-black font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                            {emailLoading ? 'Verifying…' : 'Verify Code'}
                          </button>
                          <button onClick={() => { setCodeSent(false); setCode(''); setEmailError('') }} className="w-full text-slate-400 hover:text-slate-200 text-sm transition-colors">
                            Send a new code
                          </button>
                        </>
                      )}
                    </>
                  )}

                  <button onClick={() => { setUsernameConfirmed(false); setSecQuestion(null) }} className="w-full text-slate-500 hover:text-slate-300 text-xs transition-colors">
                    ← Different username
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
