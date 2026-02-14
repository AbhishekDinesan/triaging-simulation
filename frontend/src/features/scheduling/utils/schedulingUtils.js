import { startOfWeek, addDays, isSameWeek, getDay, format } from 'date-fns'

function getCycleReferenceDate() {
  return startOfWeek(new Date(), { weekStartsOn: 0 })
}

export const APPOINTMENT_TYPES = {
  AX: { code: 'AX', name: 'Assessment', color: '#6366f1' },
  SP: { code: 'SP', name: 'Service Planning', color: '#f59e0b' },
  BLOCK: { code: 'BLOCK', name: 'Therapy Block', color: '#10b981' },
}

export const CONSTRAINTS = {
  MAX_APPOINTMENTS_PER_WEEK: 20,
  MAX_APPOINTMENTS_PER_DAY: 4,
  MAX_AX_PER_WEEK_1_2: 3,
  MAX_SP_PER_WEEK_3: 6,
}

export function getCycleWeek(date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 0 })
  const referenceStart = getCycleReferenceDate()

  const diffTime = weekStart.getTime() - referenceStart.getTime()
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000))

  const cyclePosition = ((diffWeeks % 3) + 3) % 3
  return cyclePosition + 1
}

export function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 0 })
}

export function isWeekday(date) {
  const day = getDay(date)
  return day >= 1 && day <= 5
}

export function getWeekdaysInWeek(weekStart) {
  const weekdays = []
  for (let i = 1; i <= 5; i++) {
    weekdays.push(addDays(weekStart, i))
  }
  return weekdays
}

export function countAppointmentsInWeek(appointments, clinicianId, weekStart) {
  return appointments.filter((apt) => {
    if (apt.clinicianId !== clinicianId) return false
    return isSameWeek(new Date(apt.scheduledDate), weekStart, { weekStartsOn: 0 })
  }).length
}

export function countAppointmentsOnDay(appointments, clinicianId, date) {
  const dateStr = format(date, 'yyyy-MM-dd')
  return appointments.filter((apt) => {
    if (apt.clinicianId !== clinicianId) return false
    const aptDateStr = format(new Date(apt.scheduledDate), 'yyyy-MM-dd')
    return aptDateStr === dateStr
  }).length
}

export function countAppointmentTypeInWeek(appointments, clinicianId, weekStart, type) {
  return appointments.filter((apt) => {
    if (apt.clinicianId !== clinicianId) return false
    if (apt.appointmentType !== type) return false
    return isSameWeek(new Date(apt.scheduledDate), weekStart, { weekStartsOn: 0 })
  }).length
}

export function canScheduleAppointment(appointments, clinicianId, date, type) {
  const weekStart = getWeekStart(date)
  const cycleWeek = getCycleWeek(date)

  const dayCount = countAppointmentsOnDay(appointments, clinicianId, date)
  if (dayCount >= CONSTRAINTS.MAX_APPOINTMENTS_PER_DAY) {
    return { allowed: false, reason: 'Daily limit reached (4 appointments)' }
  }

  const weekCount = countAppointmentsInWeek(appointments, clinicianId, weekStart)
  if (weekCount >= CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK) {
    return { allowed: false, reason: 'Weekly limit reached (20 appointments)' }
  }

  if (type === 'AX') {
    if (cycleWeek === 3) {
      return { allowed: false, reason: 'Assessments cannot be scheduled in week 3 of the cycle' }
    }
    const axCount = countAppointmentTypeInWeek(appointments, clinicianId, weekStart, 'AX')
    if (axCount >= CONSTRAINTS.MAX_AX_PER_WEEK_1_2) {
      return { allowed: false, reason: `AX limit reached for week ${cycleWeek} (max 3)` }
    }
  }

  if (type === 'SP') {
    if (cycleWeek !== 3) {
      return { allowed: false, reason: 'Service Planning can only be scheduled in week 3 of the cycle' }
    }
    const spCount = countAppointmentTypeInWeek(appointments, clinicianId, weekStart, 'SP')
    if (spCount >= CONSTRAINTS.MAX_SP_PER_WEEK_3) {
      return { allowed: false, reason: 'SP limit reached for week 3 (max 6)' }
    }
  }

  return { allowed: true }
}

export function findNextAvailableSlot(appointments, clinicianId, startDate, type) {
  let currentDate = startDate
  const maxSearchDays = 90

  for (let i = 0; i < maxSearchDays; i++) {
    if (isWeekday(currentDate)) {
      const result = canScheduleAppointment(appointments, clinicianId, currentDate, type)
      if (result.allowed) {
        return currentDate
      }
    }
    currentDate = addDays(currentDate, 1)
  }

  return null
}

export function scheduleFullTherapyBlock(existingAppointments, clientId, clinicianId, startDate) {
  const appointments = [...existingAppointments]
  const newAppointments = []
  let currentDate = startDate

  const axSlot = findNextAvailableSlot(appointments, clinicianId, currentDate, 'AX')
  if (!axSlot) {
    return { success: false, error: 'Could not find available slot for Assessment (AX)' }
  }

  const axAppointment = {
    id: `${clientId}-AX-${Date.now()}`,
    clientId,
    clinicianId,
    appointmentType: 'AX',
    scheduledDate: axSlot.toISOString(),
    sequence: 1,
  }
  newAppointments.push(axAppointment)
  appointments.push(axAppointment)
  currentDate = addDays(axSlot, 1)

  const spSlot = findNextAvailableSlot(appointments, clinicianId, currentDate, 'SP')
  if (!spSlot) {
    return { success: false, error: 'Could not find available slot for Service Planning (SP)' }
  }

  const spAppointment = {
    id: `${clientId}-SP-${Date.now()}`,
    clientId,
    clinicianId,
    appointmentType: 'SP',
    scheduledDate: spSlot.toISOString(),
    sequence: 2,
  }
  newAppointments.push(spAppointment)
  appointments.push(spAppointment)
  currentDate = addDays(spSlot, 1)

  for (let i = 0; i < 6; i++) {
    const blockSlot = findNextAvailableSlot(appointments, clinicianId, currentDate, 'BLOCK')
    if (!blockSlot) {
      return { success: false, error: `Could not find available slot for Block session ${i + 1}` }
    }

    const blockAppointment = {
      id: `${clientId}-BLOCK-${i + 1}-${Date.now()}`,
      clientId,
      clinicianId,
      appointmentType: 'BLOCK',
      scheduledDate: blockSlot.toISOString(),
      sequence: i + 3,
    }
    newAppointments.push(blockAppointment)
    appointments.push(blockAppointment)
    currentDate = addDays(blockSlot, 1)
  }

  return { success: true, appointments: newAppointments }
}

export function getCycleInfo(date) {
  const cycleWeek = getCycleWeek(date)
  const weekStart = getWeekStart(date)

  let constraints = ''
  if (cycleWeek === 1 || cycleWeek === 2) {
    constraints = 'AX available (max 3/clinician)'
  } else {
    constraints = 'SP available (max 6/clinician)'
  }

  return {
    week: cycleWeek,
    weekStart: format(weekStart, 'MMM d'),
    constraints,
  }
}
