'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/react'

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  add:     { icon: '+', color: 'text-emerald-400 bg-emerald-900/30' },
  remove:  { icon: '−', color: 'text-red-400 bg-red-900/30' },
  update:  { icon: '✎', color: 'text-sky-400 bg-sky-900/30' },
  refresh: { icon: '↻', color: 'text-amber-400 bg-amber-900/30' },
  trade:   { icon: '⇄', color: 'text-violet-400 bg-violet-900/30' },
  default: { icon: '·', color: 'text-slate-500 bg-surface-700' },
}

function fmtDate(s: string) {
  const d = new Date(s)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  const hrs = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ActivityPage() {
  const utils = trpc.useUtils()
  const { data: events = [], isLoading } = trpc.activity.list.useQuery(undefined, { staleTime: 30_000 })
  const clearAll = trpc.activity.clear.useMutation({ onSuccess: () => utils.activity.list.invalidate() })
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Activity Log</h1>
          <p className="text-slate-400 text-sm">Recent actions in your account.</p>
        </div>
        {events.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Clear all?</span>
              <button onClick={() => { clearAll.mutate(); setConfirmClear(false) }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">Yes</button>
              <button onClick={() => setConfirmClear(false)}
                className="text-xs text-slate-500 hover:text-white transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)}
              className="text-xs text-slate-500 hover:text-slate-300 border border-surface-600 hover:border-surface-500 px-3 py-1.5 rounded-lg transition-colors">
              Clear All
            </button>
          )
        )}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && events.length === 0 && (
        <div className="text-center py-20 text-slate-600 text-sm">
          No activity recorded yet.
        </div>
      )}

      {!isLoading && events.length > 0 && (
        <div className="space-y-1.5">
          {events.map(e => {
            const { icon, color } = TYPE_ICON[e.type] ?? TYPE_ICON.default
            return (
              <div key={e.id} className="flex items-center gap-3 bg-surface-800 border border-surface-700 rounded-xl px-4 py-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold ${color}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-sm truncate">{e.description}</p>
                  <p className="text-slate-600 text-xs mt-0.5 capitalize">{e.type}</p>
                </div>
                <span className="text-slate-600 text-xs flex-shrink-0">{fmtDate(e.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
