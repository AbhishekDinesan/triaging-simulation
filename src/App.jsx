import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { SimulationSettingsProvider } from './context/SimulationSettingsContext'
import LoginPage from './pages/LoginPage'
import StudentPage from './pages/StudentPage'
import InstructorDashboard from './pages/InstructorDashboard'
import './App.css'

function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userRole, authLoading } = useAuthContext()

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <span className="auth-loading-icon">🩺</span>
        <p>Loading...</p>
      </div>
    )
  }

  if (!currentUser) {
    return <Navigate to="/" replace />
  }

  if (allowedRole && userRole !== allowedRole) {
    const redirectPath = userRole === 'instructor' ? '/instructor' : '/student'
    return <Navigate to={redirectPath} replace />
  }

  return children
}

function AppRoutes() {
  const { currentUser, userRole, authLoading } = useAuthContext()

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <span className="auth-loading-icon">🩺</span>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          currentUser ? <Navigate to={userRole === 'instructor' ? '/instructor' : '/student'} replace /> : <LoginPage />
        }
      />
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRole="student">
            <StudentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/instructor"
        element={
          <ProtectedRoute allowedRole="instructor">
            <InstructorDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SimulationSettingsProvider>
          <AppRoutes />
        </SimulationSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
