import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays, startOfDay } from 'date-fns'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import {
  scheduleFullTherapyBlock,
  APPOINTMENT_TYPES,
  getCycleInfo,
  countAppointmentsInWeek,
  getWeekStart,
  CONSTRAINTS,
} from '../utils/schedulingUtils'
import './SchedulingWizard.css'

const DEFAULT_CLINICIAN_STATS = {
  weeklyCount: 0,
  availableThisWeek: CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK,
  isFullyBookedThisWeek: false,
  canTakeNewClient: true,
  totalAppointments: 0,
}

const APPOINTMENT_TYPE_PREVIEW = [
  { key: 'AX', label: '1 AX' },
  { key: 'SP', label: '1 SP' },
  { key: 'BLOCK', label: '6 Blocks' },
]

function getClientInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
}

function SchedulingWizard({ client, onClose, onScheduled }) {
  const { simulationSettings, addClientAppointments } = useSimulationSettings()
  const [selectedClinician, setSelectedClinician] = useState(null)
  const [isScheduling, setIsScheduling] = useState(false)
  const [error, setError] = useState(null)
  const [previewAppointments, setPreviewAppointments] = useState(null)
  const [schedulingComplete, setSchedulingComplete] = useState(false)
  const [scheduledAppointments, setScheduledAppointments] = useState(null)

  const clinicians = simulationSettings.clinicians || []
  const existingAppointments = simulationSettings.appointments || []

  const clinicianStats = useMemo(() => {
    const stats = {}
    const today = startOfDay(new Date())
    const thisWeekStart = getWeekStart(today)

    clinicians.forEach((clin) => {
      const weeklyCount = countAppointmentsInWeek(existingAppointments, clin.id, thisWeekStart)
      const totalForClinician = existingAppointments.filter((a) => a.clinicianId === clin.id).length
      const availableThisWeek = CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK - weeklyCount

      stats[clin.id] = {
        weeklyCount,
        totalAppointments: totalForClinician,
        availableThisWeek,
        isFullyBookedThisWeek: availableThisWeek <= 0,
        canTakeNewClient: availableThisWeek >= 8,
      }
    })
    return stats
  }, [clinicians, existingAppointments])

  const handleClinicianSelect = (clinician) => {
    setSelectedClinician(clinician)
    setError(null)

    const startDate = addDays(startOfDay(new Date()), 1)
    const result = scheduleFullTherapyBlock(existingAppointments, client.id, clinician.id, startDate)

    if (result.success) {
      setPreviewAppointments(result.appointments)
    } else {
      setPreviewAppointments(null)
      setError(result.error)
    }
  }

  const handleConfirmScheduling = async () => {
    if (!previewAppointments || previewAppointments.length === 0) return

    setIsScheduling(true)
    setError(null)

    try {
      await addClientAppointments(previewAppointments, client.id)
      setScheduledAppointments(previewAppointments)
      setSchedulingComplete(true)
      onScheduled?.(client.id, previewAppointments)
    } catch (err) {
      setError('Failed to save appointments. Please try again.')
    } finally {
      setIsScheduling(false)
    }
  }

  const cycleInfo = getCycleInfo(new Date())

  if (schedulingComplete && scheduledAppointments) {
    const firstApt = scheduledAppointments.find((a) => a.appointmentType === 'AX')
    const lastApt = scheduledAppointments[scheduledAppointments.length - 1]

    return createPortal(
      <div className="wizard-overlay" onClick={onClose}>
        <div className="wizard-modal success-modal" onClick={(e) => e.stopPropagation()}>
          <div className="success-content">
            <div className="success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="success-title">Scheduling Complete</h2>
            <p className="success-subtitle">All 8 appointments have been booked successfully</p>

            <div className="success-summary">
              <div className="summary-client">
                <span className="summary-label">Client</span>
                <span className="summary-value">{client.name}</span>
              </div>
              <div className="summary-clinician">
                <span className="summary-label">Assigned Clinician</span>
                <span className="summary-value" style={{ color: selectedClinician?.color }}>
                  {selectedClinician?.name}
                </span>
              </div>
              <div className="summary-dates">
                <span className="summary-label">Appointment Dates</span>
                <span className="summary-value">
                  {firstApt && format(new Date(firstApt.scheduledDate), 'MMM d')} —{' '}
                  {lastApt && format(new Date(lastApt.scheduledDate), 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            <div className="success-appointments">
              <h4>Scheduled Appointments</h4>
              <div className="success-apt-list">
                {scheduledAppointments.map((apt, index) => {
                  const typeInfo = APPOINTMENT_TYPES[apt.appointmentType]
                  return (
                    <div key={apt.id} className="success-apt-item">
                      <span className="apt-number">{index + 1}</span>
                      <span className="apt-badge" style={{ backgroundColor: typeInfo.color }}>
                        {typeInfo.code} - {typeInfo.name}
                      </span>
                      <span className="apt-date">{format(new Date(apt.scheduledDate), 'EEE, MMM d')}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <button className="success-close-btn" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  const modalContent = (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wizard-close" onClick={onClose}>
          ✕
        </button>

        <div className="wizard-header">
          <div className="wizard-header-text">
            <h2>Schedule Therapy Block</h2>
            <p>Book complete rehabilitation program for this client</p>
          </div>
        </div>

        <div className="wizard-client-card">
          <div className="client-avatar" style={{ backgroundColor: getPriorityColor(client.priority) }}>
            {getClientInitials(client.name)}
          </div>
          <div className="client-info">
            <h3>{client.name}</h3>
            <span className="client-age">Age {client.age}</span>
            <span className={`priority-badge priority-${client.priority}`}>{client.priority} priority</span>
          </div>
          <div className="client-details">
            <div className="detail-row">
              <span className="detail-label">Diagnosis</span>
              <span className="detail-value">{client.diagnosis}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Referral Notes</span>
              <span className="detail-value">{client.referralNotes}</span>
            </div>
          </div>
        </div>

        <div className="wizard-cycle-info">
          <div className="cycle-badge">
            <span className="cycle-week">Week {cycleInfo.week}</span>
            <span className="cycle-constraints">{cycleInfo.constraints}</span>
          </div>
          <div className="appointment-summary">
            <span>This booking will create:</span>
            <div className="appointment-types-preview">
              {APPOINTMENT_TYPE_PREVIEW.map((item) => (
                <span
                  key={item.key}
                  className="apt-type"
                  style={{ backgroundColor: APPOINTMENT_TYPES[item.key].color }}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="wizard-section">
          <h4>Select Clinician</h4>
          <p className="section-hint">Client will be assigned to this clinician for all 8 appointments</p>

          <div className="clinician-grid">
            {clinicians.map((clin) => {
              const stats = clinicianStats[clin.id] || DEFAULT_CLINICIAN_STATS
              const isSelected = selectedClinician?.id === clin.id
              const isDisabled = stats.isFullyBookedThisWeek

              return (
                <button
                  key={clin.id}
                  className={`clinician-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'fully-booked' : ''}`}
                  onClick={() => !isDisabled && handleClinicianSelect(clin)}
                  disabled={isDisabled}
                >
                  <div
                    className="clinician-color-bar"
                    style={{ backgroundColor: isDisabled ? '#475569' : clin.color }}
                  />
                  <div className="clinician-card-content">
                    <span className="clinician-name">{clin.name}</span>
                    <span className="clinician-specialty">{clin.specialty || clin.id}</span>
                    <div className="clinician-availability">
                      {isDisabled ? (
                        <span className="availability-badge fully-booked">Fully Booked This Week</span>
                      ) : (
                        <span
                          className={`availability-badge ${stats.availableThisWeek <= 8 ? 'limited' : 'available'}`}
                        >
                          {stats.availableThisWeek} slots left this week
                        </span>
                      )}
                    </div>
                    <div className="clinician-stats">
                      <span className="stat-total">{stats.totalAppointments} total appointments</span>
                    </div>
                  </div>
                  {isSelected && <span className="check-mark">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="wizard-error">
            <span>{error}</span>
          </div>
        )}

        {previewAppointments && previewAppointments.length > 0 && (
          <div className="wizard-section preview-section">
            <h4>Appointment Preview</h4>
            <p className="section-hint">All appointments will be booked with {selectedClinician.name}</p>

            <div className="preview-timeline">
              {previewAppointments.map((apt, index) => {
                const typeInfo = APPOINTMENT_TYPES[apt.appointmentType]
                const aptDate = new Date(apt.scheduledDate)
                const aptCycleInfo = getCycleInfo(aptDate)

                return (
                  <div key={apt.id} className="preview-item">
                    <div className="preview-sequence">{index + 1}</div>
                    <div className="preview-type-badge" style={{ backgroundColor: typeInfo.color }}>
                      {typeInfo.code} - {typeInfo.name}
                    </div>
                    <div className="preview-date">
                      <span className="date-main">{format(aptDate, 'EEE, MMM d')}</span>
                      <span className="date-year">{format(aptDate, 'yyyy')}</span>
                    </div>
                    <div className="preview-cycle">Cycle Week {aptCycleInfo.week}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="wizard-actions">
          <button className="wizard-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="wizard-btn confirm"
            onClick={handleConfirmScheduling}
            disabled={!previewAppointments || isScheduling}
          >
            {isScheduling ? 'Scheduling...' : 'Confirm & Schedule All'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'high':
      return '#ef4444'
    case 'medium':
      return '#f59e0b'
    case 'low':
      return '#10b981'
    default:
      return '#6b7280'
  }
}

export default SchedulingWizard
