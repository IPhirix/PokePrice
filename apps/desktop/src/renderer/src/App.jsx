import { lazy, Suspense, useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import { CurrencyProvider } from "./context/CurrencyContext";
import { AlertsProvider } from "./context/AlertsContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import CreateAccountPage from "./pages/CreateAccountPage";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CardDetail = lazy(() => import("./pages/CardDetail"));
const Settings = lazy(() => import("./pages/Settings"));

function AppRoutes() {
  const { isSetup, isAuthenticated } = useAuth();
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  // Reset the create-account flag whenever the user logs out so they always
  // land on LoginPage instead of CreateAccountPage after signing out.
  useEffect(() => {
    if (!isAuthenticated) setShowCreateAccount(false);
  }, [isAuthenticated]);

  if (isSetup === null) return <div className="h-screen bg-surface-900" />;

  if (isSetup === "no-api")
    return (
      <div className="h-screen bg-surface-900 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <svg
          className="w-14 h-14 text-accent/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <div>
          <p className="text-white font-bold text-xl mb-2">
            Desktop App Required
          </p>
          <p className="text-slate-400 text-sm max-w-xs">
            PokePrice is a desktop application and can't run in a browser.
            Download and install the app to get started.
          </p>
        </div>
      </div>
    );

  // Always show the app when authenticated — checked first so showCreateAccount
  // being stale after a successful account creation never blocks the transition.
  if (isAuthenticated)
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
    );

  if (!isSetup || showCreateAccount)
    return (
      <CreateAccountPage
        onCancel={
          isSetup && showCreateAccount
            ? () => setShowCreateAccount(false)
            : undefined
        }
      />
    );

  return <LoginPage onCreateAccount={() => setShowCreateAccount(true)} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
