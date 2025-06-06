import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budget from './pages/Budget'
import Analytics from './pages/Analytics'
import Insights from './pages/Insights'
import Settings from './pages/Settings'
import RecurringExpenses from './pages/RecurringExpenses'
import DebugPanel from './components/DebugPanel'
import { ErrorTestingPanel } from './utils/errorTesting'

function App() {
  console.log('App component rendering')
  
  return (
    <AuthProvider>
      <Router>
        <DebugPanel />
        <ErrorTestingPanel />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes with AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/recurring" element={<RecurringExpenses />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/calendar" element={<div className="min-h-full"><div className="py-8 px-4 sm:px-6 lg:px-8"><div className="max-w-7xl mx-auto"><h1 className="text-3xl font-bold text-gray-900">Calendar</h1><p className="mt-2 text-base text-gray-600">Calendar view coming soon!</p></div></div></div>} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App