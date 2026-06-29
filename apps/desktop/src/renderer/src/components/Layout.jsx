import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Layout() {
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
      {refreshStatus && (
        <div className="px-4 py-1 bg-surface-900 border-b border-surface-600 text-xs text-slate-400 select-none">
          {refreshStatus}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
