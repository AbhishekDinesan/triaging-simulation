import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
import { getCycleInfo, APPOINTMENT_TYPES } from '../utils/schedulingUtils'
import ClientCardDeck from './ClientCardDeck'
import './CalendarTab.css'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const APPOINTMENT_BADGES = [
  { type: 'AX', className: 'ax', label: 'AX' },
  { type: 'SP', className: 'sp', label: 'SP' },
  { type: 'BLOCK', className: 'block', label: 'BLK' },
]

const APPOINTMENT_LEGEND = [
  { key: 'AX', label: 'AX (Assessment)' },
  { key: 'SP', label: 'SP (Service Planning)' },
  { key: 'BLOCK', label: 'Block (Therapy)' },
]

const CYCLE_LEGEND = [
  { week: 1, text: 'W1 - AX allowed' },
  { week: 2, text: 'W2 - AX allowed' },
  { week: 3, text: 'W3 - SP allowed' },
]

function CalendarTab() {
  const { simulationSettings } = useSimulationSettings()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedClinician, setSelectedClinician] = useState('all')

  const appointments = simulationSettings?.appointments || []
  const clinicians = simulationSettings?.clinicians || []
  const clients = simulationSettings?.clientQueue || []
  const completedClients = simulationSettings?.completedClients || []

  const filteredAppointments = useMemo(() => {
    if (selectedClinician === 'all') return appointments
    return appointments.filter((apt) => apt.clinicianId === selectedClinician)
  }, [appointments, selectedClinician])

  const clientById = useMemo(() => {
    const map = new Map()
    ;[...clients, ...completedClients].forEach((client) => {
      map.set(client.id, client)
    })
    return map
  }, [clients, completedClients])

  const clinicianById = useMemo(() => {
    const map = new Map()
    clinicians.forEach((clinician) => {
      map.set(clinician.id, clinician)
    })
    return map
  }, [clinicians])

  const getAppointmentsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return filteredAppointments.filter((apt) => {
      const aptDateStr = format(new Date(apt.scheduledDate), 'yyyy-MM-dd')
      return aptDateStr === dateStr
    })
  }

  const handleCellClick = (day, monthStart) => {
    if (!isSameMonth(day, monthStart)) return
    setSelectedDate(isSameDay(day, selectedDate) ? null : day)
  }

  const currentCycleInfo = getCycleInfo(new Date())

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    let day = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)
    const rows = []

    const todayStart = startOfDay(new Date())

    while (day <= endDate) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const currentDay = day
        const currentDayStart = startOfDay(currentDay)
        const dayAppts = getAppointmentsForDay(currentDay)
        const isOutsideMonth = !isSameMonth(day, monthStart)
        const isSelected = selectedDate && isSameDay(day, selectedDate)
        const isToday = isSameDay(day, new Date())
        const isPastDate = isBefore(currentDayStart, todayStart)
        const dayCycleInfo = getCycleInfo(currentDay)

        const appointmentCounts = dayAppts.reduce((counts, appointment) => {
          counts[appointment.appointmentType] = (counts[appointment.appointmentType] || 0) + 1
          return counts
        }, {})

        week.push(
          <div
            key={format(currentDay, 'yyyy-MM-dd')}
            className={`calendar-cell ${isOutsideMonth ? 'disabled' : ''} ${isPastDate && !isOutsideMonth ? 'past-date' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
            onClick={() => !isOutsideMonth && handleCellClick(currentDay, monthStart)}
          >
            <div className="day-header">
              <span className="day-number">{format(day, 'd')}</span>
              {!isOutsideMonth && (
                <span className={`cycle-indicator week-${dayCycleInfo.week}`}>W{dayCycleInfo.week}</span>
              )}
            </div>
            <div className="appointments-container">
              {APPOINTMENT_BADGES.map((badge) => {
                const count = appointmentCounts[badge.type] || 0
                if (!count) return null
                return (
                  <div key={badge.type} className={`apt-count-badge ${badge.className}`}>
                    {badge.label}: {count}
                  </div>
                )
              })}
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

  const selectedDayAppointments = selectedDate ? getAppointmentsForDay(selectedDate) : []

  return (
    <div className="calendar-tab">
      <div className="calendar-section">
        <div className="section-header">
          <div className="header-text">
            <h2>Rehabilitation Schedule</h2>
            <p>View and manage therapy appointments</p>
          </div>
          <div className="cycle-info-badge">
            <span className="cycle-label">Current Cycle:</span>
            <span className="cycle-week">Week {currentCycleInfo.week}</span>
            <span className="cycle-rules">{currentCycleInfo.constraints}</span>
          </div>
        </div>

        <div className="clinician-filter">
          <span className="filter-label">Filter by Clinician:</span>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${selectedClinician === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedClinician('all')}
            >
              All Clinicians
            </button>
            {clinicians.map((clin) => (
              <button
                key={clin.id}
                className={`filter-btn ${selectedClinician === clin.id ? 'active' : ''}`}
                onClick={() => setSelectedClinician(clin.id)}
                style={{
                  '--clinician-color': clin.color,
                }}
              >
                <span className="clinician-dot" style={{ backgroundColor: clin.color }} />
                {clin.name.split(' ').slice(-1)[0]}
              </button>
            ))}
          </div>
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
            {DAY_NAMES.map((d) => (
              <div key={d} className="day-name">
                {d}
              </div>
            ))}
          </div>

          <div className="calendar-body">{renderCalendar()}</div>
        </div>

        <div className="calendar-legend">
          <div className="legend-section">
            <span className="legend-title">Appointment Types:</span>
            <div className="legend-items">
              {APPOINTMENT_LEGEND.map((item) => (
                <span key={item.key} className="legend-item">
                  <span className="apt-type-dot" style={{ backgroundColor: APPOINTMENT_TYPES[item.key].color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="legend-section">
            <span className="legend-title">Cycle Weeks:</span>
            <div className="legend-items">
              {CYCLE_LEGEND.map((item) => (
                <span key={item.week} className="legend-item">
                  <span className={`cycle-dot week-${item.week}`} /> {item.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedDate &&
        createPortal(
          <div className="day-detail-overlay" onClick={() => setSelectedDate(null)}>
            <div className="day-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="detail-modal-header">
                <div className="detail-modal-title">
                  <h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
                  <span className="detail-cycle">Cycle Week {getCycleInfo(selectedDate).week}</span>
                </div>
                <button className="close-modal" onClick={() => setSelectedDate(null)}>
                  ✕
                </button>
              </div>
              <div className="detail-modal-content">
                {selectedDayAppointments.length === 0 ? (
                  <div className="no-appointments">
                    <p>No appointments scheduled for this day</p>
                  </div>
                ) : (
                  <div className="appointments-list">
                    {selectedDayAppointments.map((apt) => {
                      const client = clientById.get(apt.clientId)
                      const clinician = clinicianById.get(apt.clinicianId)
                      const typeInfo = APPOINTMENT_TYPES[apt.appointmentType]

                      return (
                        <div key={apt.id} className="appointment-item">
                          <div className="apt-type-indicator" style={{ backgroundColor: typeInfo?.color }}>
                            {typeInfo?.code}
                          </div>
                          <div className="apt-details">
                            <span className="apt-type-name">{typeInfo?.name}</span>
                            <span className="apt-client">{client?.name || 'Unknown Client'}</span>
                          </div>
                          <div className="apt-clinician">
                            <span className="clinician-color" style={{ backgroundColor: clinician?.color }} />
                            <span className="clinician-name">{clinician?.name || 'Unassigned'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      <div className="deck-section">
        <ClientCardDeck />
      </div>
    </div>
  )
}

export default CalendarTab
