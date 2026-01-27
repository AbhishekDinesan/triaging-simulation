import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import CalendarTab from '../components/CalendarTab'
import './StudentPage.css'

function StudentPage() {
  const { currentUser, logoutUser } = useAuthContext()
  const { simulationSettings, settingsLoading } = useSimulationSettings()
  const navigate = useNavigate()

  async function handleLogout() {
    await logoutUser()
    navigate('/')
  }

  if (settingsLoading) {
    return (
      <div className="student-page">
        <div className="loading-screen">
          <span className="loading-icon">🩺</span>
          <p>Loading simulation...</p>
        </div>
      </div>
    )
  }

  if (!simulationSettings.simulationEnabled) {
    return (
      <div className="student-page">
        <header className="student-header">
          <div className="student-header-content">
            <div className="student-logo">
              <span className="student-logo-icon">🩺</span>
              <div className="student-logo-text">
                <h1>Simulation</h1>
                <span className="student-subtitle">Triaging Simulation</span>
              </div>
            </div>
            <div className="student-user-section">
              <span className="student-user-email">{currentUser?.email}</span>
              <button className="student-logout-button" onClick={handleLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <main className="student-main">
          <div className="simulation-disabled-message">
            <span className="disabled-icon">⏸️</span>
            <h2>Simulation Paused</h2>
            <p>The instructor has temporarily disabled the simulation. Please check back later.</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="student-page">
      <header className="student-header">
        <div className="student-header-content">
          <div className="student-logo">
            <span className="student-logo-icon">🩺</span>
            <div className="student-logo-text">
              <h1>Simulation</h1>
              <span className="student-subtitle">Triaging Simulation</span>
            </div>
          </div>
          <div className="student-user-section">
            <span className="student-user-email">{currentUser?.email}</span>
            <button className="student-logout-button" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="student-main">
        <CalendarTab />
      </main>

      <footer className="student-footer">
        <p>University of Waterloo</p>
      </footer>
    </div>
  )
}

export default StudentPage
