import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AlertsContext = createContext(null)

export function AlertsProvider({ children }) {
  const [allAlerts, setAllAlerts] = useState([])
  const [dismissedIds, setDismissedIds] = useState(new Set())
  const [readIds, setReadIds] = useState(new Set())

  const fetchAlerts = useCallback(async () => {
    try { setAllAlerts(await window.api.getTriggeredAlerts()) } catch {}
  }, [])

  useEffect(() => {
    fetchAlerts()
    window.api.onPricesRefreshed(fetchAlerts)
  }, [fetchAlerts])

  const activeAlerts = allAlerts.filter((a) => !dismissedIds.has(`${a.id}-${a.type}`))
  const alertCount = activeAlerts.filter((a) => !readIds.has(`${a.id}-${a.type}`)).length

  function dismissAlert(id, type) {
    setDismissedIds((prev) => new Set([...prev, `${id}-${type}`]))
  }
  function dismissAll() {
    setDismissedIds((prev) => new Set([...prev, ...allAlerts.map((a) => `${a.id}-${a.type}`)]))
  }
  function markAllRead() {
    setReadIds((prev) => new Set([...prev, ...activeAlerts.map((a) => `${a.id}-${a.type}`)]))
  }

  return (
    <AlertsContext.Provider value={{ activeAlerts, alertCount, readIds, dismissAlert, dismissAll, markAllRead }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  return useContext(AlertsContext)
}
