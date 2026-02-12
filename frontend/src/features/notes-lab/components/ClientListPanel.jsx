import { statusTone } from '../utils'
import { Card, Pill } from './ui'

export default function ClientListPanel({
  clientRows,
  notesLoading,
  notesError,
  query,
  onQueryChange,
  selectedClientId,
  onSelectClient,
}) {
  return (
    <Card className="notes-left-panel">
      <div className="notes-card-head">
        <h2>Client List</h2>
        <Pill tone="slate" label={`${clientRows.length} clients`} />
      </div>

      {notesLoading ? <p className="notes-muted">Loading backend notes…</p> : null}
      {notesError ? <p className="notes-error">{notesError}</p> : null}

      <div className="notes-controls">
        <input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search client, clinician, site…" />
      </div>

      <div className="client-scroll">
        {clientRows.map((c) => (
          <button
            type="button"
            key={c.client_id}
            className={`client-row ${c.client_id === selectedClientId ? 'active' : ''}`}
            onClick={() => onSelectClient(c.client_id)}
          >
            <div className="client-row-top">
              <strong>{c.client_id}</strong>
              <Pill tone={statusTone(c.status)} label={c.status} />
            </div>
            <div className="client-row-meta">
              {c.latest_date || '—'} | {c.clinician || '—'} | {c.site || '—'}
            </div>
            <div className="client-row-meta">{c.note_count} notes</div>
          </button>
        ))}
      </div>
    </Card>
  )
}
