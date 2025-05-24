import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'

function App() {
  return (
    <AuthProvider>
      <Router>
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
            <Route path="/budget" element={<div className="p-8"><h1 className="text-2xl">Budget Page (Coming Soon)</h1></div>} />
            <Route path="/analytics" element={<div className="p-8"><h1 className="text-2xl">Analytics Page (Coming Soon)</h1></div>} />
            <Route path="/calendar" element={<div className="p-8"><h1 className="text-2xl">Calendar Page (Coming Soon)</h1></div>} />
            <Route path="/settings" element={<div className="p-8"><h1 className="text-2xl">Settings Page (Coming Soon)</h1></div>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
