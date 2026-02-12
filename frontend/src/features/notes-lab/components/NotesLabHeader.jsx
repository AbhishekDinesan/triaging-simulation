import { Link } from 'react-router-dom'
import { Button, Pill } from './ui'

export default function NotesLabHeader({ step, setStep, running, backPath }) {
  return (
    <header className="notes-lab-header">
      <div className="notes-lab-header-inner">
        <div className="notes-header-title">
          <h1>Notes Lab</h1>
          <p>EHR-style chart review -&gt; NLP extraction -&gt; prompt building -&gt; batch evaluation.</p>
        </div>

        <div className="notes-header-controls">
          <div className="notes-step-row">
            <Pill tone="blue" label={`Pipeline step ${step}: ${step === 1 ? 'Extract' : step === 2 ? 'Prompt' : 'Evaluate'}`} />
            <div className="notes-step-actions">
              <Button variant="secondary" onClick={() => setStep(1)} disabled={running}>
                Extract
              </Button>
              <Button variant="secondary" onClick={() => setStep(2)} disabled={running}>
                Prompt
              </Button>
              <Button variant="secondary" onClick={() => setStep(3)} disabled={running}>
                Evaluate
              </Button>
            </div>
          </div>

          <Link className="notes-back-link" to={backPath}>
            Back
          </Link>
        </div>
      </div>
    </header>
  )
}
