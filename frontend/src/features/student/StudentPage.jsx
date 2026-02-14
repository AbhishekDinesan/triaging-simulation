import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../auth/AuthContext'
import { useSimulationSettings } from '../simulation/SimulationSettingsContext'
import CalendarTab from '../scheduling/components/CalendarTab'
import AnalyticsTab from '../scheduling/components/AnalyticsTab'
import HistoryPlayground from '../scheduling/components/HistoryPlayground'
import DoctorCharacter from '../scheduling/components/DoctorCharacter'
import './StudentPage.css'

const BASE_TABS = [
  { id: 'calendar', label: 'Schedule' },
  { id: 'analytics', label: 'Analytics' },
]

const DOCTOR_LINES = [
  "Hello there! I'm Dr. Waterloo, Head of Pediatric Rehabilitation at Grand River Children's Centre.",
  'We have a growing waitlist of young patients who need assessments, service planning sessions, and therapy blocks — and I need your help to schedule them.',
  'Your goal is to build the most efficient schedule possible: assign each child to the right clinician, respect the weekly cycle rules, and make sure no one is left waiting longer than they have to.',
  "Take a look at the client cards on the right, check each child's priority, then place their appointments on the calendar. Keep clinician workloads balanced and follow the cycle constraints.",
  "Ready? Let's get these kids the care they need!",
]

function StudentPage() {
  const { currentUser, logoutUser, isDemoMode, switchDemoRole } = useAuthContext()
  const { simulationSettings, settingsLoading } = useSimulationSettings()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('calendar')
  const [showIntro, setShowIntro] = useState(true)

  const [currentLine, setCurrentLine] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [linesDone, setLinesDone] = useState([])
  const [allDone, setAllDone] = useState(false)

  useEffect(() => {
    if (!showIntro) return
    if (currentLine >= DOCTOR_LINES.length) {
      setAllDone(true)
      return
    }

    const fullLine = DOCTOR_LINES[currentLine]
    let charIndex = 0
    let linePauseTimeout

    const timer = setInterval(() => {
      charIndex++
      setDisplayedText(fullLine.slice(0, charIndex))
      if (charIndex >= fullLine.length) {
        clearInterval(timer)
        linePauseTimeout = setTimeout(() => {
          setLinesDone((prev) => [...prev, fullLine])
          setDisplayedText('')
          setCurrentLine((prev) => prev + 1)
        }, 600)
      }
    }, 28)

    return () => {
      clearInterval(timer)
      if (linePauseTimeout) clearTimeout(linePauseTimeout)
    }
  }, [currentLine, showIntro])

  function handleSkipIntro() {
    setShowIntro(false)
  }

  async function handleLogout() {
    await logoutUser()
    navigate('/')
  }

  function handleSwitchToInstructor() {
    switchDemoRole('instructor')
    navigate('/instructor')
  }

  function handleOpenNotesLab() {
    navigate('/notes-lab')
  }

  const userLabel = isDemoMode ? 'Demo Student' : currentUser?.email
  const logoutLabel = isDemoMode ? 'Exit Demo' : 'Sign Out'
  const historicalDataEnabled = simulationSettings.historicalDataEnabled
  const TABS = historicalDataEnabled ? [...BASE_TABS, { id: 'history', label: 'Historical Data' }] : BASE_TABS

  let currentTabContent
  if (activeTab === 'history' && historicalDataEnabled) {
    currentTabContent = <HistoryPlayground />
  } else if (activeTab === 'analytics') {
    currentTabContent = <AnalyticsTab />
  } else {
    currentTabContent = <CalendarTab />
  }

  function renderHeader() {
    return (
      <header className="student-header">
        <div className="student-header-content">
          <div className="student-logo">
            <div className="student-logo-text">
              <h1>Rehab Scheduler</h1>
              <span className="student-subtitle">Pediatric Rehabilitation</span>
            </div>
          </div>
          <div className="student-user-section">
            {isDemoMode && (
              <button className="demo-switch-button" onClick={handleSwitchToInstructor}>
                Switch to Instructor
              </button>
            )}
            <button className="notes-lab-button" onClick={handleOpenNotesLab}>
              Notes Lab
            </button>
            <span className="student-user-email">{userLabel}</span>
            <button className="student-logout-button" onClick={handleLogout}>
              {logoutLabel}
            </button>
          </div>
        </div>
      </header>
    )
  }

  if (settingsLoading) {
    return (
      <div className="student-page">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading scheduling system...</p>
        </div>
      </div>
    )
  }

  if (!simulationSettings.simulationEnabled) {
    return (
      <div className="student-page">
        {renderHeader()}
        <main className="student-main">
          <div className="simulation-disabled-message">
            <h2>Scheduling Paused</h2>
            <p>The instructor has temporarily disabled the scheduling simulation. Please check back later.</p>
          </div>
        </main>
      </div>
    )
  }

  if (showIntro) {
    return (
      <div className="student-page intro-page">
        {renderHeader()}

        <main className="intro-stage">
          <DoctorCharacter />

          <div className="speech-area">
            <div className="speech-bubble">
              <div className="speech-lines-done">
                {linesDone.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              {!allDone && (
                <p className="speech-typing">
                  {displayedText}
                  <span className="cursor-blink">|</span>
                </p>
              )}
            </div>

            <div className="intro-actions">
              {allDone ? (
                <button className="begin-button" onClick={handleSkipIntro}>
                  Begin Scheduling
                </button>
              ) : (
                <button className="skip-button" onClick={handleSkipIntro}>
                  Skip Intro
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="student-page">
      {renderHeader()}

      <nav className="student-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="student-main">{currentTabContent}</main>

      <footer className="student-footer">
        <p>University of Waterloo</p>
      </footer>
    </div>
  )
}

export default StudentPage
