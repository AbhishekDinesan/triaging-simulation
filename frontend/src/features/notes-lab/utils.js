import { STOPWORDS } from './constants'

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function safeDateCompare(a, b) {
  return String(a || '').localeCompare(String(b || ''))
}

export function sortNotesChrono(a, b) {
  const nA = Number.isFinite(a.note_number) ? a.note_number : 999999
  const nB = Number.isFinite(b.note_number) ? b.note_number : 999999
  if (nA !== nB) return nA - nB

  const d = safeDateCompare(a.created_at, b.created_at)
  if (d !== 0) return d
  return String(a.note_id || '').localeCompare(String(b.note_id || ''))
}

export function statusTone(status) {
  if (status === 'evaluated') return 'emerald'
  if (status === 'extracted') return 'blue'
  return 'amber'
}

export function simpleTokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9/\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function removeStopwords(tokens) {
  return tokens.filter((t) => !STOPWORDS.has(t))
}

export function simpleStem(token) {
  return token.replace(/(ing|ed|ly|s)$/g, '')
}

export function highlightWithSpans(noteText, spans = []) {
  if (!spans.length) return noteText

  let text = String(noteText || '')
  for (const span of spans) {
    if (!span?.text) continue
    const re = new RegExp(escapeRegExp(span.text), 'g')
    text = text.replace(re, `[[H:${span.label || 'span'}]]${span.text}[[/H]]`)
  }

  return text
}

export function normalizeLabNotes(rows) {
  return rows
    .filter((r) => r && r.note_id && r.client_id && r.created_at && (r.note || r.note === ''))
    .map((r) => ({
      note_id: String(r.note_id),
      client_id: String(r.client_id),
      created_at: String(r.created_at),
      clinician: r.clinician ? String(r.clinician) : '—',
      site: r.site ? String(r.site) : '—',
      status: r.status ? String(r.status) : 'unprocessed',
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      snippet: r.snippet ? String(r.snippet) : '',
      note: String(r.note || ''),
      note_number: Number.isFinite(r.note_number) ? Number(r.note_number) : undefined,
    }))
}
