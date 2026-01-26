import { useState } from 'react'
import CalendarTab from './components/CalendarTab'
import './App.css'

const TABS = [
  { id: 'calendar', label: 'Patient Scheduling', icon: '📅' },
  { id: 'triage', label: 'Add Feature', icon: '🏥' },
  { id: 'cases', label: 'Add Feature', icon: '📋' },
]

function App() {
  const [activeTab, setActiveTab] = useState('calendar')

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🩺</span>
            <div className="logo-text">
              <h1>Simulation</h1>
              <span className="logo-subtitle">Triaging Simulation</span>
            </div>
          </div>
          <nav className="nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab !== 'calendar' && (
          <div className="coming-soon">
            <div className="coming-soon-content">
              <span className="coming-soon-icon">{TABS.find((t) => t.id === activeTab)?.icon}</span>
              <h2>Add Feature</h2>
              <p>Coming soon...</p>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>University of Waterloo</p>
      </footer>
    </div>
  )
}

export default App
