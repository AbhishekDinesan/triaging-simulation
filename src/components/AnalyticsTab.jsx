import { useMemo } from 'react'
import { format, startOfWeek, addWeeks, isSameWeek, addDays, subDays } from 'date-fns'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import { getCycleInfo, CONSTRAINTS } from '../utils/schedulingUtils'
import './AnalyticsTab.css'

const UTILIZATION_LEVELS = [
  { min: 90, label: 'At Capacity', color: '#ef4444' },
  { min: 70, label: 'High', color: '#f59e0b' },
  { min: 40, label: 'Moderate', color: '#10b981' },
  { min: 1, label: 'Low', color: '#6366f1' },
]

const UTILIZATION_LEGEND = [
  { color: '#6366f1', label: 'Low (<40%)' },
  { color: '#10b981', label: 'Moderate (40-70%)' },
  { color: '#f59e0b', label: 'High (70-90%)' },
  { color: '#ef4444', label: 'At Capacity (90%+)' },
]

function getUtilizationInfo(utilization) {
  const level = UTILIZATION_LEVELS.find((item) => utilization >= item.min)
  if (level) return level
  return { label: 'Empty', color: '#6366f1' }
}

function AnalyticsTab() {
  const { simulationSettings } = useSimulationSettings()

  const appointments = simulationSettings?.appointments || []
  const clinicians = simulationSettings?.clinicians || []
  const clientQueue = simulationSettings?.clientQueue || []
  const completedClients = simulationSettings?.completedClients || []

  const numClinicians = clinicians.length || 1
  const maxAppointmentsPerWeek = CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK * numClinicians

  const descriptiveStats = useMemo(() => {
    const terminalStatuses = ['completed', 'no-show']
    const today = new Date()
    const last30Days = subDays(today, 30)
    const allClientMetadata = [...clientQueue, ...completedClients]
    const metadataClientIds = new Set(allClientMetadata.map((client) => client.id))
    const appointmentClientIds = new Set(appointments.map((apt) => apt.clientId))
    const allClientIds = new Set([...metadataClientIds, ...appointmentClientIds])

    const statusBreakdown = {
      booked: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      other: 0,
    }

    const firstVisitByClient = new Map()
    const hasIntakeByClient = new Set()
    const hasPlanningByClient = new Set()
    const visitCountByClient = new Map()
    const terminalVisitCountByClient = new Map()

    appointments.forEach((apt) => {
      const rawStatus = `${apt.status || ''}`.toLowerCase()
      const hasCancelTime = Boolean(apt.cancelDatetime)
      const isCancelled = rawStatus.includes('cancel') || hasCancelTime
      const isCompleted = rawStatus === 'completed'
      const isNoShow = rawStatus === 'no-show' || rawStatus === 'noshow'
      const isBooked = rawStatus === 'booked'

      if (isCancelled) {
        statusBreakdown.cancelled += 1
      } else if (isCompleted) {
        statusBreakdown.completed += 1
      } else if (isNoShow) {
        statusBreakdown.noShow += 1
      } else if (isBooked) {
        statusBreakdown.booked += 1
      } else {
        statusBreakdown.other += 1
      }

      if (apt.clientId) {
        visitCountByClient.set(apt.clientId, (visitCountByClient.get(apt.clientId) || 0) + 1)
        if (isCancelled || terminalStatuses.includes(rawStatus)) {
          terminalVisitCountByClient.set(apt.clientId, (terminalVisitCountByClient.get(apt.clientId) || 0) + 1)
        }
      }

      if (apt.appointmentType === 'AX' && apt.clientId) {
        hasIntakeByClient.add(apt.clientId)
      }
      if (apt.appointmentType === 'SP' && apt.clientId) {
        hasPlanningByClient.add(apt.clientId)
      }

      const rawDate = apt.bookingDatetime || apt.scheduledDate || apt.scheduledStart
      const parsedDate = rawDate ? new Date(rawDate) : null
      if (!apt.clientId || !parsedDate || Number.isNaN(parsedDate.getTime())) return

      const existing = firstVisitByClient.get(apt.clientId)
      if (!existing || parsedDate < existing) {
        firstVisitByClient.set(apt.clientId, parsedDate)
      }
    })

    const newIntakes30Days = [...firstVisitByClient.values()].filter((date) => date >= last30Days).length
    const clientsWithIntake = hasIntakeByClient.size
    const clientsWithPlanning = hasPlanningByClient.size

    const completedFromMetadata = new Set(completedClients.map((client) => client.id))
    const inferredDischarged = new Set()
    for (const [clientId, totalVisits] of visitCountByClient.entries()) {
      const terminalVisits = terminalVisitCountByClient.get(clientId) || 0
      if (totalVisits > 0 && totalVisits === terminalVisits) {
        inferredDischarged.add(clientId)
      }
    }

    const dischargedClients = new Set([...completedFromMetadata, ...inferredDischarged])
    const dischargedCount = dischargedClients.size
    const intakeToDischargeRate = clientsWithIntake > 0 ? (dischargedCount / clientsWithIntake) * 100 : 0
    const planningToDischargeRate = clientsWithPlanning > 0 ? (dischargedCount / clientsWithPlanning) * 100 : 0

    const totalVisits = appointments.length
    const cancellationRate = totalVisits > 0 ? (statusBreakdown.cancelled / totalVisits) * 100 : 0

    return {
      totalClients: allClientIds.size,
      newIntakes30Days,
      clientsWithIntake,
      clientsWithPlanning,
      dischargedCount,
      intakeToDischargeRate,
      planningToDischargeRate,
      cancellationRate,
      statusBreakdown,
      totalVisits,
    }
  }, [appointments, clientQueue, completedClients])

  const weeklyData = useMemo(() => {
    const today = new Date()
    const weeks = []

    for (let i = -4; i <= 8; i++) {
      const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 0 })
      const weekEnd = addDays(weekStart, 6)

      const weekAppointments = appointments.filter((apt) => {
        const aptDate = new Date(apt.scheduledDate)
        return isSameWeek(aptDate, weekStart, { weekStartsOn: 0 })
      })

      const cycleInfo = getCycleInfo(weekStart)
      const utilization = (weekAppointments.length / maxAppointmentsPerWeek) * 100

      const axCount = weekAppointments.filter((a) => a.appointmentType === 'AX').length
      const spCount = weekAppointments.filter((a) => a.appointmentType === 'SP').length
      const blockCount = weekAppointments.filter((a) => a.appointmentType === 'BLOCK').length

      const clinicianCounts = clinicians.map((clin) => ({
        ...clin,
        count: weekAppointments.filter((a) => a.clinicianId === clin.id).length,
      }))

      weeks.push({
        weekStart,
        weekEnd,
        label: format(weekStart, 'MMM d'),
        endLabel: format(weekEnd, 'MMM d'),
        cycleWeek: cycleInfo.week,
        total: weekAppointments.length,
        max: maxAppointmentsPerWeek,
        utilization: Math.min(utilization, 100),
        isCurrent: i === 0,
        isPast: i < 0,
        axCount,
        spCount,
        blockCount,
        clinicianCounts,
      })
    }

    return weeks
  }, [appointments, clinicians, maxAppointmentsPerWeek])

  const overallStats = useMemo(() => {
    const futureWeeks = weeklyData.filter((w) => !w.isPast)
    const totalScheduled = futureWeeks.reduce((sum, w) => sum + w.total, 0)
    const totalCapacity = futureWeeks.length * maxAppointmentsPerWeek
    const avgUtilization = totalCapacity > 0 ? (totalScheduled / totalCapacity) * 100 : 0

    const peakWeek = weeklyData.reduce((max, w) => (w.utilization > max.utilization ? w : max), weeklyData[0])

    return {
      totalScheduled,
      totalCapacity,
      avgUtilization,
      peakWeek,
    }
  }, [weeklyData, maxAppointmentsPerWeek])

  const descriptiveCards = [
    {
      value: descriptiveStats.newIntakes30Days,
      label: 'New Intakes (30d)',
      sublabel: 'By first observed visit date',
      isHighlight: true,
    },
    {
      value: `${descriptiveStats.intakeToDischargeRate.toFixed(1)}%`,
      label: 'Intake → Discharge',
      sublabel: `${descriptiveStats.dischargedCount} discharged / ${descriptiveStats.clientsWithIntake} intakes`,
    },
    {
      value: `${descriptiveStats.cancellationRate.toFixed(1)}%`,
      label: 'Cancellation Rate',
      sublabel: `${descriptiveStats.statusBreakdown.cancelled} cancelled / ${descriptiveStats.totalVisits} visits`,
    },
    {
      value: descriptiveStats.totalClients,
      label: 'Total Clients',
      sublabel: 'Across metadata + visits',
    },
  ]

  const summaryCards = [
    {
      value: `${overallStats.avgUtilization.toFixed(1)}%`,
      label: 'Avg Utilization',
      sublabel: 'Upcoming weeks',
      isHighlight: true,
    },
    {
      value: overallStats.totalScheduled,
      label: 'Scheduled',
      sublabel: `of ${overallStats.totalCapacity} slots`,
    },
    {
      value: `${overallStats.peakWeek?.utilization.toFixed(0)}%`,
      label: 'Peak Week',
      sublabel: overallStats.peakWeek?.label,
    },
    {
      value: numClinicians,
      label: 'Clinicians',
      sublabel: 'Active',
    },
  ]

  const currentWeek = weeklyData.find((w) => w.isCurrent)

  return (
    <div className="analytics-tab">
      <div className="analytics-header">
        <div className="header-text">
          <h2>Clinic Analytics</h2>
          <p>Surface stress signals first, then investigate bottlenecks with descriptive analytics</p>
        </div>
        <div className="capacity-badge">
          <span className="capacity-label">Weekly Capacity</span>
          <span className="capacity-value">{maxAppointmentsPerWeek} slots</span>
          <span className="capacity-detail">
            ({CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK} × {numClinicians} clinicians)
          </span>
        </div>
      </div>

      <div className="descriptive-section">
        <div className="section-title">
          <h3>Descriptive Metrics</h3>
          <span className="section-subtitle">Visit + client metadata only (first-pass analytics)</span>
        </div>

        <div className="stats-grid">
          {descriptiveCards.map((card) => (
            <div key={card.label} className={`stat-card ${card.isHighlight ? 'highlight' : ''}`.trim()}>
              <div className="stat-content">
                <span className="stat-value">{card.value}</span>
                <span className="stat-label">{card.label}</span>
                <span className="stat-sublabel">{card.sublabel}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flow-grid">
          <div className="flow-card">
            <span className="flow-stage">Intake (AX)</span>
            <span className="flow-value">{descriptiveStats.clientsWithIntake}</span>
            <span className="flow-note">Clients with at least one AX visit</span>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-card">
            <span className="flow-stage">Planning (SP)</span>
            <span className="flow-value">{descriptiveStats.clientsWithPlanning}</span>
            <span className="flow-note">Clients with at least one SP visit</span>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-card">
            <span className="flow-stage">Discharged</span>
            <span className="flow-value">{descriptiveStats.dischargedCount}</span>
            <span className="flow-note">{descriptiveStats.planningToDischargeRate.toFixed(1)}% of planning stage</span>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className={`stat-card ${card.isHighlight ? 'highlight' : ''}`.trim()}>
            <div className="stat-content">
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
              <span className="stat-sublabel">{card.sublabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="chart-section">
        <div className="section-title">
          <h3>Weekly Utilization</h3>
          <span className="section-subtitle">Appointments per week vs. capacity</span>
        </div>

        <div className="utilization-chart">
          {weeklyData.map((week) => {
            const utilizationInfo = getUtilizationInfo(week.utilization)
            return (
              <div
                key={week.weekStart.toISOString()}
                className={`week-bar-container ${week.isCurrent ? 'current' : ''} ${week.isPast ? 'past' : ''}`}
              >
                <div className="week-bar-wrapper">
                  <div
                    className="week-bar"
                    style={{
                      height: `${Math.max(week.utilization, 2)}%`,
                      backgroundColor: utilizationInfo.color,
                    }}
                  >
                    <span className="bar-value">{week.total}</span>
                  </div>
                  <div className="bar-max-line" />
                </div>
                <div className="week-label">
                  <span className="week-date">{week.label}</span>
                  <span className={`cycle-tag week-${week.cycleWeek}`}>W{week.cycleWeek}</span>
                </div>
                {week.isCurrent && <div className="current-indicator">Now</div>}
              </div>
            )
          })}
        </div>

        <div className="chart-legend">
          {UTILIZATION_LEGEND.map((item) => (
            <div key={item.label} className="legend-item">
              <span className="legend-color" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="breakdown-section">
        <div className="section-title">
          <h3>Weekly Breakdown</h3>
          <span className="section-subtitle">Detailed view by week</span>
        </div>

        <div className="weeks-table">
          <div className="table-header">
            <span className="col-week">Week</span>
            <span className="col-cycle">Cycle</span>
            <span className="col-types">By Type</span>
            <span className="col-utilization">Utilization</span>
            <span className="col-bar">Capacity</span>
          </div>

          {weeklyData.map((week) => {
            const utilizationInfo = getUtilizationInfo(week.utilization)
            return (
              <div
                key={week.weekStart.toISOString()}
                className={`table-row ${week.isCurrent ? 'current' : ''} ${week.isPast ? 'past' : ''}`}
              >
                <div className="col-week">
                  <span className="week-range">
                    {week.label} - {week.endLabel}
                  </span>
                  {week.isCurrent && <span className="current-badge">Current</span>}
                </div>

                <div className="col-cycle">
                  <span className={`cycle-badge week-${week.cycleWeek}`}>Week {week.cycleWeek}</span>
                </div>

                <div className="col-types">
                  <span className="type-pill ax" title="Assessments">
                    AX: {week.axCount}
                  </span>
                  <span className="type-pill sp" title="Service Planning">
                    SP: {week.spCount}
                  </span>
                  <span className="type-pill block" title="Therapy Blocks">
                    BLK: {week.blockCount}
                  </span>
                </div>

                <div className="col-utilization">
                  <span className="utilization-value" style={{ color: utilizationInfo.color }}>
                    {week.utilization.toFixed(0)}%
                  </span>
                  <span className="utilization-label">{utilizationInfo.label}</span>
                </div>

                <div className="col-bar">
                  <div className="mini-bar-bg">
                    <div
                      className="mini-bar-fill"
                      style={{
                        width: `${week.utilization}%`,
                        backgroundColor: utilizationInfo.color,
                      }}
                    />
                  </div>
                  <span className="mini-bar-text">
                    {week.total}/{week.max}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {clinicians.length > 0 && (
        <div className="clinician-section">
          <div className="section-title">
            <h3>Clinician Workload</h3>
            <span className="section-subtitle">Current week distribution</span>
          </div>

          <div className="clinician-grid">
            {currentWeek?.clinicianCounts.map((clin) => {
              const clinUtilization = (clin.count / CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK) * 100
              return (
                <div key={clin.id} className="clinician-card">
                  <div className="clinician-header">
                    <span className="clinician-dot" style={{ backgroundColor: clin.color }} />
                    <span className="clinician-name">{clin.name}</span>
                  </div>
                  <div className="clinician-stats">
                    <span className="clinician-count">{clin.count}</span>
                    <span className="clinician-max">/ {CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK}</span>
                  </div>
                  <div className="clinician-bar-bg">
                    <div
                      className="clinician-bar-fill"
                      style={{
                        width: `${clinUtilization}%`,
                        backgroundColor: clin.color,
                      }}
                    />
                  </div>
                  <span className="clinician-percent">{clinUtilization.toFixed(0)}% utilized</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsTab
