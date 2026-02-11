import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import SchedulingWizard from './SchedulingWizard'
import './ClientCardDeck.css'

const PRIORITY_CONFIG = {
  high: { label: 'High Priority', description: 'Requires early intervention' },
  medium: { label: 'Medium Priority', description: 'Standard scheduling' },
  low: { label: 'Low Priority', description: 'Flexible scheduling' },
}

const REQUIRED_APPOINTMENTS = [
  { code: 'AX', color: '#6366f1', name: '1 Assessment' },
  { code: 'SP', color: '#f59e0b', name: '1 Service Planning' },
  { code: 'BLK', color: '#10b981', name: '6 Therapy Blocks' },
]

function getClientInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
}

function ClientProfileModal({ client, onClose, onSchedule }) {
  if (!client) return null

  const priorityInfo = PRIORITY_CONFIG[client.priority]

  const modalContent = (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close-button" onClick={onClose}>
          ✕
        </button>

        <div className="profile-header">
          <div className={`profile-avatar priority-${client.priority}`}>{getClientInitials(client.name)}</div>
          <div className="profile-header-info">
            <h2 className="profile-name">{client.name}</h2>
            <div className={`profile-priority-badge priority-${client.priority}`}>{priorityInfo?.label}</div>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-detail-row">
            <span className="profile-detail-label">Age</span>
            <span className="profile-detail-value">{client.age ? `${client.age} years old` : 'Not specified'}</span>
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">Diagnosis</span>
            <span className="profile-detail-value">{client.diagnosis}</span>
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">Priority Level</span>
            <span className="profile-detail-value">
              {priorityInfo?.label} — {priorityInfo?.description}
            </span>
          </div>

          <div className="profile-detail-section">
            <span className="profile-detail-label">Referral Notes</span>
            <p className="profile-notes">{client.referralNotes}</p>
          </div>

          <div className="profile-detail-section">
            <span className="profile-detail-label">Required Appointments</span>
            <div className="appointment-info-grid">
              {REQUIRED_APPOINTMENTS.map((appointment) => (
                <div key={appointment.code} className="apt-info-item">
                  <span className="apt-code" style={{ backgroundColor: appointment.color }}>
                    {appointment.code}
                  </span>
                  <span className="apt-name">{appointment.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button className="profile-action-button primary" onClick={() => onSchedule(client)}>
            Schedule Full Therapy Block
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

function ClientCardDeck({ onSchedulingComplete }) {
  const { simulationSettings } = useSimulationSettings()
  const [viewingClientProfile, setViewingClientProfile] = useState(null)
  const [schedulingClient, setSchedulingClient] = useState(null)
  const [currentStackIndex, setCurrentStackIndex] = useState(0)

  const displayMode = simulationSettings?.clientDisplayMode || 'queue'
  const isStackMode = displayMode === 'stack'

  const clients = (simulationSettings?.clientQueue || []).filter(
    (client) => simulationSettings?.priorityLevelsEnabled?.[client.priority] !== false
  )

  const validIndex = Math.min(currentStackIndex, Math.max(0, clients.length - 1))
  useEffect(() => {
    if (clients.length > 0 && validIndex !== currentStackIndex) {
      setCurrentStackIndex(validIndex)
    }
  }, [clients.length, validIndex, currentStackIndex])

  function handleNextClient() {
    if (currentStackIndex < clients.length - 1) {
      setCurrentStackIndex(currentStackIndex + 1)
    }
  }

  function handlePrevClient() {
    if (currentStackIndex > 0) {
      setCurrentStackIndex(currentStackIndex - 1)
    }
  }

  function handleCardClick(client) {
    setViewingClientProfile(client)
  }

  function handleScheduleClick(client) {
    setViewingClientProfile(null)
    setSchedulingClient(client)
  }

  function handleSchedulingComplete(clientId, appointments) {
    setSchedulingClient(null)
    if (isStackMode && currentStackIndex >= clients.length - 1 && currentStackIndex > 0) {
      setCurrentStackIndex(currentStackIndex - 1)
    }
    onSchedulingComplete?.(clientId, appointments)
  }

  function handleCloseProfile() {
    setViewingClientProfile(null)
  }

  function handleCloseWizard() {
    setSchedulingClient(null)
  }

  function renderClientCard(client, options = {}) {
    const { stackMode = false, showTapHint = true } = options
    return (
      <div
        key={client.id}
        className={`client-card ${stackMode ? 'stack-card' : ''} priority-${client.priority}`.trim()}
        onClick={() => handleCardClick(client)}
      >
        <div className="card-header">
          <div className="client-avatar">{getClientInitials(client.name)}</div>
          <div className="client-info">
            <div className="client-name">{client.name}</div>
            <span className="client-age">{client.age ? `Age: ${client.age}` : ''}</span>
          </div>
          {stackMode ? (
            <div className="priority-badge">{PRIORITY_CONFIG[client.priority]?.label}</div>
          ) : (
            <div className={`priority-badge priority-${client.priority}`}>
              <span className="priority-dot"></span>
            </div>
          )}
        </div>

        <div className="card-body">
          <div className="card-diagnosis">
            <span className="label">Diagnosis:</span> {client.diagnosis}
          </div>
          {stackMode && (
            <div className="card-notes">
              <span className="label">Notes:</span> {client.referralNotes}
            </div>
          )}
        </div>

        <div className="card-footer">
          {stackMode ? (
            <button
              className="schedule-block-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleScheduleClick(client)
              }}
            >
              Schedule Therapy Block
            </button>
          ) : (
            showTapHint && <span className="tap-hint">Tap to view profile →</span>
          )}
        </div>
      </div>
    )
  }

  const currentClient = isStackMode && clients.length > 0 ? clients[currentStackIndex] : null

  return (
    <div className={`client-deck ${isStackMode ? 'stack-mode' : 'queue-mode'}`}>
      <div className="deck-header">
        <div>
          <h3>{isStackMode ? 'Client Stack' : 'New Arrivals'}</h3>
          <p>
            {isStackMode && clients.length > 0
              ? `Client ${currentStackIndex + 1} of ${clients.length}`
              : `${clients.length} clients awaiting scheduling`}
          </p>
        </div>
        {isStackMode && <span className="mode-badge">One at a time</span>}
      </div>

      <div className="therapy-info-banner">
        <span className="banner-text">
          Each client requires <strong>8 appointments</strong>: 1 AX + 1 SP + 6 Therapy Blocks
        </span>
      </div>

      {isStackMode && clients.length > 0 && (
        <div className="stack-navigation">
          <button className="stack-nav-btn prev" onClick={handlePrevClient} disabled={currentStackIndex === 0}>
            ← Previous
          </button>
          <div className="stack-progress">
            {clients.map((_, idx) => (
              <span
                key={idx}
                className={`progress-dot ${idx === currentStackIndex ? 'active' : ''} ${idx < currentStackIndex ? 'completed' : ''}`}
              />
            ))}
          </div>
          <button
            className="stack-nav-btn next"
            onClick={handleNextClient}
            disabled={currentStackIndex === clients.length - 1}
          >
            Next →
          </button>
        </div>
      )}

      <div className="cards-container">
        {isStackMode && currentClient && renderClientCard(currentClient, { stackMode: true })}
        {!isStackMode && clients.map((client) => renderClientCard(client))}

        {clients.length === 0 && (
          <div className="empty-deck">
            <p>All clients scheduled</p>
          </div>
        )}
      </div>

      <div className="deck-legend">
        <div className="legend-item">
          <span className="dot high"></span> High Priority
        </div>
        <div className="legend-item">
          <span className="dot medium"></span> Medium
        </div>
        <div className="legend-item">
          <span className="dot low"></span> Low
        </div>
      </div>

      <ClientProfileModal client={viewingClientProfile} onClose={handleCloseProfile} onSchedule={handleScheduleClick} />

      {schedulingClient && (
        <SchedulingWizard
          client={schedulingClient}
          onClose={handleCloseWizard}
          onScheduled={handleSchedulingComplete}
        />
      )}
    </div>
  )
}

export default ClientCardDeck
