import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../auth/AuthContext'
import { useSimulationSettings } from '../simulation/SimulationSettingsContext'
import { SIMULATION_CHAPTERS, getChapterById } from '../simulation/chapters'
import { getCycleInfo, APPOINTMENT_TYPES, CONSTRAINTS } from '../scheduling/utils/schedulingUtils'
import { seedDatabaseFromCSV, clearDatabase, seedMockDataByDifficulty } from '../scheduling/utils/seedDatabase'
import './InstructorDashboard.css'

const DISPLAY_MODES = [
  {
    id: 'queue',
    label: 'Queue View',
    description: 'All clients visible',
  },
  {
    id: 'stack',
    label: 'Stack View',
    description: 'One client at a time',
  },
]

const SIMULATION_MODES = [
  {
    id: 'scheduling',
    label: 'Scheduling',
    description: 'Client-by-client appointment scheduling workflow.',
  },
  {
    id: 'capacity-planning',
    label: 'Capacity Planning',
    description: 'Weekly capacity strategy simulation focused on demand vs throughput.',
  },
]

const DIFFICULTY_OPTIONS = [
  { id: 'easy', label: 'Easy', description: 'Lower volatility and fewer disruptions.' },
  { id: 'medium', label: 'Medium', description: 'Balanced baseline difficulty.' },
  { id: 'hard', label: 'Hard', description: 'Higher demand pressure and disruptions.' },
]

function formatPriorityLabel(priorityLevel) {
  return priorityLevel.charAt(0).toUpperCase() + priorityLevel.slice(1)
}

function InstructorDashboard() {
  const { currentUser, logoutUser, isDemoMode, switchDemoRole } = useAuthContext()
  const {
    simulationSettings,
    updateSimulationSettings,
    resetSimulationSettings,
    refreshFromFirestore,
    settingsLoading,
  } = useSimulationSettings()
  const navigate = useNavigate()

  const [newClientName, setNewClientName] = useState('')
  const [newClientAge, setNewClientAge] = useState('')
  const [newClientDiagnosis, setNewClientDiagnosis] = useState('')
  const [newClientPriority, setNewClientPriority] = useState('medium')
  const [newClientReferralNotes, setNewClientReferralNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [seedingStatus, setSeedingStatus] = useState('')
  const [seedingLogs, setSeedingLogs] = useState([])
  const [isSeeding, setIsSeeding] = useState(false)
  const fileInputRef = useRef(null)

  const clinicians = simulationSettings.clinicians || []
  const clientQueue = simulationSettings.clientQueue || []
  const completedClients = simulationSettings.completedClients || []
  const priorityLevelsEnabled = simulationSettings.priorityLevelsEnabled || {}
  const simulationMode = simulationSettings.simulationMode || 'scheduling'
  const simulationDifficulty = simulationSettings.simulationDifficulty || 'medium'
  const currentChapter = Number(simulationSettings.currentChapter) || 1
  const chapterInfo = getChapterById(currentChapter)

  const currentCycleInfo = getCycleInfo(new Date())
  const totalAppointments = simulationSettings.appointments?.length || 0
  const completedClientsCount = completedClients.length
  const pendingClients = clientQueue.length

  const statsCards = [
    { value: totalAppointments, label: 'Total Appointments' },
    { value: completedClientsCount, label: 'Clients Scheduled' },
    { value: pendingClients, label: 'Pending Clients' },
    {
      value: `Week ${currentCycleInfo.week}`,
      label: currentCycleInfo.constraints,
      className: 'cycle-card',
    },
  ]

  const schedulingRules = [
    {
      code: 'AX',
      color: APPOINTMENT_TYPES.AX.color,
      name: 'Assessment (AX)',
      constraint: `Week 1 & 2: Max ${CONSTRAINTS.MAX_AX_PER_WEEK_1_2}/clinician/week`,
    },
    {
      code: 'SP',
      color: APPOINTMENT_TYPES.SP.color,
      name: 'Service Planning (SP)',
      constraint: `Week 3 only: Max ${CONSTRAINTS.MAX_SP_PER_WEEK_3}/clinician/week`,
    },
    {
      code: 'BLK',
      color: APPOINTMENT_TYPES.BLOCK.color,
      name: 'Therapy Blocks',
      constraint: '6 sessions per client',
    },
    {
      code: 'LIM',
      color: '#64748b',
      name: 'Clinician Limits',
      constraint: `${CONSTRAINTS.MAX_APPOINTMENTS_PER_DAY}/day, ${CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK}/week`,
    },
  ]

  function appendSeedingLog(message) {
    setSeedingLogs((prev) => [...prev, message])
    setSeedingStatus(message)
  }

  function resetClientForm() {
    setNewClientName('')
    setNewClientAge('')
    setNewClientDiagnosis('')
    setNewClientPriority('medium')
    setNewClientReferralNotes('')
  }

  async function handleLogout() {
    await logoutUser()
    navigate('/')
  }

  function handleSwitchToStudent() {
    switchDemoRole('student')
    navigate('/student')
  }

  function handleOpenNotesLab() {
    if (simulationMode !== 'scheduling' || !chapterInfo.notesLabEnabled) return
    navigate('/notes-lab')
  }

  async function handleChapterChange(event) {
    const selectedChapter = Number(event.target.value)
    await updateSimulationSettings({ currentChapter: selectedChapter })
  }

  async function handleToggleSimulation() {
    setIsSaving(true)
    await updateSimulationSettings({
      simulationEnabled: !simulationSettings.simulationEnabled,
    })
    setIsSaving(false)
  }

  async function handleToggleHistoricalData() {
    setIsSaving(true)
    await updateSimulationSettings({
      historicalDataEnabled: !simulationSettings.historicalDataEnabled,
    })
    setIsSaving(false)
  }

  async function handleSimulationModeChange(nextMode) {
    if (nextMode === simulationMode) return
    setIsSaving(true)
    await updateSimulationSettings({
      simulationMode: nextMode,
    })
    setIsSaving(false)
  }

  async function handleSimulationDifficultyChange(nextDifficulty) {
    if (nextDifficulty === simulationDifficulty) return
    setIsSaving(true)
    await updateSimulationSettings({
      simulationDifficulty: nextDifficulty,
    })
    setIsSaving(false)
  }

  async function handlePriorityToggle(priorityLevel) {
    const updatedPriorityLevels = {
      ...simulationSettings.priorityLevelsEnabled,
      [priorityLevel]: !simulationSettings.priorityLevelsEnabled[priorityLevel],
    }
    await updateSimulationSettings({ priorityLevelsEnabled: updatedPriorityLevels })
  }

  async function handleAddClient(event) {
    event.preventDefault()
    if (!newClientName || !newClientAge || !newClientDiagnosis || !newClientReferralNotes) return

    const newClient = {
      id: Date.now(),
      name: newClientName,
      age: parseInt(newClientAge, 10),
      diagnosis: newClientDiagnosis,
      priority: newClientPriority,
      referralNotes: newClientReferralNotes,
    }

    const updatedQueue = [...clientQueue, newClient]
    await updateSimulationSettings({ clientQueue: updatedQueue })
    resetClientForm()
  }

  async function handleRemoveClient(clientId) {
    const updatedQueue = clientQueue.filter((c) => c.id !== clientId)
    await updateSimulationSettings({ clientQueue: updatedQueue })
  }

  async function handleResetAllSettings() {
    if (window.confirm('Are you sure you want to reset all settings to default? This will clear all appointments.')) {
      await resetSimulationSettings()
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    setIsSeeding(true)
    setSeedingLogs([])
    setSeedingStatus('Reading file...')

    const reader = new FileReader()
    reader.onload = async (e) => {
      const csvContent = e.target.result
      setSeedingStatus('Starting database seed...')

      try {
        const result = await seedDatabaseFromCSV(csvContent, appendSeedingLog)
        setSeedingStatus(
          `Complete! Loaded ${result.clients} clients, ${result.clinicians} clinicians, ${result.visits} visits`
        )
        await refreshFromFirestore()
      } catch (error) {
        setSeedingStatus(`Error: ${error.message}`)
        console.error('Seeding error:', error)
      }

      setIsSeeding(false)
    }

    reader.onerror = () => {
      setSeedingStatus('Error reading file')
      setIsSeeding(false)
    }

    reader.readAsText(file)
  }

  async function handleClearDatabase() {
    if (!window.confirm('Are you sure you want to clear ALL data from the database? This cannot be undone.')) {
      return
    }

    setIsSeeding(true)
    setSeedingLogs([])
    setSeedingStatus('Clearing database...')

    try {
      await clearDatabase(appendSeedingLog)
      await refreshFromFirestore()
    } catch (error) {
      setSeedingStatus(`Error: ${error.message}`)
    }

    setIsSeeding(false)
  }

  async function handleGenerateMockData() {
    setIsSeeding(true)
    setSeedingLogs([])
    setSeedingStatus(`Generating ${simulationDifficulty} mock dataset...`)

    try {
      const result = await seedMockDataByDifficulty(simulationDifficulty, appendSeedingLog)
      setSeedingStatus(
        `Complete! Generated ${simulationDifficulty} dataset with ${result.clients} clients, ${result.clinicians} clinicians, ${result.visits} visits`
      )
      await refreshFromFirestore()
    } catch (error) {
      setSeedingStatus(`Error: ${error.message}`)
    }

    setIsSeeding(false)
  }

  const seedingStatusClassName = [
    'seeding-status',
    seedingStatus.includes('Complete') ? 'success' : '',
    seedingStatus.includes('Error') ? 'error' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (settingsLoading) {
    return (
      <div className="instructor-dashboard">
        <div className="loading-indicator">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="instructor-dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-logo">
            <div className="dashboard-logo-text">
              <h1>Instructor Dashboard</h1>
              <span className="dashboard-subtitle">Pediatric Rehabilitation Scheduling</span>
            </div>
          </div>
          <div className="dashboard-user-section">
            {isDemoMode && (
              <button className="demo-switch-button" onClick={handleSwitchToStudent}>
                Switch to Student
              </button>
            )}
            <button
              className="notes-lab-button"
              onClick={handleOpenNotesLab}
              disabled={simulationMode !== 'scheduling' || !chapterInfo.notesLabEnabled}
            >
              {simulationMode !== 'scheduling'
                ? 'Notes Lab (Scheduling Mode Only)'
                : chapterInfo.notesLabEnabled
                  ? 'Notes Lab'
                  : 'Notes Lab (Ch 6+)'}
            </button>
            <span className="user-email">{isDemoMode ? 'Demo Instructor' : currentUser?.email}</span>
            <button className="logout-button" onClick={handleLogout}>
              {isDemoMode ? 'Exit Demo' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="stats-row">
          {statsCards.map((card) => (
            <div key={card.label} className={`stat-card ${card.className || ''}`.trim()}>
              <div className="stat-info">
                <span className="stat-value">{card.value}</span>
                <span className="stat-label">{card.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="settings-grid">
          <section className="settings-card simulation-status-card">
            <h2 className="settings-card-title">Simulation Status</h2>
            <div className="simulation-toggle-container">
              <span
                className={`status-indicator ${simulationSettings.simulationEnabled ? 'status-active' : 'status-inactive'}`}
              >
                {simulationSettings.simulationEnabled ? 'Active' : 'Inactive'}
              </span>
              <button
                className={`toggle-button ${simulationSettings.simulationEnabled ? 'toggle-active' : ''}`}
                onClick={handleToggleSimulation}
                disabled={isSaving}
              >
                <span className="toggle-slider"></span>
              </button>
            </div>
            <p className="settings-description">
              {simulationSettings.simulationEnabled
                ? 'Students can currently access the selected simulation mode.'
                : 'Students are currently blocked from accessing the simulation.'}
            </p>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Simulation Mode</h2>
            <p className="settings-description">
              Choose whether students work in the original scheduling simulator or the new capacity-planning problem.
            </p>
            <div className="display-mode-toggle">
              {SIMULATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`mode-option ${simulationMode === mode.id ? 'mode-active' : ''}`}
                  onClick={() => handleSimulationModeChange(mode.id)}
                  disabled={isSaving}
                >
                  <span className="mode-label">{mode.label}</span>
                  <span className="mode-desc">{mode.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Simulation Difficulty</h2>
            <p className="settings-description">
              Applies to scheduling mock-data generation and capacity-planning simulation behavior.
            </p>
            <div className="display-mode-toggle">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`mode-option ${simulationDifficulty === option.id ? 'mode-active' : ''}`}
                  onClick={() => handleSimulationDifficultyChange(option.id)}
                  disabled={isSaving}
                >
                  <span className="mode-label">{option.label}</span>
                  <span className="mode-desc">{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card historical-data-card">
            <h2 className="settings-card-title">Historical Data</h2>
            <div className="simulation-toggle-container">
              <span
                className={`status-indicator ${simulationSettings.historicalDataEnabled ? 'status-active' : 'status-inactive'}`}
              >
                {simulationSettings.historicalDataEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                className={`toggle-button ${simulationSettings.historicalDataEnabled ? 'toggle-active' : ''}`}
                onClick={handleToggleHistoricalData}
                disabled={isSaving}
              >
                <span className="toggle-slider"></span>
              </button>
            </div>
            <p className="settings-description">
              {simulationSettings.historicalDataEnabled
                ? 'Students can view historical scheduling data and use the interactive code playground to perform their own analytics.'
                : 'Enable to give students access to historical scheduling records and an interactive analytics playground.'}
            </p>
          </section>

          <section className="settings-card chapter-settings-card">
            <h2 className="settings-card-title">Chapter Progression</h2>
            <p className="settings-description">
              Use chapter mode to align the student experience with your curriculum flow.
            </p>
            <label className="chapter-label">
              Active Chapter
              <select className="chapter-select" value={currentChapter} onChange={handleChapterChange}>
                {SIMULATION_CHAPTERS.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    Chapter {chapter.id}: {chapter.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="chapter-summary-box">
              <span className="chapter-summary-title">{chapterInfo.title}</span>
              <p>{chapterInfo.summary}</p>
              <small>{chapterInfo.keyQuestion}</small>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Scheduling Rules</h2>
            <div className="rules-info">
              {schedulingRules.map((rule) => (
                <div key={rule.code} className="rule-item">
                  <span className="rule-code" style={{ backgroundColor: rule.color }}>
                    {rule.code}
                  </span>
                  <div className="rule-details">
                    <span className="rule-name">{rule.name}</span>
                    <span className="rule-constraint">{rule.constraint}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Client Display Mode</h2>
            <p className="settings-description">Choose how clients are displayed to students.</p>
            <div className="display-mode-toggle">
              {DISPLAY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`mode-option ${simulationSettings.clientDisplayMode === mode.id ? 'mode-active' : ''}`}
                  onClick={() => updateSimulationSettings({ clientDisplayMode: mode.id })}
                >
                  <span className="mode-label">{mode.label}</span>
                  <span className="mode-desc">{mode.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Priority Levels</h2>
            <p className="settings-description">Enable or disable priority levels for the simulation.</p>
            <div className="priority-toggles">
              {Object.entries(priorityLevelsEnabled).map(([priorityLevel, isEnabled]) => (
                <div key={priorityLevel} className="priority-toggle-row">
                  <span className={`priority-badge priority-${priorityLevel}`}>
                    {formatPriorityLabel(priorityLevel)}
                  </span>
                  <button
                    className={`mini-toggle ${isEnabled ? 'mini-toggle-active' : ''}`}
                    onClick={() => handlePriorityToggle(priorityLevel)}
                  >
                    <span className="mini-toggle-slider"></span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-card clinicians-card">
            <h2 className="settings-card-title">Clinicians</h2>
            <p className="settings-description">Available clinicians for scheduling.</p>
            <div className="clinicians-list">
              {clinicians.map((clinician) => (
                <div key={clinician.id} className="clinician-item">
                  <span className="clinician-color-dot" style={{ backgroundColor: clinician.color }} />
                  <div className="clinician-info">
                    <span className="clinician-name">{clinician.name}</span>
                    <span className="clinician-specialty">{clinician.specialty}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-card client-queue-card">
            <h2 className="settings-card-title">Client Queue Management</h2>
            <p className="settings-description">Add or remove clients from the simulation queue.</p>

            <form className="add-client-form" onSubmit={handleAddClient}>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Client Name"
                  className="form-input-small"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required
                />
                <input
                  type="number"
                  placeholder="Age"
                  className="form-input-small age-input"
                  value={newClientAge}
                  onChange={(e) => setNewClientAge(e.target.value)}
                  required
                  min="1"
                  max="18"
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Diagnosis"
                  className="form-input-small"
                  value={newClientDiagnosis}
                  onChange={(e) => setNewClientDiagnosis(e.target.value)}
                  required
                />
                <select
                  className="form-select-small"
                  value={newClientPriority}
                  onChange={(e) => setNewClientPriority(e.target.value)}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Referral Notes"
                className="form-input-small full-width"
                value={newClientReferralNotes}
                onChange={(e) => setNewClientReferralNotes(e.target.value)}
                required
              />
              <button type="submit" className="add-client-button">
                + Add Client
              </button>
            </form>

            <div className="client-queue-list">
              {clientQueue.map((client) => (
                <div key={client.id} className="client-queue-item">
                  <div className="client-queue-info">
                    <span className="client-queue-name">{client.name}</span>
                    <span className="client-queue-details">
                      {client.age}yo • {client.diagnosis}
                    </span>
                  </div>
                  <span className={`priority-badge priority-${client.priority}`}>{client.priority}</span>
                  <button className="remove-client-button" onClick={() => handleRemoveClient(client.id)}>
                    ✕
                  </button>
                </div>
              ))}
              {clientQueue.length === 0 && <p className="empty-queue-message">No clients in queue</p>}
            </div>
          </section>

          {completedClientsCount > 0 && (
            <section className="settings-card completed-clients-card">
              <h2 className="settings-card-title">Scheduled Clients</h2>
              <p className="settings-description">Clients who have been fully scheduled.</p>
              <div className="completed-clients-list">
                {completedClients.map((client) => (
                  <div key={client.id} className="completed-client-item">
                    <span className="completed-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <div className="completed-client-info">
                      <span className="completed-client-name">{client.name}</span>
                      <span className="completed-client-details">{client.diagnosis}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="settings-card seed-database-card">
            <h2 className="settings-card-title">Seed Database from CSV</h2>
            <p className="settings-description">
              Upload a CSV file with visit data to populate the database with clients, clinicians, and appointments.
            </p>

            <div className="seed-actions">
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button className="seed-upload-button" onClick={() => fileInputRef.current?.click()} disabled={isSeeding}>
                {isSeeding ? 'Processing...' : 'Upload CSV File'}
              </button>
              <button className="seed-clear-button" onClick={handleClearDatabase} disabled={isSeeding}>
                Clear All Data
              </button>
            </div>

            <div className="seed-actions mock-seed-actions">
              <select
                className="mock-difficulty-select"
                value={simulationDifficulty}
                onChange={(event) => handleSimulationDifficultyChange(event.target.value)}
                disabled={isSeeding || isSaving}
              >
                <option value="easy">Easy mock data</option>
                <option value="medium">Medium mock data</option>
                <option value="hard">Hard mock data</option>
              </select>
              <button className="seed-generate-button" onClick={handleGenerateMockData} disabled={isSeeding}>
                {isSeeding ? 'Generating...' : 'Generate Mock Data'}
              </button>
            </div>

            {seedingStatus && <div className={seedingStatusClassName}>{seedingStatus}</div>}

            {seedingLogs.length > 0 && (
              <div className="seeding-logs">
                {seedingLogs.map((log, index) => (
                  <div key={index} className="seeding-log-line">
                    {log}
                  </div>
                ))}
              </div>
            )}

            <div className="csv-format-info">
              <span className="format-title">Expected CSV format:</span>
              <code>
                client_id, clinician_id, visit_type, booking_datetime, scheduled_start, scheduled_end, status,
                cancel_datetime
              </code>
            </div>
          </section>
        </div>

        <div className="dashboard-actions">
          <button className="reset-button" onClick={handleResetAllSettings}>
            Reset All Settings to Default
          </button>
        </div>
      </main>
    </div>
  )
}

export default InstructorDashboard
