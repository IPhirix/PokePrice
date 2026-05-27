import { useState, useEffect } from 'react'

export default function AppFooter({ refreshKey }) {
  const [version, setVersion] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState(null)

  useEffect(() => {
    window.api.getAppVersion().then(setVersion)
  }, [])

  useEffect(() => {
    window.api.getSettings().then((s) => setLastRefreshed(s.lastRefreshed || null))
  }, [refreshKey])

  const formatted = lastRefreshed
    ? new Date(lastRefreshed).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      })
    : '—'

  return (
    <div className="flex-shrink-0 flex items-center px-6 py-2.5 bg-surface-900 border-t border-surface-700">
      <span className="text-xs font-black tracking-widest text-slate-500 w-1/3">POKEPRICE</span>
      <span className="text-xs text-slate-600 w-1/3 text-center">Last Updated · {formatted}</span>
      <span className="text-xs text-slate-600 w-1/3 text-right">v{version}</span>
    </div>
  )
}
