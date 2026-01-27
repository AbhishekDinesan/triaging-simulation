import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import './LoginPage.css'

const USER_ROLES = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
}

function LoginPage() {
  const [selectedRole, setSelectedRole] = useState(null)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [isRegistrationMode, setIsRegistrationMode] = useState(false)
  const [authErrorMessage, setAuthErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { loginUser, registerUser, setUserRole } = useAuthContext()
  const navigate = useNavigate()

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

      if (selectedRole === USER_ROLES.INSTRUCTOR) {
        navigate('/instructor')
      } else {
        navigate('/student')
      }
    } catch (error) {
      const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered',
        'auth/weak-password': 'Password should be at least 6 characters',
        'auth/invalid-email': 'Please enter a valid email address',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Invalid email or password',
      }
      setAuthErrorMessage(errorMessages[error.code] || 'Authentication failed. Please try again.')
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
          <span className="login-logo-icon">🩺</span>
          <h1 className="login-title">Medical Triage Simulation</h1>
          <p className="login-subtitle">University of Waterloo</p>
        </div>

        <div className="role-selection-section">
          <h2 className="role-section-title">Select Your Role</h2>
          <div className="role-cards-container">
            <button
              type="button"
              className={`role-card ${selectedRole === USER_ROLES.STUDENT ? 'role-card-selected' : ''}`}
              onClick={() => handleRoleSelection(USER_ROLES.STUDENT)}
            >
              <span className="role-icon">🎓</span>
              <span className="role-name">Student</span>
              <span className="role-description">Practice triaging and scheduling patients</span>
            </button>

            <button
              type="button"
              className={`role-card ${selectedRole === USER_ROLES.INSTRUCTOR ? 'role-card-selected' : ''}`}
              onClick={() => handleRoleSelection(USER_ROLES.INSTRUCTOR)}
            >
              <span className="role-icon">👨‍🏫</span>
              <span className="role-name">Instructor</span>
              <span className="role-description">Configure simulation settings</span>
            </button>
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
                  ? `Register as ${selectedRole === USER_ROLES.INSTRUCTOR ? 'Instructor' : 'Student'}`
                  : `Sign In as ${selectedRole === USER_ROLES.INSTRUCTOR ? 'Instructor' : 'Student'}`}
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
