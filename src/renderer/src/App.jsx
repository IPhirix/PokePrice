import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CardDetail from './pages/CardDetail'
import Settings from './pages/Settings'
import { CurrencyProvider } from './context/CurrencyContext'
import { AlertsProvider } from './context/AlertsContext'

export default function App() {
  return (
    <CurrencyProvider>
      <AlertsProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="card/:id" element={<CardDetail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </AlertsProvider>
    </CurrencyProvider>
  )
}
