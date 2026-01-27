import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import './PatientCardDeck.css'

const URGENCY_CONFIG = {
  high: { label: 'Urgent', icon: '🔴', description: 'Requires immediate attention' },
  medium: { label: 'Moderate', icon: '🟡', description: 'Should be seen soon' },
  low: { label: 'Routine', icon: '🟢', description: 'Standard appointment' },
}

function PatientProfileModal({ patient, onClose, onSelectForScheduling, isSelectedForScheduling }) {
  if (!patient) return null

  const urgencyInfo = URGENCY_CONFIG[patient.urgency]

  const modalContent = (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close-button" onClick={onClose}>
          ✕
        </button>

        <div className="profile-header">
          <div className={`profile-avatar urgency-${patient.urgency}`}>
            {patient.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div className="profile-header-info">
            <h2 className="profile-name">{patient.name}</h2>
            <div className={`profile-urgency-badge urgency-${patient.urgency}`}>
              {urgencyInfo?.icon} {urgencyInfo?.label}
            </div>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-detail-row">
            <span className="profile-detail-label">Age</span>
            <span className="profile-detail-value">{patient.age} years old</span>
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">Condition</span>
            <span className="profile-detail-value">{patient.condition}</span>
          </div>

          <div className="profile-detail-row">
            <span className="profile-detail-label">Priority Level</span>
            <span className="profile-detail-value">
              {urgencyInfo?.label} — {urgencyInfo?.description}
            </span>
          </div>

          <div className="profile-detail-section">
            <span className="profile-detail-label">Presenting Symptoms</span>
            <p className="profile-symptoms">{patient.symptoms}</p>
          </div>

          <div className="profile-detail-section">
            <span className="profile-detail-label">Scheduling Notes</span>
            <p className="profile-notes">
              {patient.urgency === 'high' &&
                'This patient requires priority scheduling. Please book at the earliest available date.'}
              {patient.urgency === 'medium' && 'This patient should be scheduled within the next few days if possible.'}
              {patient.urgency === 'low' && 'This is a routine appointment. Schedule at any convenient time.'}
            </p>
          </div>
        </div>

        <div className="profile-actions">
          {isSelectedForScheduling ? (
            <button className="profile-action-button selected" onClick={onClose}>
              ✓ Selected — Choose a Date
            </button>
          ) : (
            <button className="profile-action-button primary" onClick={() => onSelectForScheduling(patient.id)}>
              Schedule This Patient
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

function PatientCardDeck({ patients, activePatientCard, setActivePatientCard, selectedDate, onSchedule }) {
  const { simulationSettings } = useSimulationSettings()
  const [viewingPatientProfile, setViewingPatientProfile] = useState(null)

  const minimumNoticeDays = simulationSettings?.minimumBookingNoticeDays || 0

  function handleCardClick(patient) {
    setViewingPatientProfile(patient)
  }

  function handleSelectForScheduling(patientId) {
    setActivePatientCard(patientId)
    setViewingPatientProfile(null)
  }

  function handleCloseProfile() {
    setViewingPatientProfile(null)
  }

  return (
    <div className="patient-deck">
      <div className="deck-header">
        <div>
          <h3>🃏 Patient Queue</h3>
          <p>{patients.length} patients awaiting scheduling</p>
        </div>
      </div>

      {minimumNoticeDays > 0 && (
        <div className="booking-horizon-notice">
          <span className="notice-icon">📅</span>
          <span className="notice-text">
            Appointments must be booked at least{' '}
            <strong>
              {minimumNoticeDays} day{minimumNoticeDays > 1 ? 's' : ''}
            </strong>{' '}
            in advance
          </span>
        </div>
      )}

      {activePatientCard && (
        <div className="scheduling-hint">
          {selectedDate ? 'Click a date to confirm scheduling' : 'Select an available date on the calendar'}
        </div>
      )}

      <div className="cards-container">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className={`patient-card urgency-${patient.urgency} ${activePatientCard === patient.id ? 'active' : ''}`}
            onClick={() => handleCardClick(patient)}
          >
            <div className="card-header">
              <div className="patient-avatar">
                {patient.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="patient-info">
                <div className="patient-name">{patient.name}</div>
                <span className="patient-age">Age: {patient.age}</span>
              </div>
              <div className="urgency-badge">
                {URGENCY_CONFIG[patient.urgency]?.icon} {URGENCY_CONFIG[patient.urgency]?.label}
              </div>
            </div>

            <div className="card-body">
              <div className="card-condition">
                <span className="label">Condition:</span> {patient.condition}
              </div>
            </div>

            <div className="card-footer">
              {activePatientCard === patient.id ? (
                <div className="action-buttons">
                  <button
                    className="cancel-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActivePatientCard(null)
                    }}
                  >
                    Cancel
                  </button>
                  {selectedDate && (
                    <button
                      className="schedule-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSchedule(patient.id, selectedDate)
                      }}
                    >
                      Confirm
                    </button>
                  )}
                </div>
              ) : (
                <span className="tap-hint">Tap to view profile →</span>
              )}
            </div>
          </div>
        ))}

        {patients.length === 0 && (
          <div className="empty-deck">
            <span className="empty-icon">✅</span>
            <p>All patients scheduled!</p>
          </div>
        )}
      </div>

      <div className="deck-legend">
        <div className="legend-item">
          <span className="dot high"></span> Urgent
        </div>
        <div className="legend-item">
          <span className="dot medium"></span> Moderate
        </div>
        <div className="legend-item">
          <span className="dot low"></span> Routine
        </div>
      </div>

      <PatientProfileModal
        patient={viewingPatientProfile}
        onClose={handleCloseProfile}
        onSelectForScheduling={handleSelectForScheduling}
        isSelectedForScheduling={activePatientCard === viewingPatientProfile?.id}
      />
    </div>
  )
}

export default PatientCardDeck
