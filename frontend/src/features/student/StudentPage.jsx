import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../auth/AuthContext'
import { useSimulationSettings } from '../simulation/SimulationSettingsContext'
import { getChapterById, SIMULATION_CHAPTERS } from '../simulation/chapters'
import CalendarTab from '../scheduling/components/CalendarTab'
import AnalyticsTab from '../scheduling/components/AnalyticsTab'
import HistoryPlayground from '../scheduling/components/HistoryPlayground'
import DoctorCharacter from '../scheduling/components/DoctorCharacter'
import CapacityPlanningMode from '../capacity-planning/CapacityPlanningMode'
import './StudentPage.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const BASE_TABS = [
  { id: 'chapter-guide', label: 'Chapter Guide' },
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

const CAPACITY_SUGGESTIONS = [
  'What is my current status?',
  'What if I increase clinicians by 1?',
  'What does utilization mean?',
]

const SCHEDULING_SUGGESTIONS = [
  'Summarize my current scheduling state.',
  'Which metrics should I monitor this week?',
  'What should I optimize first?',
]

function StudentPage() {
  const { currentUser, logoutUser, isDemoMode, switchDemoRole } = useAuthContext()
  const { simulationSettings, settingsLoading, updateSimulationSettings } = useSimulationSettings()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('calendar')
  const [showIntro, setShowIntro] = useState(true)

  const [currentLine, setCurrentLine] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [linesDone, setLinesDone] = useState([])
  const [allDone, setAllDone] = useState(false)
  const [capacityRuntimeState, setCapacityRuntimeState] = useState(null)
  const [agentMessages, setAgentMessages] = useState([])
  const [agentInput, setAgentInput] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState('')

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
    if (isCapacityPlanningMode || !chapterInfo.notesLabEnabled) return
    navigate('/notes-lab')
  }

  function handleOpenWestfieldCase() {
    navigate('/westfield-case')
  }

  async function handleChapterChange(nextChapterId) {
    const boundedChapter = Math.max(1, Math.min(SIMULATION_CHAPTERS.length, nextChapterId))
    await updateSimulationSettings({ currentChapter: boundedChapter })
  }

  const userLabel = isDemoMode ? 'Demo Student' : currentUser?.email
  const logoutLabel = isDemoMode ? 'Exit Demo' : 'Sign Out'
  const simulationMode = simulationSettings.simulationMode || 'scheduling'
  const isCapacityPlanningMode = simulationMode === 'capacity-planning'
  const currentChapter = Number(simulationSettings.currentChapter) || 1
  const chapterInfo = getChapterById(currentChapter)
  const chapterShortTitle = chapterInfo.title.split(':')[0].trim()
  const historicalDataEnabled = !isCapacityPlanningMode && simulationSettings.historicalDataEnabled && chapterInfo.allowsHistoryTab
  const TABS = historicalDataEnabled ? [...BASE_TABS, { id: 'history', label: 'Historical Data' }] : BASE_TABS
  const activeSuggestions = isCapacityPlanningMode ? CAPACITY_SUGGESTIONS : SCHEDULING_SUGGESTIONS

  const schedulingSnapshot = useMemo(
    () => ({
      simulationMode: simulationSettings.simulationMode,
      simulationDifficulty: simulationSettings.simulationDifficulty,
      currentChapter: simulationSettings.currentChapter,
      clientDisplayMode: simulationSettings.clientDisplayMode,
      cliniciansCount: Array.isArray(simulationSettings.clinicians) ? simulationSettings.clinicians.length : 0,
      queueCount: Array.isArray(simulationSettings.clientQueue) ? simulationSettings.clientQueue.length : 0,
      activeOrCompletedCount: Array.isArray(simulationSettings.completedClients) ? simulationSettings.completedClients.length : 0,
      appointmentCount: Array.isArray(simulationSettings.appointments) ? simulationSettings.appointments.length : 0,
    }),
    [simulationSettings]
  )

  const agentGameState = useMemo(
    () => ({
      capacity: capacityRuntimeState,
      scheduling: schedulingSnapshot,
      timestamp: new Date().toISOString(),
    }),
    [capacityRuntimeState, schedulingSnapshot]
  )

  const resetAgentMessages = useCallback((capacityMode) => {
    const introText = capacityMode
      ? 'Hi, I am CareBot. I can answer live game-state questions and run quick what-if checks for Capacity Planning.'
      : 'Hi, I am CareBot. I can read your current scheduling state and summarize what to monitor.'
    setAgentMessages([{ role: 'assistant', text: introText, citations: [] }])
  }, [])

  useEffect(() => {
    resetAgentMessages(isCapacityPlanningMode)
    setAgentError('')
    setAgentInput('')
  }, [isCapacityPlanningMode, resetAgentMessages])

  useEffect(() => {
    if (!TABS.some((tab) => tab.id === activeTab)) {
      setActiveTab('calendar')
    }
  }, [TABS, activeTab])

  const handleCapacityStateChange = useCallback((nextState) => {
    setCapacityRuntimeState(nextState)
  }, [])

  const sendAgentMessage = useCallback(
    async (rawText) => {
      const text = rawText.trim()
      if (!text || agentLoading) return

      setAgentError('')
      setAgentLoading(true)
      setAgentMessages((prev) => [...prev, { role: 'user', text, citations: [] }])
      setAgentInput('')

      try {
        const res = await fetch(`${API_BASE}/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            mode: isCapacityPlanningMode ? 'capacity-planning' : 'scheduling',
            game_state: agentGameState,
            conversation_id: 'student-sidebar-agent',
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json?.error || !json?.answer) {
          throw new Error(json?.error || `Agent request failed (${res.status})`)
        }

        setAgentMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: json.answer,
            citations: Array.isArray(json.citations) ? json.citations : [],
          },
        ])
      } catch (error) {
        setAgentError(error?.message || 'Unable to reach agent.')
      } finally {
        setAgentLoading(false)
      }
    },
    [agentGameState, agentLoading, isCapacityPlanningMode]
  )

  const handleAgentSubmit = useCallback(
    (event) => {
      event.preventDefault()
      sendAgentMessage(agentInput)
    },
    [agentInput, sendAgentMessage]
  )

  function renderAgentSidebar() {
    return (
      <aside className="student-agent-sidebar" aria-label="AI assistant sidebar">
        <header className="agent-sidebar-header">
          <div className="agent-robot-icon" aria-hidden="true">
            <span className="robot-eye" />
            <span className="robot-eye" />
            <span className="robot-mouth" />
          </div>
          <div>
            <h3>CareBot Assistant</h3>
            <p>{isCapacityPlanningMode ? 'Capacity Planning Mode' : 'Scheduling Mode'}</p>
          </div>
        </header>

        <div className="agent-suggestion-row">
          {activeSuggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => sendAgentMessage(suggestion)} disabled={agentLoading}>
              {suggestion}
            </button>
          ))}
        </div>

        <div className="agent-chat-log">
          {agentMessages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`agent-chat-message ${message.role}`}>
              <strong>{message.role === 'assistant' ? 'CareBot' : 'You'}</strong>
              <p>{message.text}</p>
              {message.citations?.length ? <span>Sources: {message.citations.join(', ')}</span> : null}
            </article>
          ))}
        </div>

        <form className="agent-chat-form" onSubmit={handleAgentSubmit}>
          <input
            value={agentInput}
            onChange={(event) => setAgentInput(event.target.value)}
            placeholder="Ask about game state..."
            disabled={agentLoading}
          />
          <button type="submit" disabled={!agentInput.trim() || agentLoading}>
            {agentLoading ? 'Thinking...' : 'Send'}
          </button>
        </form>

        {agentError ? <p className="agent-error">{agentError}</p> : null}
      </aside>
    )
  }

  let currentTabContent
  if (activeTab === 'chapter-guide') {
    currentTabContent = (
      <section className="chapter-guide">
        <header className="chapter-guide-header">
          <h2>
            Chapter {chapterInfo.id}: {chapterInfo.title}
          </h2>
          <p>{chapterInfo.summary}</p>
        </header>

        <div className="chapter-guide-grid">
          <article className="chapter-guide-card">
            <h3>Core Concepts</h3>
            <ul>
              {chapterInfo.coreConcepts.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          </article>

          <article className="chapter-guide-card">
            <h3>Technical Skills</h3>
            <ul>
              {chapterInfo.technicalSkills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </article>
        </div>

        <article className="chapter-guide-card chapter-context-card">
          <h3>Operational Context</h3>
          <p>{chapterInfo.operationalContext}</p>
          <p className="chapter-key-question">
            <strong>Key Question:</strong> {chapterInfo.keyQuestion}
          </p>
        </article>
      </section>
    )
  } else if (activeTab === 'history' && historicalDataEnabled) {
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
              <h1>{isCapacityPlanningMode ? 'Capacity Planner' : 'Rehab Scheduler'}</h1>
              <span className="student-subtitle">
                {isCapacityPlanningMode ? 'Pediatric Capacity Planning' : 'Pediatric Rehabilitation'}
              </span>
            </div>
          </div>
          <div className="student-user-section">
            {isDemoMode && (
              <button className="demo-switch-button" onClick={handleSwitchToInstructor}>
                Switch to Instructor
              </button>
            )}
            <button
              className="westfield-case-button"
              onClick={handleOpenWestfieldCase}
            >
              📋 Westfield Case Study
            </button>
            <button
              className="notes-lab-button"
              onClick={handleOpenNotesLab}
              disabled={isCapacityPlanningMode || !chapterInfo.notesLabEnabled}
            >
              {isCapacityPlanningMode ? 'Notes Lab (Scheduling Mode Only)' : chapterInfo.notesLabEnabled ? 'Notes Lab' : 'Notes Lab (Ch 6+)'}
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
          <p>Loading simulation...</p>
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
            <h2>{isCapacityPlanningMode ? 'Capacity Planning Paused' : 'Scheduling Paused'}</h2>
            <p>
              The instructor has temporarily disabled the {isCapacityPlanningMode ? 'capacity planning' : 'scheduling'}{' '}
              simulation. Please check back later.
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (isCapacityPlanningMode) {
    return (
      <div className="student-page">
        {renderHeader()}
        <div className="student-content-shell">
          <main className="student-main">
            <CapacityPlanningMode onStateChange={handleCapacityStateChange} />
          </main>
          {renderAgentSidebar()}
        </div>
        <footer className="student-footer">
          <p>University of Waterloo</p>
        </footer>
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
        <div className="chapter-track">
          <div className="chapter-banner">
            <span className="chapter-kicker">Chapter {chapterInfo.id}</span>
            <strong>{chapterShortTitle}</strong>
            <span>{chapterInfo.keyQuestion}</span>
          </div>

          <div className="chapter-controls">
            <button
              className="chapter-nav-btn"
              onClick={() => handleChapterChange(currentChapter - 1)}
              disabled={currentChapter <= 1}
            >
              ← Previous
            </button>
            <select
              className="chapter-select"
              value={currentChapter}
              onChange={(event) => handleChapterChange(Number(event.target.value))}
            >
              {SIMULATION_CHAPTERS.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  Ch {chapter.id}: {chapter.title.split(':')[0].trim()}
                </option>
              ))}
            </select>
            <button
              className="chapter-nav-btn"
              onClick={() => handleChapterChange(currentChapter + 1)}
              disabled={currentChapter >= SIMULATION_CHAPTERS.length}
            >
              Next →
            </button>
          </div>
        </div>

        <div className="chapter-upcoming-list" aria-label="Upcoming chapters">
          {SIMULATION_CHAPTERS.filter((chapter) => chapter.id > currentChapter).map((chapter) => (
            <div key={chapter.id} className="chapter-upcoming-box">
              <span className="upcoming-id">Ch {chapter.id}</span>
              <span className="upcoming-title">{chapter.title.split(':')[0].trim()}</span>
            </div>
          ))}
        </div>

        <div className="tab-strip">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="student-content-shell">
        <main className="student-main">{currentTabContent}</main>
        {renderAgentSidebar()}
      </div>

      <footer className="student-footer">
        <p>University of Waterloo</p>
      </footer>
    </div>
  )
}

export default StudentPage
