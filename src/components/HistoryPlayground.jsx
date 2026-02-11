import { useState, useMemo, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { useSimulationSettings } from '../context/SimulationSettingsContext'
import { APPOINTMENT_TYPES, CONSTRAINTS } from '../utils/schedulingUtils'
import './HistoryPlayground.css'

const CODE_SNIPPETS = [
  {
    label: 'Appointments per clinician',
    code: `// Count appointments per clinician
const counts = {};
appointments.forEach(apt => {
  const id = apt.clinicianId || 'Unknown';
  counts[id] = (counts[id] || 0) + 1;
});
return counts;`,
  },
  {
    label: 'Cancellation rate',
    code: `// Calculate cancellation rate
const total = appointments.length;
const cancelled = appointments.filter(a => {
  const s = (a.status || '').toLowerCase();
  return s.includes('cancel') || Boolean(a.cancelDatetime);
}).length;
return {
  total,
  cancelled,
  rate: total ? (cancelled / total * 100).toFixed(1) + '%' : 'N/A'
};`,
  },
  {
    label: 'Avg visits per client',
    code: `// Average number of visits per client
const byClient = {};
appointments.forEach(a => {
  byClient[a.clientId] = (byClient[a.clientId] || 0) + 1;
});
const clientIds = Object.keys(byClient);
const avg = clientIds.length
  ? (appointments.length / clientIds.length).toFixed(2)
  : 0;
return { totalVisits: appointments.length, uniqueClients: clientIds.length, avgVisitsPerClient: avg };`,
  },
  {
    label: 'Appointments by type',
    code: `// Count appointments by type
const byType = {};
appointments.forEach(a => {
  const t = a.appointmentType || 'Unknown';
  byType[t] = (byType[t] || 0) + 1;
});
return byType;`,
  },
  {
    label: 'Busiest day of the week',
    code: `// Find the busiest day of the week
const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dayCounts = [0,0,0,0,0,0,0];
appointments.forEach(a => {
  const d = new Date(a.scheduledDate || a.scheduledStart);
  if (!isNaN(d)) dayCounts[d.getDay()]++;
});
const result = dayNames.map((name, i) => ({ day: name, count: dayCounts[i] }));
result.sort((a, b) => b.count - a.count);
return result;`,
  },
  {
    label: 'Client wait times (booking → scheduled)',
    code: `// Calculate days between booking and scheduled date per client
const waits = [];
appointments.forEach(a => {
  const booked = new Date(a.bookingDatetime);
  const scheduled = new Date(a.scheduledDate || a.scheduledStart);
  if (isNaN(booked) || isNaN(scheduled)) return;
  const days = Math.round((scheduled - booked) / 86400000);
  waits.push({ clientId: a.clientId, type: a.appointmentType, waitDays: days });
});
const avg = waits.length
  ? (waits.reduce((s, w) => s + w.waitDays, 0) / waits.length).toFixed(1)
  : 'N/A';
return { averageWaitDays: avg, sampleRecords: waits.slice(0, 10) };`,
  },
]

function runUserCode(code, appointments, clients, clinicians) {
  try {
    const fn = new Function(
      'appointments',
      'clients',
      'clinicians',
      'CONSTRAINTS',
      `"use strict";
${code}`
    )
    const result = fn(appointments, clients, clinicians, CONSTRAINTS)
    return { ok: true, value: result }
  } catch (err) {
    return { ok: false, error: err.message }
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

  const [code, setCode] = useState(CODE_SNIPPETS[0].code)
  const [output, setOutput] = useState(null)
  const [outputError, setOutputError] = useState(null)
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

  const handleRun = useCallback(() => {
    const result = runUserCode(code, appointments, allClients, clinicians)
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
      handleRun()
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

  return (
    <div className="history-playground">
      <div className="hp-header">
        <div className="hp-header-text">
          <h2>Historical Data &amp; Playground</h2>
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
                Write JavaScript to analyze scheduling data. Available variables: <code>appointments</code>,{' '}
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
                <button className="hp-run-btn" onClick={handleRun}>
                  ▶ Run <span className="hp-run-shortcut">Ctrl+Enter</span>
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
