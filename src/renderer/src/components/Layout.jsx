import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  const [refreshStatus, setRefreshStatus] = useState(null)

  useEffect(() => {
    window.api.onPricesRefreshing(() => setRefreshStatus('Refreshing prices...'))
    window.api.onPricesProgress((data) =>
      setRefreshStatus(`Fetching ${data.name} (${data.current}/${data.total})`)
    )
    window.api.onPricesRefreshed(() => {
      setRefreshStatus('Prices updated')
      setTimeout(() => setRefreshStatus(null), 3000)
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Custom title bar */}
      <div
        className="flex items-center justify-between px-4 h-10 bg-surface-900 border-b border-surface-600 select-none"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold text-sm tracking-widest">POKEPRICE</span>
          {refreshStatus && (
            <span className="text-xs text-slate-400 ml-4">{refreshStatus}</span>
          )}
        </div>
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

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
