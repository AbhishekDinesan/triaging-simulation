import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import './LoginPage.css'

const USER_ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
}

const AUTH_ERROR_MESSAGES = {
  'auth/email-already-in-use': 'This email is already registered',
  'auth/weak-password': 'Password should be at least 6 characters',
  'auth/invalid-email': 'Please enter a valid email address',
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/invalid-credential': 'Invalid email or password',
}

const DEMO_OPTIONS = [
  { role: USER_ROLES.STUDENT, label: 'Demo as Student', className: 'student-demo' },
  { role: USER_ROLES.INSTRUCTOR, label: 'Demo as Instructor', className: 'instructor-demo' },
]

const ROLE_OPTIONS = [
  {
    role: USER_ROLES.STUDENT,
    name: 'Student',
    description: 'Practice scheduling rehabilitation clients',
  },
  {
    role: USER_ROLES.INSTRUCTOR,
    name: 'Instructor',
    description: 'Configure simulation settings',
  },
]

function getRoleLabel(role) {
  return role === USER_ROLES.INSTRUCTOR ? 'Instructor' : 'Student'
}

function LoginPage() {
  const [selectedRole, setSelectedRole] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [isRegistrationMode, setIsRegistrationMode] = useState(false)
  const [authErrorMessage, setAuthErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { loginUser, registerUser, setUserRole, enterDemoMode } = useAuthContext()
  const navigate = useNavigate()

  function handleDemoMode(role) {
    enterDemoMode(role)
    navigate(role === USER_ROLES.INSTRUCTOR ? '/instructor' : '/student')
  }

  async function handleFormSubmit(event) {
    event.preventDefault()
    if (!selectedRole) {
      setAuthErrorMessage('Please select a role first')
      return
    }

    setIsSubmitting(true)
    setAuthErrorMessage('')

    try {
      if (isRegistrationMode) {
        await registerUser(emailInput, passwordInput, selectedRole)
      } else {
        await loginUser(emailInput, passwordInput)
        setUserRole(selectedRole)
      }

      navigate(selectedRole === USER_ROLES.INSTRUCTOR ? '/instructor' : '/student')
    } catch (error) {
      setAuthErrorMessage(AUTH_ERROR_MESSAGES[error.code] || 'Authentication failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleRoleSelection(role) {
    setSelectedRole(role)
    setAuthErrorMessage('')
  }

  return (
    <div className="login-page">
      <div className="login-background-pattern"></div>
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">Pediatric Rehab Scheduler</h1>
          <p className="login-subtitle">University of Waterloo</p>
        </div>

        <div className="demo-mode-section">
          <h2 className="demo-section-title">Quick Demo</h2>
          <p className="demo-description">Try the app without creating an account</p>
          <div className="demo-buttons">
            {DEMO_OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                className={`demo-button ${option.className}`}
                onClick={() => handleDemoMode(option.role)}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="login-divider">
          <span>or sign in with email</span>
        </div>

        <div className="role-selection-section">
          <h2 className="role-section-title">Select Your Role</h2>
          <div className="role-cards-container">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                className={`role-card ${selectedRole === option.role ? 'role-card-selected' : ''}`}
                onClick={() => handleRoleSelection(option.role)}
              >
                <span className="role-name">{option.name}</span>
                <span className="role-description">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedRole && (
          <form className="login-form" onSubmit={handleFormSubmit}>
            <div className="form-input-group">
              <label htmlFor="email-input" className="form-label">
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                className="form-input"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-input-group">
              <label htmlFor="password-input" className="form-label">
                Password
              </label>
              <input
                id="password-input"
                type="password"
                className="form-input"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {authErrorMessage && <div className="auth-error-message">{authErrorMessage}</div>}

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting
                ? 'Please wait...'
                : isRegistrationMode
                  ? `Register as ${getRoleLabel(selectedRole)}`
                  : `Sign In as ${getRoleLabel(selectedRole)}`}
            </button>

            <button
              type="button"
              className="toggle-mode-button"
              onClick={() => {
                setIsRegistrationMode(!isRegistrationMode)
                setAuthErrorMessage('')
              }}
            >
              {isRegistrationMode ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default LoginPage
