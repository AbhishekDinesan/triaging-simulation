import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import PatientCardDeck from './PatientCardDeck'
import './CalendarTab.css'

const initialPatients = [
  {
    id: 1,
    name: 'Eleanor Vance',
    age: 67,
    condition: 'Cardiac Evaluation',
    urgency: 'high',
    symptoms: 'Chest pain, shortness of breath',
  },
  {
    id: 2,
    name: 'Marcus Chen',
    age: 34,
    condition: 'Follow-up: Fracture',
    urgency: 'medium',
    symptoms: 'Wrist pain after cast removal',
  },
  {
    id: 3,
    name: 'Sarah Mitchell',
    age: 45,
    condition: 'Routine Checkup',
    urgency: 'low',
    symptoms: 'Annual physical examination',
  },
  {
    id: 4,
    name: 'James Okonkwo',
    age: 52,
    condition: 'Diabetes Management',
    urgency: 'medium',
    symptoms: 'Blood sugar fluctuations',
  },
  {
    id: 5,
    name: 'Maria Rodriguez',
    age: 29,
    condition: 'Prenatal Care',
    urgency: 'high',
    symptoms: '28 weeks pregnant, routine monitoring',
  },
  {
    id: 6,
    name: 'David Kim',
    age: 71,
    condition: 'Post-Surgery Review',
    urgency: 'high',
    symptoms: 'Hip replacement follow-up',
  },
]

function CalendarTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [patients, setPatients] = useState(initialPatients)
  const [appointments, setAppointments] = useState([])
  const [activePatient, setActivePatient] = useState(null)

  const schedulePatient = (patientId, date) => {
    const patient = patients.find((p) => p.id === patientId)
    if (!patient) return
    setAppointments([...appointments, { ...patient, scheduledDate: date, appointmentId: Date.now() }])
    setPatients(patients.filter((p) => p.id !== patientId))
    setActivePatient(null)
  }

  const handleCellClick = (day, monthStart) => {
    if (!isSameMonth(day, monthStart)) return
    setSelectedDate(day)
    if (activePatient) schedulePatient(activePatient, day)
  }

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    let day = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)
    const rows = []

    while (day <= endDate) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const currentDay = day
        const dayAppts = appointments.filter((apt) => isSameDay(apt.scheduledDate, currentDay))
        const isDisabled = !isSameMonth(day, monthStart)
        const isSelected = isSameDay(day, selectedDate)
        const isToday = isSameDay(day, new Date())

        week.push(
          <div
            key={day.toString()}
            className={`calendar-cell ${isDisabled ? 'disabled' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
            onClick={() => handleCellClick(currentDay, monthStart)}
          >
            <span className="day-number">{format(day, 'd')}</span>
            <div className="appointments-container">
              {dayAppts.map((apt) => (
                <div
                  key={apt.appointmentId}
                  className={`appointment-chip urgency-${apt.urgency}`}
                  title={`${apt.name} - ${apt.condition}`}
                >
                  {apt.name.split(' ')[0]}
                </div>
              ))}
            </div>
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
          <p>Select a date to schedule patient appointments</p>
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

        {selectedDate && (
          <div className="selected-date-info">
            <span className="date-label">Selected:</span>
            <span className="date-value">{format(selectedDate, 'EEEE, MMMM do, yyyy')}</span>
          </div>
        )}
      </div>

      <div className="deck-section">
        <PatientCardDeck
          patients={patients}
          activePatientCard={activePatient}
          setActivePatientCard={setActivePatient}
          selectedDate={selectedDate}
          onSchedule={schedulePatient}
        />
      </div>
    </div>
  )
}

export default CalendarTab
