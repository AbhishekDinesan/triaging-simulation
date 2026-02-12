import { Button, Card, Disclosure, Pill } from './ui'

export default function PipelineModules({
  selectedNote,
  selectedClientNotes,
  eduMode,
  setEduMode,
  eduCleaned,
  eduTokens,
  extracting,
  running,
  onRunExtraction,
  chat,
  onAgentSuggest,
  onAddChatMessage,
  prompt,
  setPrompt,
  onCopyPrompt,
  onRunBatchEvaluation,
  progress,
  runError,
}) {
  return (
    <Card className="notes-pipeline-card">
      <div className="notes-pipeline-head">
        <div>
          <h2>Pipeline Modules</h2>
          <p>
            Each module includes a <strong>Learn</strong> section and an <strong>Apply</strong> section.
          </p>
        </div>
        <Pill tone="blue" label={`Selected client: ${selectedNote.client_id} | Notes: ${selectedClientNotes.length}`} />
      </div>

      <div className="notes-modules">
        <Disclosure defaultOpen title="Module A - NLP Fundamentals (Cleaning -> Tokenizing -> Stopwords -> Stemming)">
          <div className="notes-module-grid two">
            <div className="notes-panel-muted">
              <div className="notes-panel-label">Learn</div>
              <div className="notes-bullet-grid">
                <p>
                  <strong>Cleaning</strong> removes noise and protects privacy (PII masking).
                </p>
                <p>
                  <strong>Tokenization</strong> splits text into units so models can count and compare.
                </p>
                <p>
                  <strong>Stopword removal</strong> highlights content words, but can remove meaningful clinical terms if done
                  blindly.
                </p>
                <p>
                  <strong>Stemming</strong> compresses word variants (improved/improving) into rough common forms.
                </p>
              </div>
            </div>

            <div className="notes-panel-white">
              <div className="notes-panel-label">Apply (interactive)</div>
              <div className="notes-switch-grid">
                <label>
                  <span>Mask simple identifiers</span>
                  <input
                    type="checkbox"
                    checked={eduMode.cleanPii}
                    onChange={(e) => setEduMode((m) => ({ ...m, cleanPii: e.target.checked }))}
                  />
                </label>
                <label>
                  <span>Remove stopwords</span>
                  <input
                    type="checkbox"
                    checked={eduMode.removeStop}
                    onChange={(e) => setEduMode((m) => ({ ...m, removeStop: e.target.checked }))}
                  />
                </label>
                <label>
                  <span>Apply naive stemming</span>
                  <input
                    type="checkbox"
                    checked={eduMode.stem}
                    onChange={(e) => setEduMode((m) => ({ ...m, stem: e.target.checked }))}
                  />
                </label>
              </div>

              <div className="notes-preview-box">
                <label>Cleaned text preview</label>
                <p>
                  {eduCleaned.slice(0, 650)}
                  {eduCleaned.length > 650 ? '…' : ''}
                </p>
              </div>

              <div className="notes-preview-box">
                <label>Tokens (sample)</label>
                <div className="notes-token-list">
                  {eduTokens.map((token, idx) => (
                    <span key={`${token}-${idx}`}>{token}</span>
                  ))}
                </div>
              </div>

              <div className="notes-green-callout">
                Operationalization hook: token features can support clustering, trajectory archetyping, and flagging risk
                patterns.
              </div>
            </div>
          </div>
        </Disclosure>

        <Disclosure title="Module B - Structured Extraction (Spans -> JSON Schema)">
          <div className="notes-module-grid split">
            <div className="notes-panel-muted">
              <div className="notes-panel-label">Learn</div>
              <div className="notes-bullet-grid">
                <p>Turn free text into consistent fields: phase, targets, intensity, and discharge signals.</p>
                <p>Spans provide evidence and make extraction decisions auditable.</p>
                <p>Consistency matters more than perfection for downstream operations.</p>
              </div>
            </div>

            <div className="notes-panel-white">
              <div className="notes-card-head">
                <h3>Apply</h3>
                <Button onClick={onRunExtraction} disabled={extracting || running}>
                  {extracting ? 'Extracting…' : 'Extract'}
                </Button>
              </div>
              <p className="notes-muted">Run extraction on the selected note and store output with spans.</p>
              <pre className="endpoint-hint">{`POST /notes/extract
{ note_id, note_text }
-> { extracted_json, spans[] }`}</pre>
            </div>
          </div>
        </Disclosure>

        <Disclosure title="Module C - Prompt Builder (Schema + Examples + Strict JSON)">
          <div className="notes-module-grid two">
            <div className="notes-panel-white">
              <div className="notes-card-head">
                <h3>Coach Chat</h3>
                <Button variant="secondary" onClick={onAgentSuggest} disabled={running}>
                  Ask Coach
                </Button>
              </div>
              <div className="chat-box">
                {chat.map((m, idx) => (
                  <p key={`${m.role}-${idx}`}>
                    <strong>{m.role === 'assistant' ? 'Coach' : 'You'}:</strong> {m.text}
                  </p>
                ))}
              </div>

              <input
                placeholder="Tell the coach what you want to change…"
                className="notes-chat-input"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const text = e.currentTarget.value.trim()
                  if (!text) return
                  onAddChatMessage(text)
                  e.currentTarget.value = ''
                }}
              />
            </div>

            <div className="notes-panel-white">
              <div className="notes-card-head">
                <h3>Prompt</h3>
                <Button variant="secondary" onClick={onCopyPrompt}>
                  Copy
                </Button>
              </div>
              <textarea className="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </div>
          </div>
        </Disclosure>

        <Disclosure title="Module D - Batch Evaluation (Run Prompt on Notes, Store Outputs)">
          <div className="notes-module-grid split">
            <div className="notes-panel-muted">
              <div className="notes-panel-label">Learn</div>
              <div className="notes-bullet-grid">
                <p>Batch eval measures stability and failure modes across many notes.</p>
                <p>Track schema validity, missing fields, and edge cases before production use.</p>
                <p>Do not trust one note; trust cohort-level patterns.</p>
              </div>
            </div>

            <div className="notes-panel-white">
              <div className="notes-card-head">
                <h3>Apply</h3>
                <Button onClick={onRunBatchEvaluation} disabled={running || !prompt.trim() || !selectedClientNotes.length}>
                  {running ? `Running… ${progress.done}/${progress.total}` : 'Run Batch'}
                </Button>
              </div>
              <p className="notes-muted">Run the prompt against all notes for the selected client.</p>
              {runError ? <p className="notes-error">{runError}</p> : null}
              <div className="notes-kv">
                <div>Progress</div>
                <div>
                  {progress.done} / {progress.total}
                </div>
              </div>
              <pre className="endpoint-hint">{`POST /notes/evaluate
{ prompt, note_ids[], model, temperature, concurrency }
-> { job_id }

GET /notes/evaluate/{job_id}
-> { status, progress, results[], errors[] }`}</pre>
            </div>
          </div>
        </Disclosure>
      </div>
    </Card>
  )
}
