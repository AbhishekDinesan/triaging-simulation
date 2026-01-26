import './PatientCardDeck.css'

const URGENCY = {
  high: { label: 'Urgent', icon: '🔴' },
  medium: { label: 'Moderate', icon: '🟡' },
  low: { label: 'Routine', icon: '🟢' },
}

function PatientCardDeck({ patients, activePatientCard, setActivePatientCard, selectedDate, onSchedule }) {
  return (
    <div className="patient-deck">
      <div className="deck-header">
        <div>
          <h3>🃏 Patient Queue</h3>
          <p>{patients.length} patients awaiting scheduling</p>
        </div>
      </div>

      {activePatientCard && (
        <div className="scheduling-hint">
          {selectedDate ? 'Click a date to schedule' : 'Select a date on the calendar'}
        </div>
      )}

      <div className="cards-container">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className={`patient-card urgency-${patient.urgency} ${activePatientCard === patient.id ? 'active' : ''}`}
            onClick={() => setActivePatientCard(activePatientCard === patient.id ? null : patient.id)}
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
                {URGENCY[patient.urgency]?.icon} {URGENCY[patient.urgency]?.label}
              </div>
            </div>

            <div className="card-body">
              <div>
                <span className="label">Condition:</span> {patient.condition}
              </div>
              <div>
                <span className="label">Notes:</span> {patient.symptoms}
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
                      Schedule Now
                    </button>
                  )}
                </div>
              ) : (
                <span className="tap-hint">Tap to schedule →</span>
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
    </div>
  )
}

export default PatientCardDeck
