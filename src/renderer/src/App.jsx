import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { CurrencyProvider } from './context/CurrencyContext'
import { AlertsProvider } from './context/AlertsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CardDetail = lazy(() => import('./pages/CardDetail'))
const Settings = lazy(() => import('./pages/Settings'))

function AppRoutes() {
  const { isSetup, isAuthenticated } = useAuth()

  // Still loading auth state
  if (isSetup === null) return <div className="h-screen bg-surface-900" />

  if (!isSetup) return <SetupPage />
  if (!isAuthenticated) return <LoginPage />

  return (
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
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  )
}
