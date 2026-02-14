import { useState, useMemo, useCallback, useRef } from 'react'
import { format, startOfWeek, startOfMonth } from 'date-fns'
import { useSimulationSettings } from '../../simulation/SimulationSettingsContext'
import { APPOINTMENT_TYPES, CONSTRAINTS } from '../utils/schedulingUtils'
import './HistoryPlayground.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const CODE_SNIPPETS = [
  {
    label: 'Appointments per clinician',
    code: `# Count appointments per clinician
counts = {}
for apt in appointments:
    clinician_id = apt.get("clinicianId") or "Unknown"
    counts[clinician_id] = counts.get(clinician_id, 0) + 1

result = counts`,
  },
  {
    label: 'Cancellation rate',
    code: `# Calculate cancellation rate
total = len(appointments)
cancelled = 0
for apt in appointments:
    status = (apt.get("status") or "").lower()
    if "cancel" in status or bool(apt.get("cancelDatetime")):
        cancelled += 1

result = {
    "total": total,
    "cancelled": cancelled,
    "rate": (f"{(cancelled / total) * 100:.1f}%" if total else "N/A"),
}`,
  },
  {
    label: 'Avg visits per client',
    code: `# Average number of visits per client
by_client = {}
for apt in appointments:
    client_id = apt.get("clientId")
    by_client[client_id] = by_client.get(client_id, 0) + 1

unique_clients = len(by_client)
avg_visits = round(len(appointments) / unique_clients, 2) if unique_clients else 0

result = {
    "totalVisits": len(appointments),
    "uniqueClients": unique_clients,
    "avgVisitsPerClient": avg_visits,
}`,
  },
  {
    label: 'Appointments by type',
    code: `# Count appointments by type
by_type = {}
for apt in appointments:
    apt_type = apt.get("appointmentType") or "Unknown"
    by_type[apt_type] = by_type.get(apt_type, 0) + 1

result = by_type`,
  },
  {
    label: 'Busiest day of the week',
    code: `# Find the busiest day of the week
from datetime import datetime

day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
day_counts = {name: 0 for name in day_names}

for apt in appointments:
    raw = apt.get("scheduledDate") or apt.get("scheduledStart")
    if not raw:
        continue
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        continue
    day_counts[day_names[dt.weekday()]] += 1

result = sorted(
    [{"day": day, "count": count} for day, count in day_counts.items()],
    key=lambda x: x["count"],
    reverse=True,
)`,
  },
  {
    label: 'Client wait times (booking → scheduled)',
    code: `# Calculate days between booking and scheduled date per client
from datetime import datetime

waits = []
for apt in appointments:
    booked_raw = apt.get("bookingDatetime")
    scheduled_raw = apt.get("scheduledDate") or apt.get("scheduledStart")
    if not booked_raw or not scheduled_raw:
        continue
    try:
        booked = datetime.fromisoformat(booked_raw.replace("Z", "+00:00"))
        scheduled = datetime.fromisoformat(scheduled_raw.replace("Z", "+00:00"))
    except Exception:
        continue
    wait_days = (scheduled - booked).days
    waits.append({
        "clientId": apt.get("clientId"),
        "type": apt.get("appointmentType"),
        "waitDays": wait_days,
    })

average_wait = round(sum(item["waitDays"] for item in waits) / len(waits), 1) if waits else "N/A"
result = {"averageWaitDays": average_wait, "sampleRecords": waits[:10]}`,
  },
]

async function runUserCode(code, appointments, clients, clinicians) {
  try {
    const response = await fetch(`${API_BASE}/sandbox/history/python`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        appointments,
        clients,
        clinicians,
        constraints: CONSTRAINTS,
      }),
    })

    if (!response.ok) {
      return { ok: false, error: `Request failed (${response.status})` }
    }

    const payload = await response.json()
    if (!payload.ok) {
      return { ok: false, error: payload.error || 'Python execution failed.' }
    }
    return { ok: true, value: payload.value }
  } catch (err) {
    return { ok: false, error: err.message || 'Python execution failed.' }
  }
}

function statusColor(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('cancel')) return '#ef4444'
  if (s === 'completed') return '#10b981'
  if (s === 'no-show' || s === 'noshow') return '#f59e0b'
  if (s === 'booked') return '#6366f1'
  return '#64748b'
}

function typeColor(type) {
  return APPOINTMENT_TYPES[type]?.color || '#64748b'
}

function isCancelledStatus(status, cancelDatetime) {
  const normalizedStatus = (status || '').toLowerCase()
  return normalizedStatus.includes('cancel') || Boolean(cancelDatetime)
}

function getLeadDays(row) {
  if (!row.bookedDateParsed || !row.scheduledDateParsed) return null
  if (Number.isNaN(row.bookedDateParsed) || Number.isNaN(row.scheduledDateParsed)) return null
  const diffMs = row.scheduledDateParsed.getTime() - row.bookedDateParsed.getTime()
  if (diffMs < 0) return null
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

function HistoryPlayground() {
  const { simulationSettings } = useSimulationSettings()

  const appointments = simulationSettings?.appointments || []
  const clinicians = simulationSettings?.clinicians || []
  const clientQueue = simulationSettings?.clientQueue || []
  const completedClients = simulationSettings?.completedClients || []
  const allClients = useMemo(() => [...clientQueue, ...completedClients], [clientQueue, completedClients])

  const [sortField, setSortField] = useState('scheduledDate')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterClinician, setFilterClinician] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [trendGranularity, setTrendGranularity] = useState('week')
  const [prescriptiveThresholdWeeks, setPrescriptiveThresholdWeeks] = useState(4)

  const [code, setCode] = useState(CODE_SNIPPETS[0].code)
  const [output, setOutput] = useState(null)
  const [outputError, setOutputError] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const textareaRef = useRef(null)

  const [activeSection, setActiveSection] = useState('timeline') // 'timeline' | 'playground'

  const historyRows = useMemo(() => {
    let rows = appointments.map((apt) => {
      const client = allClients.find((c) => c.id === apt.clientId)
      const clinician = clinicians.find((c) => c.id === apt.clinicianId)
      const scheduledRaw = apt.scheduledDate || apt.scheduledStart
      const bookedRaw = apt.bookingDatetime
      return {
        ...apt,
        clientName: client?.name || apt.clientId || '—',
        clinicianName: clinician?.name || apt.clinicianId || '—',
        clinicianColor: clinician?.color || '#64748b',
        scheduledDateParsed: scheduledRaw ? new Date(scheduledRaw) : null,
        bookedDateParsed: bookedRaw ? new Date(bookedRaw) : null,
      }
    })

    if (filterType !== 'all') {
      rows = rows.filter((r) => r.appointmentType === filterType)
    }
    if (filterClinician !== 'all') {
      rows = rows.filter((r) => r.clinicianId === filterClinician)
    }
    if (filterStatus !== 'all') {
      rows = rows.filter((r) => {
        const s = (r.status || '').toLowerCase()
        if (filterStatus === 'cancelled') return s.includes('cancel') || Boolean(r.cancelDatetime)
        if (filterStatus === 'noshow') return s === 'no-show' || s === 'noshow'
        return s === filterStatus
      })
    }

    rows.sort((a, b) => {
      let va, vb
      if (sortField === 'scheduledDate') {
        va = a.scheduledDateParsed?.getTime() || 0
        vb = b.scheduledDateParsed?.getTime() || 0
      } else if (sortField === 'bookedDate') {
        va = a.bookedDateParsed?.getTime() || 0
        vb = b.bookedDateParsed?.getTime() || 0
      } else if (sortField === 'client') {
        va = a.clientName.toLowerCase()
        vb = b.clientName.toLowerCase()
      } else if (sortField === 'clinician') {
        va = a.clinicianName.toLowerCase()
        vb = b.clinicianName.toLowerCase()
      } else if (sortField === 'type') {
        va = a.appointmentType || ''
        vb = b.appointmentType || ''
      } else {
        va = a[sortField] || ''
        vb = b[sortField] || ''
      }
      if (va < vb) return sortAsc ? -1 : 1
      if (va > vb) return sortAsc ? 1 : -1
      return 0
    })

    return rows
  }, [appointments, allClients, clinicians, filterType, filterClinician, filterStatus, sortField, sortAsc])

  function handleSort(field) {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  function sortIndicator(field) {
    if (sortField !== field) return ''
    return sortAsc ? ' ▲' : ' ▼'
  }

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    const result = await runUserCode(code, appointments, allClients, clinicians)
    setIsRunning(false)
    if (result.ok) {
      setOutput(result.value)
      setOutputError(null)
    } else {
      setOutput(null)
      setOutputError(result.error)
    }
  }, [code, appointments, allClients, clinicians])

  function handleKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newCode = code.substring(0, start) + '  ' + code.substring(end)
      setCode(newCode)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void handleRun()
    }
  }

  function renderOutput() {
    if (outputError) {
      return <div className="playground-error">{outputError}</div>
    }
    if (output === null || output === undefined) {
      return (
        <div className="playground-placeholder">Click &ldquo;Run&rdquo; or press Ctrl+Enter to execute your code.</div>
      )
    }
    if (typeof output === 'object') {
      return <pre className="playground-result">{JSON.stringify(output, null, 2)}</pre>
    }
    return <pre className="playground-result">{String(output)}</pre>
  }

  const statusCounts = useMemo(() => {
    const counts = { booked: 0, completed: 0, cancelled: 0, noShow: 0 }
    appointments.forEach((a) => {
      const s = (a.status || '').toLowerCase()
      const hasCancelTime = Boolean(a.cancelDatetime)
      if (s.includes('cancel') || hasCancelTime) counts.cancelled++
      else if (s === 'completed') counts.completed++
      else if (s === 'no-show' || s === 'noshow') counts.noShow++
      else counts.booked++
    })
    return counts
  }, [appointments])

  const trendSeries = useMemo(() => {
    const grouped = new Map()

    historyRows.forEach((row) => {
      const scheduledDate = row.scheduledDateParsed
      if (!scheduledDate || Number.isNaN(scheduledDate)) return

      const periodStart =
        trendGranularity === 'month' ? startOfMonth(scheduledDate) : startOfWeek(scheduledDate, { weekStartsOn: 0 })
      const periodKey = format(periodStart, 'yyyy-MM-dd')
      const current = grouped.get(periodKey) || {
        key: periodKey,
        periodStart,
        label: trendGranularity === 'month' ? format(periodStart, 'MMM yyyy') : format(periodStart, 'MMM d'),
        cancelled: 0,
        total: 0,
      }

      current.total += 1
      if (isCancelledStatus(row.status, row.cancelDatetime)) current.cancelled += 1
      grouped.set(periodKey, current)
    })

    return [...grouped.values()]
      .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())
      .map((item) => ({
        ...item,
        cancellationRate: item.total > 0 ? (item.cancelled / item.total) * 100 : 0,
      }))
  }, [historyRows, trendGranularity])

  const prescriptiveStats = useMemo(() => {
    const thresholdDays = prescriptiveThresholdWeeks * 7
    const leadRows = historyRows
      .map((row) => {
        const leadDays = getLeadDays(row)
        if (leadDays === null) return null
        return { leadDays, cancelled: isCancelledStatus(row.status, row.cancelDatetime) }
      })
      .filter(Boolean)

    const longLead = leadRows.filter((row) => row.leadDays >= thresholdDays)
    const shortLead = leadRows.filter((row) => row.leadDays < thresholdDays)

    const longCancelled = longLead.filter((row) => row.cancelled).length
    const shortCancelled = shortLead.filter((row) => row.cancelled).length

    const longRate = longLead.length ? (longCancelled / longLead.length) * 100 : 0
    const shortRate = shortLead.length ? (shortCancelled / shortLead.length) * 100 : 0
    const relativeLift = shortRate > 0 ? ((longRate - shortRate) / shortRate) * 100 : null

    const expectedLongCancelledAtShortRate = (shortRate / 100) * longLead.length
    const avoidableCancellations = Math.max(0, longCancelled - expectedLongCancelledAtShortRate)

    return {
      thresholdDays,
      sampleSize: leadRows.length,
      longLeadCount: longLead.length,
      shortLeadCount: shortLead.length,
      longRate,
      shortRate,
      relativeLift,
      avoidableCancellations,
    }
  }, [historyRows, prescriptiveThresholdWeeks])

  return (
    <div className="history-playground">
      <div className="hp-header">
        <div className="hp-header-text">
          <h2>Historical Data</h2>
          <p>Explore past scheduling records and write code to analyze the data</p>
        </div>
        <div className="hp-section-toggle">
          <button
            className={`hp-toggle-btn ${activeSection === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveSection('timeline')}
          >
            Timeline
          </button>
          <button
            className={`hp-toggle-btn ${activeSection === 'playground' ? 'active' : ''}`}
            onClick={() => setActiveSection('playground')}
          >
            Code Playground
          </button>
        </div>
      </div>

      <div className="hp-summary-row">
        <div className="hp-summary-card">
          <span className="hp-sum-value">{appointments.length}</span>
          <span className="hp-sum-label">Total Records</span>
        </div>
        <div className="hp-summary-card">
          <span className="hp-sum-value" style={{ color: '#6366f1' }}>
            {statusCounts.booked}
          </span>
          <span className="hp-sum-label">Booked</span>
        </div>
        <div className="hp-summary-card">
          <span className="hp-sum-value" style={{ color: '#10b981' }}>
            {statusCounts.completed}
          </span>
          <span className="hp-sum-label">Completed</span>
        </div>
        <div className="hp-summary-card">
          <span className="hp-sum-value" style={{ color: '#ef4444' }}>
            {statusCounts.cancelled}
          </span>
          <span className="hp-sum-label">Cancelled</span>
        </div>
        <div className="hp-summary-card">
          <span className="hp-sum-value" style={{ color: '#f59e0b' }}>
            {statusCounts.noShow}
          </span>
          <span className="hp-sum-label">No-Show</span>
        </div>
      </div>

      {activeSection === 'timeline' && (
        <div className="hp-timeline-section">
          <div className="hp-filters">
            <div className="hp-filter-group">
              <label>Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                <option value="AX">Assessment (AX)</option>
                <option value="SP">Service Planning (SP)</option>
                <option value="BLOCK">Therapy Block</option>
              </select>
            </div>
            <div className="hp-filter-group">
              <label>Clinician</label>
              <select value={filterClinician} onChange={(e) => setFilterClinician(e.target.value)}>
                <option value="all">All Clinicians</option>
                {clinicians.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="hp-filter-group">
              <label>Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="booked">Booked</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="noshow">No-Show</option>
              </select>
            </div>
            <div className="hp-filter-count">
              {historyRows.length} record{historyRows.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="hp-insight-grid">
            <section className="hp-insight-card">
              <div className="hp-insight-header">
                <h3>Trend Analysis</h3>
                <select
                  className="hp-insight-select"
                  value={trendGranularity}
                  onChange={(event) => setTrendGranularity(event.target.value)}
                >
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </div>
              <p className="hp-insight-subtitle">Cancellation rate over time for the current filtered dataset</p>
              <div className="hp-trend-chart">
                {trendSeries.length === 0 && <div className="hp-chart-empty">No valid dates in current filter.</div>}
                {trendSeries.map((point) => (
                  <div key={point.key} className="hp-trend-point">
                    <div className="hp-trend-bar-wrap">
                      <div className="hp-trend-bar" style={{ height: `${Math.max(point.cancellationRate, 2)}%` }}>
                        <span className="hp-trend-bar-label">{point.cancellationRate.toFixed(0)}%</span>
                      </div>
                    </div>
                    <span className="hp-trend-label">{point.label}</span>
                    <span className="hp-trend-count">
                      {point.cancelled}/{point.total}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="hp-insight-card">
              <div className="hp-insight-header">
                <h3>Prescriptive Analysis</h3>
                <span className="hp-insight-pill">Lead-Time Risk</span>
              </div>
              <p className="hp-insight-subtitle">
                Compare cancellation risk for appointments booked farther in advance
              </p>
              <label htmlFor="prescriptive-threshold" className="hp-threshold-label">
                Threshold: {prescriptiveThresholdWeeks} weeks ({prescriptiveStats.thresholdDays} days)
              </label>
              <input
                id="prescriptive-threshold"
                className="hp-threshold-slider"
                type="range"
                min="1"
                max="8"
                step="1"
                value={prescriptiveThresholdWeeks}
                onChange={(event) => setPrescriptiveThresholdWeeks(Number(event.target.value))}
              />
              <div className="hp-prescriptive-bars">
                <div className="hp-prescriptive-bar-row">
                  <span className="hp-prescriptive-label">{prescriptiveThresholdWeeks}+ weeks</span>
                  <div className="hp-prescriptive-bar-bg">
                    <div
                      className="hp-prescriptive-bar-fill long"
                      style={{ width: `${Math.min(prescriptiveStats.longRate, 100)}%` }}
                    />
                  </div>
                  <span className="hp-prescriptive-value">{prescriptiveStats.longRate.toFixed(1)}%</span>
                </div>
                <div className="hp-prescriptive-bar-row">
                  <span className="hp-prescriptive-label">Under {prescriptiveThresholdWeeks} weeks</span>
                  <div className="hp-prescriptive-bar-bg">
                    <div
                      className="hp-prescriptive-bar-fill short"
                      style={{ width: `${Math.min(prescriptiveStats.shortRate, 100)}%` }}
                    />
                  </div>
                  <span className="hp-prescriptive-value">{prescriptiveStats.shortRate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="hp-prescriptive-callout">
                <strong>Suggested intervention:</strong>{' '}
                {prescriptiveStats.relativeLift === null
                  ? 'Not enough data to compare risk groups yet.'
                  : `${prescriptiveStats.relativeLift.toFixed(1)}% higher cancellation risk for long-lead bookings. `}
                {prescriptiveStats.sampleSize > 0 &&
                  `Estimated avoidable cancellations at this threshold: ${prescriptiveStats.avoidableCancellations.toFixed(1)}.`}
              </div>
            </section>
          </div>

          <div className="hp-table-wrapper">
            <table className="hp-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('scheduledDate')} className="sortable">
                    Scheduled{sortIndicator('scheduledDate')}
                  </th>
                  <th onClick={() => handleSort('bookedDate')} className="sortable">
                    Booked{sortIndicator('bookedDate')}
                  </th>
                  <th onClick={() => handleSort('client')} className="sortable">
                    Client{sortIndicator('client')}
                  </th>
                  <th onClick={() => handleSort('clinician')} className="sortable">
                    Clinician{sortIndicator('clinician')}
                  </th>
                  <th onClick={() => handleSort('type')} className="sortable">
                    Type{sortIndicator('type')}
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="hp-empty">
                      No records match the current filters.
                    </td>
                  </tr>
                )}
                {historyRows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td>
                      {row.scheduledDateParsed && !isNaN(row.scheduledDateParsed)
                        ? format(row.scheduledDateParsed, 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td>
                      {row.bookedDateParsed && !isNaN(row.bookedDateParsed)
                        ? format(row.bookedDateParsed, 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td>{row.clientName}</td>
                    <td>
                      <span className="hp-clinician-cell">
                        <span className="hp-clinician-dot" style={{ backgroundColor: row.clinicianColor }} />
                        {row.clinicianName}
                      </span>
                    </td>
                    <td>
                      <span className="hp-type-badge" style={{ backgroundColor: typeColor(row.appointmentType) }}>
                        {row.appointmentType || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="hp-status-badge" style={{ color: statusColor(row.status) }}>
                        {row.status || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'playground' && (
        <div className="hp-playground-section">
          <div className="hp-pg-header">
            <div>
              <h3>Code Playground</h3>
              <p>
                Write Python to analyze scheduling data. Available variables: <code>appointments</code>,{' '}
                <code>clients</code>, <code>clinicians</code>, <code>CONSTRAINTS</code>.
              </p>
            </div>
          </div>

          <div className="hp-snippet-bar">
            <span className="hp-snippet-label">Starter snippets:</span>
            <div className="hp-snippet-list">
              {CODE_SNIPPETS.map((snippet) => (
                <button
                  key={snippet.label}
                  className="hp-snippet-btn"
                  onClick={() => {
                    setCode(snippet.code)
                    setOutput(null)
                    setOutputError(null)
                  }}
                >
                  {snippet.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hp-pg-layout">
            <div className="hp-pg-editor-pane">
              <div className="hp-pg-editor-header">
                <span>Editor</span>
                <button className="hp-run-btn" onClick={() => void handleRun()} disabled={isRunning}>
                  {isRunning ? 'Running...' : '▶ Run'} <span className="hp-run-shortcut">Ctrl+Enter</span>
                </button>
              </div>
              <textarea
                ref={textareaRef}
                className="hp-code-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div className="hp-pg-output-pane">
              <div className="hp-pg-output-header">Output</div>
              <div className="hp-pg-output-body">{renderOutput()}</div>
            </div>
          </div>

          <details className="hp-data-reference">
            <summary>Data Reference — click to see available fields</summary>
            <div className="hp-ref-grid">
              <div className="hp-ref-card">
                <h4>appointments[]</h4>
                <ul>
                  <li>
                    <code>id</code> — unique visit id
                  </li>
                  <li>
                    <code>clientId</code>
                  </li>
                  <li>
                    <code>clinicianId</code>
                  </li>
                  <li>
                    <code>appointmentType</code> — AX | SP | BLOCK
                  </li>
                  <li>
                    <code>scheduledDate</code> — ISO string
                  </li>
                  <li>
                    <code>bookingDatetime</code> — ISO string
                  </li>
                  <li>
                    <code>status</code> — Booked | Completed | Cancelled | No-Show
                  </li>
                  <li>
                    <code>cancelDatetime</code> — ISO string (if cancelled)
                  </li>
                </ul>
              </div>
              <div className="hp-ref-card">
                <h4>clients[]</h4>
                <ul>
                  <li>
                    <code>id</code>
                  </li>
                  <li>
                    <code>name</code>
                  </li>
                  <li>
                    <code>priority</code> — high | medium | low
                  </li>
                  <li>
                    <code>status</code> — pending | active | completed
                  </li>
                  <li>
                    <code>diagnosis</code>
                  </li>
                  <li>
                    <code>referralNotes</code>
                  </li>
                </ul>
              </div>
              <div className="hp-ref-card">
                <h4>clinicians[]</h4>
                <ul>
                  <li>
                    <code>id</code>
                  </li>
                  <li>
                    <code>name</code>
                  </li>
                  <li>
                    <code>color</code>
                  </li>
                </ul>
              </div>
              <div className="hp-ref-card">
                <h4>CONSTRAINTS</h4>
                <ul>
                  <li>
                    <code>MAX_APPOINTMENTS_PER_WEEK</code> — {CONSTRAINTS.MAX_APPOINTMENTS_PER_WEEK}
                  </li>
                  <li>
                    <code>MAX_APPOINTMENTS_PER_DAY</code> — {CONSTRAINTS.MAX_APPOINTMENTS_PER_DAY}
                  </li>
                  <li>
                    <code>MAX_AX_PER_WEEK_1_2</code> — {CONSTRAINTS.MAX_AX_PER_WEEK_1_2}
                  </li>
                  <li>
                    <code>MAX_SP_PER_WEEK_3</code> — {CONSTRAINTS.MAX_SP_PER_WEEK_3}
                  </li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

export default HistoryPlayground
