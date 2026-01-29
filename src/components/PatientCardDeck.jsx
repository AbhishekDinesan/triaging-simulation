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
  const [currentStackIndex, setCurrentStackIndex] = useState(0)

  const minimumNoticeDays = simulationSettings?.minimumBookingNoticeDays || 0
  const displayMode = simulationSettings?.patientDisplayMode || 'queue'
  const isStackMode = displayMode === 'stack'

  const validIndex = Math.min(currentStackIndex, Math.max(0, patients.length - 1))
  if (validIndex !== currentStackIndex && patients.length > 0) {
    setCurrentStackIndex(validIndex)
  }

  function handleNextPatient() {
    if (currentStackIndex < patients.length - 1) {
      setCurrentStackIndex(currentStackIndex + 1)
      setActivePatientCard(null)
    }
  }

  function handlePrevPatient() {
    if (currentStackIndex > 0) {
      setCurrentStackIndex(currentStackIndex - 1)
      setActivePatientCard(null)
    }
  }

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

  const currentPatient = isStackMode && patients.length > 0 ? patients[currentStackIndex] : null

  return (
    <div className={`patient-deck ${isStackMode ? 'stack-mode' : 'queue-mode'}`}>
      <div className="deck-header">
        <div>
          <h3>{isStackMode ? '🃏 Patient Stack' : '📋 Patient Queue'}</h3>
          <p>
            {isStackMode && patients.length > 0
              ? `Patient ${currentStackIndex + 1} of ${patients.length}`
              : `${patients.length} patients awaiting scheduling`}
          </p>
        </div>
        {isStackMode && <span className="mode-badge">One at a time</span>}
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

      {isStackMode && patients.length > 0 && (
        <div className="stack-navigation">
          <button className="stack-nav-btn prev" onClick={handlePrevPatient} disabled={currentStackIndex === 0}>
            ← Previous
          </button>
          <div className="stack-progress">
            {patients.map((_, idx) => (
              <span
                key={idx}
                className={`progress-dot ${idx === currentStackIndex ? 'active' : ''} ${idx < currentStackIndex ? 'completed' : ''}`}
              />
            ))}
          </div>
          <button
            className="stack-nav-btn next"
            onClick={handleNextPatient}
            disabled={currentStackIndex === patients.length - 1}
          >
            Next →
          </button>
        </div>
      )}

      <div className="cards-container">
        {isStackMode && currentPatient && (
          <div
            key={currentPatient.id}
            className={`patient-card stack-card urgency-${currentPatient.urgency} ${activePatientCard === currentPatient.id ? 'active' : ''}`}
            onClick={() => handleCardClick(currentPatient)}
          >
            <div className="card-header">
              <div className="patient-avatar">
                {currentPatient.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>
              <div className="patient-info">
                <div className="patient-name">{currentPatient.name}</div>
                <span className="patient-age">Age: {currentPatient.age}</span>
              </div>
              <div className="urgency-badge">
                {URGENCY_CONFIG[currentPatient.urgency]?.icon} {URGENCY_CONFIG[currentPatient.urgency]?.label}
              </div>
            </div>

            <div className="card-body">
              <div className="card-condition">
                <span className="label">Condition:</span> {currentPatient.condition}
              </div>
              <div className="card-symptoms">
                <span className="label">Symptoms:</span> {currentPatient.symptoms}
              </div>
            </div>

            <div className="card-footer">
              {activePatientCard === currentPatient.id ? (
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
                        onSchedule(currentPatient.id, selectedDate)
                      }}
                    >
                      Confirm
                    </button>
                  )}
                </div>
              ) : (
                <span className="tap-hint">Tap to view full profile →</span>
              )}
            </div>
          </div>
        )}

        {!isStackMode &&
          patients.map((patient) => (
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
