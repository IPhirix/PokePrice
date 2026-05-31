import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { CurrencyProvider } from './context/CurrencyContext'
import { AlertsProvider } from './context/AlertsContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import CreateAccountPage from './pages/CreateAccountPage'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CardDetail = lazy(() => import('./pages/CardDetail'))
const Settings = lazy(() => import('./pages/Settings'))

function AppRoutes() {
  const { isSetup, isAuthenticated } = useAuth()
  const [showCreateAccount, setShowCreateAccount] = useState(false)

  // Reset the create-account flag whenever the user logs out so they always
  // land on LoginPage instead of CreateAccountPage after signing out.
  useEffect(() => {
    if (!isAuthenticated) setShowCreateAccount(false)
  }, [isAuthenticated])

  if (isSetup === null) return <div className="h-screen bg-surface-900" />

  // Always show the app when authenticated — checked first so showCreateAccount
  // being stale after a successful account creation never blocks the transition.
  if (isAuthenticated) return (
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

  if (!isSetup || showCreateAccount) return (
    <CreateAccountPage onCancel={isSetup && showCreateAccount ? () => setShowCreateAccount(false) : undefined} />
  )

  return <LoginPage onCreateAccount={() => setShowCreateAccount(true)} />
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
