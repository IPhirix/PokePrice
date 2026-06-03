import { createContext, useContext, useState, useEffect } from 'react'

export const CURRENCIES = [
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound' },
  { code: 'JPY', symbol: '¥',  label: 'JPY — Japanese Yen' },
  { code: 'CAD', symbol: 'C$', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar' },
]

const FALLBACK = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149, CAD: 1.36, AUD: 1.53 }

const LOCALE_TO_CURRENCY = {
  US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', JP: 'JPY',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', GR: 'EUR',
  FI: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR',
  LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR',
}

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState('USD')
  const [rates, setRates] = useState(FALLBACK)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      if (s.currency) {
        setCurrencyState(s.currency)
      } else {
        window.api.getLocale().then((locale) => {
          const region = locale.split('-')[1]?.toUpperCase() || locale.toUpperCase()
          const detected = LOCALE_TO_CURRENCY[region] || 'USD'
          setCurrencyState(detected)
          window.api.setSettings({ currency: detected })
        }).catch(() => {})
      }
    }).catch(() => {})
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((r) => r.json())
      .then((d) => {
        if (d.rates) {
          setRates({
            USD: 1,
            EUR: d.rates.EUR ?? FALLBACK.EUR,
            GBP: d.rates.GBP ?? FALLBACK.GBP,
            JPY: d.rates.JPY ?? FALLBACK.JPY,
            CAD: d.rates.CAD ?? FALLBACK.CAD,
            AUD: d.rates.AUD ?? FALLBACK.AUD,
          })
        }
      })
      .catch(() => {})
  }, [])

  function setCurrency(c) {
    setCurrencyState(c)
    window.api.setSettings({ currency: c })
  }

  function format(usdValue) {
    if (usdValue == null) return null
    const rate = rates[currency] ?? 1
    const converted = usdValue * rate
    const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '$'
    if (currency === 'JPY') {
      return `${sym}${Math.round(converted).toLocaleString('en-US')}`
    }
    return `${sym}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
