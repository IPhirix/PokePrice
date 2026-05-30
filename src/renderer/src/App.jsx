import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { CurrencyProvider } from './context/CurrencyContext'
import { AlertsProvider } from './context/AlertsContext'
import ErrorBoundary from './components/ErrorBoundary'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CardDetail = lazy(() => import('./pages/CardDetail'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  return (
    <ErrorBoundary>
      <CurrencyProvider>
        <AlertsProvider>
          <Suspense fallback={<div className="h-screen bg-surface-900" />}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="card/:id" element={<CardDetail />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </Suspense>
        </AlertsProvider>
      </CurrencyProvider>
    </ErrorBoundary>
  )
}
