import { highlightWithSpans } from '../utils'
import { Button, Card, Pill, RenderHighlighted, SectionTitle, SoftCard, Tabs } from './ui'

function NotesTab({ selectedClientNotes, selectedNote, extractionByNote, onSelectNote, extracted }) {
  return (
    <section className="notes-two-col notes-two-col-wide">
      <Card>
        <SectionTitle title="Client Note History" sub="All notes for this client. Click a note card to set it as the active note." />

        <div className="note-scroll">
          {selectedClientNotes.map((n, idx) => {
            const isActive = n.note_id === selectedNote.note_id
            const preview = highlightWithSpans(n.note, extractionByNote[n.note_id]?.spans || [])

            return (
              <button
                type="button"
                key={n.note_id}
                className={`note-row ${isActive ? 'active' : ''}`}
                onClick={() => onSelectNote(n.note_id)}
              >
                <div className="note-row-head">
                  Note {n.note_number ?? idx + 1} | {n.created_at} | {n.clinician || '—'}
                </div>
                <div className="note-row-body note-row-body-clamp">
                  <RenderHighlighted text={preview} />
                </div>
              </button>
            )
          })}
        </div>

        {selectedNote.tags?.length ? (
          <div className="notes-tag-row">
            {selectedNote.tags.map((t) => (
              <span key={t} className="notes-tag">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      <SoftCard>
        <SectionTitle
          title="Auto Summary Panel"
          sub="This is what your NLP/LLM produces and what later feeds trajectory + policy logic."
        />

        <div className="summary-grid summary-grid-card">
          <div className="summary-box">
            <label>Phase</label>
            <p>{extracted?.phase || 'Unknown'}</p>
          </div>
          <div className="summary-box">
            <label>Targets</label>
            <p>{(extracted?.targets || []).join(', ') || '—'}</p>
          </div>
          <div className="summary-box">
            <label>Cueing</label>
            <p>{(extracted?.cueing || []).join(', ') || '—'}</p>
          </div>
          <div className="summary-box">
            <label>Intensity Recommendation</label>
            <p>{extracted?.recommended_intensity ?? '—'}</p>
          </div>
          <div className="summary-box">
            <label>Progress Summary</label>
            <p>{extracted?.progress || '—'}</p>
          </div>
          <div className="summary-box">
            <label>Attendance Flags</label>
            <p>{(extracted?.attendance_flags || []).join(', ') || '—'}</p>
          </div>
        </div>
      </SoftCard>
    </section>
  )
}

function SummaryTab({ extracted }) {
  return (
    <Card>
      <SectionTitle
        title="Clinical Summary"
        sub="This can evolve into a patient dashboard: care phase timeline, goal progress, attendance, and discharge readiness."
      />
      <div className="summary-grid summary-grid-3">
        <div className="summary-box">
          <label>Care Stage</label>
          <p>{extracted?.phase || 'Unknown'}</p>
        </div>
        <div className="summary-box">
          <label>Discharge Signal</label>
          <p>{extracted?.discharge_signal || '—'}</p>
        </div>
        <div className="summary-box">
          <label>Operational Hooks</label>
          <p>Phase -&gt; expected sessions, flags -&gt; cancellation risk, discharge -&gt; slot release.</p>
        </div>
      </div>
      <div className="notes-edu-callout">
        The goal is not perfect clinical NLP. The goal is extracting consistent operational signals that improve capacity
        policy decisions.
      </div>
    </Card>
  )
}

function PipelineTab() {
  return (
    <Card>
      <SectionTitle title="Learning Lab" sub="Scroll down to the pipeline modules (Learn -> Apply -> Operationalize)." />
      <p className="notes-muted">
        This section teaches preprocessing, extraction, prompt design, and evaluation before plugging outputs into trajectory
        and scheduling models.
      </p>
    </Card>
  )
}

export default function ChartWorkspace({
  selectedNote,
  selectedStatusTone,
  extracting,
  running,
  ehrTab,
  setEhrTab,
  onRunExtraction,
  selectedClientNotes,
  extractionByNote,
  onSelectNote,
  extracted,
}) {
  return (
    <div className="notes-right">
      <Card className="notes-chart-header-card">
        <div className="notes-chart-head">
          <div>
            <div className="notes-chart-title">
              Client Chart <span>{selectedNote.client_id}</span>
            </div>
            <div className="notes-chart-meta">
              Site: <strong>{selectedNote.site || '—'}</strong> | Clinician: <strong>{selectedNote.clinician || '—'}</strong> |
              Active note: <strong>{selectedNote.note_id}</strong>
            </div>
            <div className="notes-chart-pills">
              <Pill tone={selectedStatusTone} label={`Status: ${selectedNote.status || 'unprocessed'}`} />
              <Pill tone="slate" label={`Last note: ${selectedNote.created_at}`} />
              <Pill tone="amber" label="Alerts: none" />
            </div>
          </div>

          <div className="notes-chart-actions">
            <Button variant="secondary" onClick={onRunExtraction} disabled={extracting || running}>
              {extracting ? 'Extracting…' : 'Extract'}
            </Button>
            <Button variant="secondary" onClick={() => setEhrTab('pipeline')} disabled={running}>
              Open Learning Lab
            </Button>
          </div>
        </div>

        <Tabs
          active={ehrTab}
          onChange={setEhrTab}
          tabs={[
            { id: 'notes', label: 'Notes' },
            { id: 'summary', label: 'Clinical Summary' },
            { id: 'pipeline', label: 'Learning Lab' },
          ]}
        />
      </Card>

      {ehrTab === 'notes' ? (
        <NotesTab
          selectedClientNotes={selectedClientNotes}
          selectedNote={selectedNote}
          extractionByNote={extractionByNote}
          onSelectNote={onSelectNote}
          extracted={extracted}
        />
      ) : null}
      {ehrTab === 'summary' ? <SummaryTab extracted={extracted} /> : null}
      {ehrTab === 'pipeline' ? <PipelineTab /> : null}
    </div>
  )
}
