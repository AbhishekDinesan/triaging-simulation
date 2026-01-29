import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import './InstructorDashboard.css'

function InstructorDashboard() {
  const { currentUser, logoutUser } = useAuthContext()
  const { simulationSettings, updateSimulationSettings, resetSimulationSettings, settingsLoading } =
    useSimulationSettings()
  const navigate = useNavigate()

  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientAge, setNewPatientAge] = useState('')
  const [newPatientCondition, setNewPatientCondition] = useState('')
  const [newPatientUrgency, setNewPatientUrgency] = useState('medium')
  const [newPatientSymptoms, setNewPatientSymptoms] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleLogout() {
    await logoutUser()
    navigate('/')
  }

  async function handleToggleSimulation() {
    setIsSaving(true)
    await updateSimulationSettings({
      simulationEnabled: !simulationSettings.simulationEnabled,
    })
    setIsSaving(false)
  }

  async function handleMaxPatientsChange(event) {
    const newValue = parseInt(event.target.value, 10)
    if (newValue > 0) {
      await updateSimulationSettings({ maxPatientsPerDay: newValue })
    }
  }

  async function handleSchedulingWindowChange(event) {
    const newValue = parseInt(event.target.value, 10)
    if (newValue > 0) {
      await updateSimulationSettings({ schedulingWindowDays: newValue })
    }
  }

  async function handleMinimumBookingNoticeChange(event) {
    const newValue = parseInt(event.target.value, 10)
    if (newValue >= 0) {
      await updateSimulationSettings({ minimumBookingNoticeDays: newValue })
    }
  }

  async function handleUrgencyToggle(urgencyLevel) {
    const updatedUrgencyLevels = {
      ...simulationSettings.urgencyLevelsEnabled,
      [urgencyLevel]: !simulationSettings.urgencyLevelsEnabled[urgencyLevel],
    }
    await updateSimulationSettings({ urgencyLevelsEnabled: updatedUrgencyLevels })
  }

  async function handleAddPatient(event) {
    event.preventDefault()
    if (!newPatientName || !newPatientAge || !newPatientCondition || !newPatientSymptoms) return

    const newPatient = {
      id: Date.now(),
      name: newPatientName,
      age: parseInt(newPatientAge, 10),
      condition: newPatientCondition,
      urgency: newPatientUrgency,
      symptoms: newPatientSymptoms,
    }

    const updatedQueue = [...simulationSettings.patientQueue, newPatient]
    await updateSimulationSettings({ patientQueue: updatedQueue })

    setNewPatientName('')
    setNewPatientAge('')
    setNewPatientCondition('')
    setNewPatientUrgency('medium')
    setNewPatientSymptoms('')
  }

  async function handleRemovePatient(patientId) {
    const updatedQueue = simulationSettings.patientQueue.filter((p) => p.id !== patientId)
    await updateSimulationSettings({ patientQueue: updatedQueue })
  }

  async function handleResetAllSettings() {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      await resetSimulationSettings()
    }
  }

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
            <span className="dashboard-logo-icon">🩺</span>
            <div className="dashboard-logo-text">
              <h1>Instructor Dashboard</h1>
              <span className="dashboard-subtitle">Simulation Control Center</span>
            </div>
          </div>
          <div className="dashboard-user-section">
            <span className="user-email">{currentUser?.email}</span>
            <button className="logout-button" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
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
                ? 'Students can currently access and use the simulation.'
                : 'Students are currently blocked from accessing the simulation.'}
            </p>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Scheduling Parameters</h2>
            <div className="parameter-group">
              <label className="parameter-label">
                Max Patients Per Day
                <input
                  type="number"
                  className="parameter-input"
                  value={simulationSettings.maxPatientsPerDay}
                  onChange={handleMaxPatientsChange}
                  min="1"
                  max="50"
                />
              </label>
            </div>
            <div className="parameter-group">
              <label className="parameter-label">
                Scheduling Window (Days)
                <input
                  type="number"
                  className="parameter-input"
                  value={simulationSettings.schedulingWindowDays}
                  onChange={handleSchedulingWindowChange}
                  min="1"
                  max="365"
                />
              </label>
            </div>
            <div className="parameter-group">
              <label className="parameter-label">
                Minimum Booking Notice (Days)
                <input
                  type="number"
                  className="parameter-input"
                  value={simulationSettings.minimumBookingNoticeDays || 0}
                  onChange={handleMinimumBookingNoticeChange}
                  min="0"
                  max="30"
                />
              </label>
              <span className="parameter-hint">Students must book at least this many days in advance</span>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Patient Display Mode</h2>
            <p className="settings-description">Choose how patients are displayed to students.</p>
            <div className="display-mode-toggle">
              <button
                className={`mode-option ${simulationSettings.patientDisplayMode === 'queue' ? 'mode-active' : ''}`}
                onClick={() => updateSimulationSettings({ patientDisplayMode: 'queue' })}
              >
                <span className="mode-icon">📋</span>
                <span className="mode-label">Queue View</span>
                <span className="mode-desc">All patients visible</span>
              </button>
              <button
                className={`mode-option ${simulationSettings.patientDisplayMode === 'stack' ? 'mode-active' : ''}`}
                onClick={() => updateSimulationSettings({ patientDisplayMode: 'stack' })}
              >
                <span className="mode-icon">🃏</span>
                <span className="mode-label">Stack View</span>
                <span className="mode-desc">One patient at a time</span>
              </button>
            </div>
          </section>

          <section className="settings-card">
            <h2 className="settings-card-title">Urgency Levels</h2>
            <p className="settings-description">Enable or disable urgency levels for the simulation.</p>
            <div className="urgency-toggles">
              {Object.entries(simulationSettings.urgencyLevelsEnabled).map(([urgencyLevel, isEnabled]) => (
                <div key={urgencyLevel} className="urgency-toggle-row">
                  <span className={`urgency-badge urgency-${urgencyLevel}`}>
                    {urgencyLevel.charAt(0).toUpperCase() + urgencyLevel.slice(1)}
                  </span>
                  <button
                    className={`mini-toggle ${isEnabled ? 'mini-toggle-active' : ''}`}
                    onClick={() => handleUrgencyToggle(urgencyLevel)}
                  >
                    <span className="mini-toggle-slider"></span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-card patient-queue-card">
            <h2 className="settings-card-title">Patient Queue Management</h2>
            <p className="settings-description">Add or remove patients from the simulation queue.</p>

            <form className="add-patient-form" onSubmit={handleAddPatient}>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Patient Name"
                  className="form-input-small"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  required
                />
                <input
                  type="number"
                  placeholder="Age"
                  className="form-input-small age-input"
                  value={newPatientAge}
                  onChange={(e) => setNewPatientAge(e.target.value)}
                  required
                  min="1"
                  max="120"
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Condition"
                  className="form-input-small"
                  value={newPatientCondition}
                  onChange={(e) => setNewPatientCondition(e.target.value)}
                  required
                />
                <select
                  className="form-select-small"
                  value={newPatientUrgency}
                  onChange={(e) => setNewPatientUrgency(e.target.value)}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Symptoms"
                className="form-input-small full-width"
                value={newPatientSymptoms}
                onChange={(e) => setNewPatientSymptoms(e.target.value)}
                required
              />
              <button type="submit" className="add-patient-button">
                + Add Patient
              </button>
            </form>

            <div className="patient-queue-list">
              {simulationSettings.patientQueue.map((patient) => (
                <div key={patient.id} className="patient-queue-item">
                  <div className="patient-queue-info">
                    <span className="patient-queue-name">{patient.name}</span>
                    <span className="patient-queue-details">
                      {patient.age}yo • {patient.condition}
                    </span>
                  </div>
                  <span className={`urgency-badge urgency-${patient.urgency}`}>{patient.urgency}</span>
                  <button className="remove-patient-button" onClick={() => handleRemovePatient(patient.id)}>
                    ✕
                  </button>
                </div>
              ))}
              {simulationSettings.patientQueue.length === 0 && (
                <p className="empty-queue-message">No patients in queue</p>
              )}
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
