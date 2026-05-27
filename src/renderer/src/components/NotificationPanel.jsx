import { useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'

export default function NotificationPanel({ isOpen, onClose, anchorRef, alerts = [], readIds, onDismiss, onDismissAll, onMarkAllRead }) {
  const { format } = useCurrency()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const posRef = useRef({ top: 0, right: 0 })

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef?.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    posRef.current = { top: rect.bottom + 6, right: window.innerWidth - rect.right }
    if (panelRef.current) {
      panelRef.current.style.top = `${posRef.current.top}px`
      panelRef.current.style.right = `${posRef.current.right}px`
    }
  }, [isOpen, anchorRef])

  useEffect(() => {
    if (!isOpen) return
    function handleMouseDown(e) {
      if (panelRef.current?.contains(e.target)) return
      if (anchorRef?.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  const buyAlerts = alerts.filter((a) => a.type === 'buy')
  const sellAlerts = alerts.filter((a) => a.type === 'sell')
  const hasAlerts = alerts.length > 0

  function handleCardClick(id) {
    onClose()
    navigate(`/card/${id}`)
  }

  return (
    <div
      ref={panelRef}
      style={{ top: posRef.current.top, right: posRef.current.right }}
      className="fixed z-50 w-96 max-h-[calc(100vh-120px)] flex flex-col bg-surface-800 border border-surface-600 shadow-2xl rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-600 bg-surface-900 flex-shrink-0">
        <span className="text-sm font-semibold text-slate-200">Price Alerts</span>
        <div className="flex items-center gap-3">
          {hasAlerts && (
            <>
              <button
                onClick={onMarkAllRead}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Mark all read
              </button>
              <button
                onClick={onDismissAll}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-200 hover:bg-surface-600"
          >
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
              <line x1="2.5" y1="2.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="10.5" y1="2.5" x2="2.5" y2="10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {!hasAlerts && (
          <div className="p-6 text-center">
            <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-slate-400 text-sm">No active price alerts</p>
            <p className="text-slate-600 text-xs mt-1">Set buy or sell targets on cards to get notified here</p>
          </div>
        )}

        {buyAlerts.length > 0 && (
          <section>
            <div className="px-4 py-1.5 bg-surface-900 border-b border-surface-600 sticky top-0">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Buy Alerts · {buyAlerts.length}
              </span>
            </div>
            {buyAlerts.map((alert) => (
              <AlertRow
                key={`buy-${alert.id}`}
                alert={alert}
                format={format}
                isRead={readIds?.has(`${alert.id}-${alert.type}`)}
                onDismiss={() => onDismiss(alert.id, alert.type)}
                onClick={() => handleCardClick(alert.id)}
              />
            ))}
          </section>
        )}

        {sellAlerts.length > 0 && (
          <section>
            <div className="px-4 py-1.5 bg-surface-900 border-b border-surface-600 sticky top-0">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Sell Alerts · {sellAlerts.length}
              </span>
            </div>
            {sellAlerts.map((alert) => (
              <AlertRow
                key={`sell-${alert.id}`}
                alert={alert}
                format={format}
                isRead={readIds?.has(`${alert.id}-${alert.type}`)}
                onDismiss={() => onDismiss(alert.id, alert.type)}
                onClick={() => handleCardClick(alert.id)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function conditionLabel(condition) {
  if (!condition || condition === 'raw') return 'Raw'
  return condition.toUpperCase()
}

function AlertRow({ alert, format, isRead, onDismiss, onClick }) {
  const { type, name, setName, number, condition, imageUrl, currentPrice, alertPrice, dollarDiff, pctDiff } = alert
  const isBuy = type === 'buy'

  return (
    <div
      className={`flex gap-3 px-4 py-3 border-b border-surface-700 cursor-pointer transition-colors group relative ${
        isRead ? 'hover:bg-surface-700/60 opacity-60' : 'hover:bg-surface-700'
      }`}
      onClick={onClick}
    >
      {/* Unread dot */}
      {!isRead && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
      )}

      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-9 h-[52px] object-contain flex-shrink-0 rounded" />
      ) : (
        <div className="w-9 h-[52px] bg-surface-600 rounded flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className="text-sm font-medium text-slate-200 truncate leading-tight">{name}</p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded leading-tight ${
              isBuy ? 'bg-emerald-900/70 text-emerald-300' : 'bg-red-900/70 text-red-300'
            }`}>
              {isBuy ? 'BUY' : 'SELL'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss() }}
              className="w-4 h-4 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-surface-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Dismiss"
            >
              <svg width="9" height="9" viewBox="0 0 13 13" fill="none">
                <line x1="2.5" y1="2.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="10.5" y1="2.5" x2="2.5" y2="10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 truncate mb-2">
          {setName}{number ? ` · #${number}` : ''} · {conditionLabel(condition)}
        </p>
        <div className="flex items-end gap-3">
          <div>
            <p className="text-[10px] text-slate-500 leading-tight">Current</p>
            <p className="text-sm font-semibold text-slate-200">{format(currentPrice)}</p>
          </div>
          <svg className="text-slate-600 mb-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <div>
            <p className="text-[10px] text-slate-500 leading-tight">{isBuy ? 'Buy target' : 'Sell target'}</p>
            <p className={`text-sm font-semibold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{format(alertPrice)}</p>
          </div>
        </div>
        <p className={`text-xs mt-1.5 font-medium ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
          {format(dollarDiff)} ({pctDiff.toFixed(1)}%) {isBuy ? 'under target' : 'above target'}
        </p>
      </div>
    </div>
  )
}
