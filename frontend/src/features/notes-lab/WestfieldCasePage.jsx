import { useNavigate } from 'react-router-dom'
import WestfieldCaseLab from './components/WestfieldCaseLab'
import './NotesLabPage.css'

export default function WestfieldCasePage() {
  const navigate = useNavigate()

  return (
    <div className="westfield-standalone-page">
      <header className="westfield-standalone-header">
        <div className="westfield-standalone-header-inner">
          <div>
            <h1>Westfield Children&apos;s Centre — Case Study Lab</h1>
            <p>
              Trajectory clustering, newsvendor Q* optimization, and waitlist capacity projection
            </p>
          </div>
          <button className="westfield-back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </header>

      <main className="westfield-standalone-main">
        <WestfieldCaseLab />
      </main>
    </div>
  )
}
