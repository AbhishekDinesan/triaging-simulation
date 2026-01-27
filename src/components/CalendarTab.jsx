import { useState, useEffect } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
  addMonths,
  subMonths,
} from 'date-fns'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import PatientCardDeck from './PatientCardDeck'
import DailyScheduleView from './DailyScheduleView'
import './CalendarTab.css'

function CalendarTab() {
  const { simulationSettings, updateSimulationSettings } = useSimulationSettings()

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDailyView, setShowDailyView] = useState(false)
  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [activePatient, setActivePatient] = useState(null)

  useEffect(() => {
    if (simulationSettings?.patientQueue) {
      const enabledUrgencyLevels = simulationSettings.urgencyLevelsEnabled || {
        high: true,
        medium: true,
        low: true,
      }
      const filteredPatients = simulationSettings.patientQueue.filter(
        (patient) => enabledUrgencyLevels[patient.urgency]
      )
      setPatients(filteredPatients)
    }
  }, [simulationSettings])

  const schedulePatientAtTime = async (patientId, dateWithTime, hour) => {
    const patient = patients.find((p) => p.id === patientId)
    if (!patient) return

    const newAppointment = {
      ...patient,
      scheduledDate: dateWithTime,
      scheduledHour: hour,
      appointmentId: Date.now(),
    }

    setAppointments([...appointments, newAppointment])

    const remainingPatients = patients.filter((p) => p.id !== patientId)
    setPatients(remainingPatients)

    const updatedQueue = simulationSettings.patientQueue.filter((p) => p.id !== patientId)
    await updateSimulationSettings({ patientQueue: updatedQueue })

    setActivePatient(null)
  }

  const handleCellClick = (day, monthStart) => {
    if (!isSameMonth(day, monthStart)) return
    setSelectedDate(day)
    setShowDailyView(true)
  }

  const handleCloseDailyView = () => {
    setShowDailyView(false)
  }

  const getAppointmentsForDay = (day) => {
    return appointments.filter((apt) => isSameDay(apt.scheduledDate, day))
  }

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    let day = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)
    const rows = []

    const todayStart = startOfDay(new Date())
    const minimumNoticeDays = simulationSettings?.minimumBookingNoticeDays || 0
    const earliestBookableDate = addDays(todayStart, minimumNoticeDays)

    while (day <= endDate) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const currentDay = day
        const currentDayStart = startOfDay(currentDay)
        const dayAppts = getAppointmentsForDay(currentDay)
        const isOutsideMonth = !isSameMonth(day, monthStart)
        const isSelected = isSameDay(day, selectedDate)
        const isToday = isSameDay(day, new Date())
        const isPastDate = isBefore(currentDayStart, todayStart)
        const isFutureWithinHorizon = !isPastDate && !isToday && isBefore(currentDayStart, earliestBookableDate)
        const isUnbookable = isPastDate || isFutureWithinHorizon
        const isDisabled = isOutsideMonth || isUnbookable

        const maxPatientsReached = dayAppts.length >= (simulationSettings?.maxPatientsPerDay || 10)

        const cellIsClickable = !isDisabled && !maxPatientsReached

        week.push(
          <div
            key={day.toString()}
            className={`calendar-cell ${isOutsideMonth ? 'disabled' : ''} ${isPastDate && !isOutsideMonth ? 'past-date' : ''} ${isFutureWithinHorizon && !isOutsideMonth ? 'booking-horizon' : ''} ${isSelected && showDailyView ? 'selected' : ''} ${isToday ? 'today' : ''} ${maxPatientsReached && !isDisabled ? 'full' : ''}`}
            onClick={() => cellIsClickable && handleCellClick(currentDay, monthStart)}
          >
            <span className="day-number">{format(day, 'd')}</span>
            <div className="appointments-container">
              {dayAppts.slice(0, 3).map((apt) => (
                <div
                  key={apt.appointmentId}
                  className={`appointment-chip urgency-${apt.urgency}`}
                  title={`${apt.name} - ${apt.condition}`}
                >
                  {apt.name.split(' ')[0]}
                </div>
              ))}
              {dayAppts.length > 3 && <div className="more-appointments">+{dayAppts.length - 3} more</div>}
            </div>
            {maxPatientsReached && !isDisabled && <span className="full-indicator">Full</span>}
            {isFutureWithinHorizon && !isOutsideMonth && <span className="horizon-indicator">Too Soon</span>}
          </div>
        )
        day = addDays(day, 1)
      }
      rows.push(
        <div key={day.toString()} className="calendar-row">
          {week}
        </div>
      )
    }
    return rows
  }

  return (
    <div className="calendar-tab">
      <div className="calendar-section">
        <div className="section-header">
          <h2>Appointment Calendar</h2>
          <p>Select a date to view and schedule appointments</p>
        </div>

        <div className="calendar-container">
          <div className="calendar-header">
            <button className="nav-button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              ←
            </button>
            <h2 className="month-title">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button className="nav-button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              →
            </button>
          </div>

          <div className="days-row">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="day-name">
                {d}
              </div>
            ))}
          </div>

          <div className="calendar-body">{renderCalendar()}</div>
        </div>

        {activePatient && !showDailyView && (
          <div className="calendar-scheduling-hint">
            <span className="hint-icon">👆</span>
            <span>Select a date on the calendar to schedule the patient</span>
          </div>
        )}
      </div>

      <div className="deck-section">
        <PatientCardDeck
          patients={patients}
          activePatientCard={activePatient}
          setActivePatientCard={setActivePatient}
          selectedDate={selectedDate}
          onSchedule={() => {}}
        />
      </div>

      {showDailyView && selectedDate && (
        <DailyScheduleView
          selectedDate={selectedDate}
          appointments={getAppointmentsForDay(selectedDate)}
          activePatient={activePatient}
          patients={patients}
          onScheduleAtTime={schedulePatientAtTime}
          onClose={handleCloseDailyView}
        />
      )}
    </div>
  )
}

export default CalendarTab
