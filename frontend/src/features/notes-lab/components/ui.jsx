import { useState } from 'react'

export function Card({ children, className = '' }) {
  return <div className={`notes-card ${className}`}>{children}</div>
}

export function SoftCard({ children, className = '' }) {
  return <div className={`notes-card notes-card-soft ${className}`}>{children}</div>
}

export function Button({ children, onClick, disabled, variant = 'primary', className = '' }) {
  const variantClass =
    variant === 'primary'
      ? 'notes-btn-primary'
      : variant === 'danger'
        ? 'notes-btn-danger'
        : 'notes-btn-secondary'

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`notes-btn ${variantClass} ${className}`}>
      {children}
    </button>
  )
}

export function Pill({ label, tone = 'slate' }) {
  return <span className={`notes-pill notes-pill-${tone}`}>{label}</span>
}

export function SectionTitle({ title, sub }) {
  return (
    <div className="notes-section-title">
      <div className="notes-section-title-main">{title}</div>
      {sub ? <div className="notes-section-title-sub">{sub}</div> : null}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="notes-tabs">
      {tabs.map((t) => (
        <button
          type="button"
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`notes-tab ${active === t.id ? 'active' : ''}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Disclosure({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="notes-disclosure">
      <button type="button" onClick={() => setOpen((v) => !v)} className="notes-disclosure-trigger">
        <span>{title}</span>
        <span className="notes-disclosure-glyph">{open ? '-' : '+'}</span>
      </button>
      {open ? <div className="notes-disclosure-body">{children}</div> : null}
    </div>
  )
}

export function RenderHighlighted({ text = '' }) {
  const parts = []
  const source = String(text || '')
  let i = 0

  while (i < source.length) {
    const start = source.indexOf('[[H:', i)
    if (start === -1) {
      parts.push(<span key={`t-${i}`}>{source.slice(i)}</span>)
      break
    }

    if (start > i) parts.push(<span key={`t-${i}`}>{source.slice(i, start)}</span>)

    const labelEnd = source.indexOf(']]', start)
    if (labelEnd === -1) {
      parts.push(<span key={`t-${start}`}>{source.slice(start)}</span>)
      break
    }

    const close = source.indexOf('[[/H]]', labelEnd + 2)
    if (close === -1) {
      parts.push(<span key={`t-${labelEnd}`}>{source.slice(labelEnd + 2)}</span>)
      break
    }

    const label = source.slice(start + 4, labelEnd)
    const inner = source.slice(labelEnd + 2, close)
    const toneClass = label === 'plan' ? 'plan' : label === 'performance' ? 'performance' : 'default'

    parts.push(
      <mark key={`h-${start}-${close}`} className={`notes-highlight ${toneClass}`}>
        {inner}
      </mark>
    )

    i = close + 6
  }

  return <div className="notes-text">{parts}</div>
}
