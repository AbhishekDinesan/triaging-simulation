import { createPortal } from 'react-dom'
import { format, setHours, setMinutes } from 'date-fns'
import './DailyScheduleView.css'

const CLINIC_HOURS = {
  start: 8,
  end: 18,
}

const URGENCY_CONFIG = {
  high: { label: 'Urgent', icon: '🔴' },
  medium: { label: 'Moderate', icon: '🟡' },
  low: { label: 'Routine', icon: '🟢' },
}

function DailyScheduleView({ selectedDate, appointments, activePatient, patients, onScheduleAtTime, onClose }) {
  if (!selectedDate) return null

  const hoursInDay = []
  for (let hour = CLINIC_HOURS.start; hour < CLINIC_HOURS.end; hour++) {
    hoursInDay.push(hour)
  }

  function getAppointmentsForHour(hour) {
    return appointments.filter((apt) => {
      if (!apt.scheduledHour && apt.scheduledHour !== 0) return false
      return apt.scheduledHour === hour
    })
  }

  function handleTimeSlotClick(hour) {
    if (activePatient) {
      const dateWithTime = setMinutes(setHours(selectedDate, hour), 0)
      onScheduleAtTime(activePatient, dateWithTime, hour)
    }
  }

  function isSlotAvailable(hour) {
    const appointmentsAtHour = getAppointmentsForHour(hour)
    return appointmentsAtHour.length === 0
  }

  const activePatientData = patients.find((p) => p.id === activePatient)

  const modalContent = (
    <div className="daily-view-overlay" onClick={onClose}>
      <div className="daily-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="daily-view-header">
          <button className="daily-view-back" onClick={onClose}>
            ← Back to Calendar
          </button>
          <div className="daily-view-title">
            <h2>{format(selectedDate, 'EEEE')}</h2>
            <span className="daily-view-date">{format(selectedDate, 'MMMM d, yyyy')}</span>
          </div>
          <div className="daily-view-spacer"></div>
        </div>

        {activePatient && activePatientData && (
          <div className="scheduling-patient-banner">
            <span className="scheduling-label">Scheduling:</span>
            <span className="scheduling-patient-name">{activePatientData.name}</span>
            <span className={`scheduling-urgency urgency-${activePatientData.urgency}`}>
              {URGENCY_CONFIG[activePatientData.urgency]?.icon}
            </span>
            <span className="scheduling-instruction">Select a time slot below</span>
          </div>
        )}

        <div className="daily-schedule-container">
          <div className="time-slots">
            {hoursInDay.map((hour) => {
              const appointmentsAtHour = getAppointmentsForHour(hour)
              const slotAvailable = isSlotAvailable(hour)
              const isPM = hour >= 12
              const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
              const timeLabel = `${displayHour}:00 ${isPM ? 'PM' : 'AM'}`

              return (
                <div
                  key={hour}
                  className={`time-slot ${!slotAvailable ? 'occupied' : ''} ${activePatient && slotAvailable ? 'selectable' : ''}`}
                  onClick={() => slotAvailable && activePatient && handleTimeSlotClick(hour)}
                >
                  <div className="time-slot-time">
                    <span className="time-hour">{timeLabel}</span>
                  </div>
                  <div className="time-slot-content">
                    {appointmentsAtHour.length > 0 ? (
                      appointmentsAtHour.map((apt) => (
                        <div key={apt.appointmentId} className={`time-slot-appointment urgency-${apt.urgency}`}>
                          <div className="appointment-main">
                            <span className="appointment-patient-name">{apt.name}</span>
                            <span className={`appointment-urgency-badge urgency-${apt.urgency}`}>
                              {URGENCY_CONFIG[apt.urgency]?.icon} {URGENCY_CONFIG[apt.urgency]?.label}
                            </span>
                          </div>
                          <div className="appointment-details">
                            <span>{apt.condition}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="time-slot-empty">
                        {activePatient ? (
                          <span className="click-to-schedule">Click to schedule here</span>
                        ) : (
                          <span className="available-text">Available</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!activePatient && (
          <div className="daily-view-hint">
            <span className="hint-icon">💡</span>
            <span>Select a patient from the queue to schedule an appointment</span>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default DailyScheduleView
