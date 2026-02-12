import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../auth/AuthContext'
import { API_BASE, DEFAULT_CHAT, DEFAULT_PROMPT, FALLBACK_NOTES } from './constants'
import {
  highlightWithSpans,
  normalizeLabNotes,
  removeStopwords,
  safeDateCompare,
  simpleStem,
  simpleTokenize,
  sortNotesChrono,
  statusTone,
} from './utils'
import ActiveNoteCard from './components/ActiveNoteCard'
import ChartWorkspace from './components/ChartWorkspace'
import ClientListPanel from './components/ClientListPanel'
import NotesLabHeader from './components/NotesLabHeader'
import PipelineModules from './components/PipelineModules'
import { Card } from './components/ui'
import './NotesLabPage.css'

function NotesLabPage() {
  const { userRole } = useAuthContext()

  const [notes, setNotes] = useState(FALLBACK_NOTES)
  const [notesLoading, setNotesLoading] = useState(true)
  const [notesError, setNotesError] = useState('')

  const [query, setQuery] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(FALLBACK_NOTES[0]?.client_id || '')
  const [selectedNoteId, setSelectedNoteId] = useState(FALLBACK_NOTES[0]?.note_id || '')

  const [ehrTab, setEhrTab] = useState('notes')
  const [step, setStep] = useState(1)

  const [extracting, setExtracting] = useState(false)
  const [extractionByNote, setExtractionByNote] = useState({
    'N-10022': {
      phase: 'Assessment',
      targets: ['final consonants', 'clusters'],
      cueing: ['modeling'],
      progress: 'Baseline assessment completed; stimulable with modeling.',
      recommended_intensity: 1,
      discharge_signal: 'none',
      attendance_flags: ['attendance expectations discussed'],
      spans: [
        { label: 'errors', text: 'final consonant deletion and cluster reduction' },
        { label: 'plan', text: 'Recommend 1x/week to start' },
      ],
    },
    'N-10023': {
      phase: 'Generalization',
      targets: ['/s/ blends'],
      cueing: ['minimal'],
      progress: 'Independent accuracy high; occasional errors with fatigue.',
      recommended_intensity: 1,
      discharge_signal: 'watch',
      attendance_flags: ['fatigue risk'],
      spans: [
        { label: 'performance', text: '18/20 independent' },
        { label: 'plan', text: 'plan discharge' },
      ],
    },
  })

  const [chat, setChat] = useState(DEFAULT_CHAT)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)

  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const [eduMode, setEduMode] = useState({
    cleanPii: true,
    removeStop: true,
    stem: false,
  })

  const abortRef = useRef(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    async function loadNotes() {
      setNotesLoading(true)
      setNotesError('')

      try {
        const res = await fetch(`${API_BASE}/notes/lab`, { cache: 'no-store', signal: ac.signal })
        const json = await res.json().catch(() => ({ error: 'Invalid JSON response' }))
        if (!res.ok || json?.error) {
          throw new Error(json?.error || `Failed to load notes (${res.status})`)
        }

        const rows = Array.isArray(json?.notes)
          ? json.notes
          : Array.isArray(json?.data?.notes)
            ? json.data.notes
            : []

        const clean = normalizeLabNotes(rows)

        if (!clean.length) {
          setNotes(FALLBACK_NOTES)
          setNotesError('Backend returned no notes. Showing fallback notes.')
          setSelectedClientId(FALLBACK_NOTES[0]?.client_id || '')
          setSelectedNoteId(FALLBACK_NOTES[0]?.note_id || '')
          return
        }

        setNotes(clean)
        const first = clean[0]
        setSelectedClientId((prev) => (clean.some((n) => n.client_id === prev) ? prev : first.client_id))
        setSelectedNoteId((prev) => (clean.some((n) => n.note_id === prev) ? prev : first.note_id))
      } catch (e) {
        if (e?.name === 'AbortError') return
        setNotes(FALLBACK_NOTES)
        setNotesError(e?.message || 'Failed to load notes.')
        setSelectedClientId(FALLBACK_NOTES[0]?.client_id || '')
        setSelectedNoteId(FALLBACK_NOTES[0]?.note_id || '')
      } finally {
        setNotesLoading(false)
      }
    }

    loadNotes()
    return () => ac.abort()
  }, [])

  const notesByClient = useMemo(() => {
    const map = new Map()
    for (const n of notes) {
      if (!map.has(n.client_id)) map.set(n.client_id, [])
      map.get(n.client_id).push(n)
    }

    for (const [k, arr] of map.entries()) {
      arr.sort(sortNotesChrono)
      map.set(k, arr)
    }

    return map
  }, [notes])

  const clientRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = []

    for (const [client_id, arr] of notesByClient.entries()) {
      let latest = ''
      let status = 'unprocessed'
      const clinician = arr[0]?.clinician || '—'
      const site = arr[0]?.site || '—'

      for (const n of arr) {
        if (safeDateCompare(n.created_at, latest) > 0) latest = n.created_at
        if (n.status === 'evaluated') status = 'evaluated'
        else if (status !== 'evaluated' && n.status === 'extracted') status = 'extracted'
      }

      const row = { client_id, latest_date: latest, status, clinician, site, note_count: arr.length }
      if (q) {
        const hay = `${client_id} ${clinician} ${site}`.toLowerCase()
        if (!hay.includes(q)) continue
      }

      rows.push(row)
    }

    rows.sort((a, b) => a.client_id.localeCompare(b.client_id))
    return rows
  }, [notesByClient, query])

  useEffect(() => {
    if (!clientRows.length) return
    if (!clientRows.some((c) => c.client_id === selectedClientId)) {
      setSelectedClientId(clientRows[0].client_id)
    }
  }, [clientRows, selectedClientId])

  const selectedClientNotes = useMemo(() => {
    return notesByClient.get(selectedClientId) || []
  }, [notesByClient, selectedClientId])

  useEffect(() => {
    if (!selectedClientNotes.length) return
    if (!selectedClientNotes.some((n) => n.note_id === selectedNoteId)) {
      setSelectedNoteId(selectedClientNotes[0].note_id)
    }
  }, [selectedClientNotes, selectedNoteId])

  const selectedNote = useMemo(() => {
    return selectedClientNotes.find((n) => n.note_id === selectedNoteId) || selectedClientNotes[0] || null
  }, [selectedClientNotes, selectedNoteId])

  const extracted = useMemo(() => {
    if (!selectedNote) return null
    return extractionByNote[selectedNote.note_id] || null
  }, [extractionByNote, selectedNote])

  const selectedStatusTone = useMemo(() => {
    return statusTone(selectedNote?.status)
  }, [selectedNote])

  const eduInput = selectedNote?.note || ''
  const eduCleaned = useMemo(() => {
    if (!eduMode.cleanPii) return eduInput
    return eduInput.replace(/\b(SLP-\d+)\b/g, '[CLINICIAN]').replace(/\b(C-\d+)\b/g, '[CLIENT]')
  }, [eduInput, eduMode.cleanPii])

  const eduTokens = useMemo(() => {
    let tokens = simpleTokenize(eduCleaned)
    if (eduMode.removeStop) tokens = removeStopwords(tokens)
    if (eduMode.stem) tokens = tokens.map(simpleStem)
    return tokens.slice(0, 48)
  }, [eduCleaned, eduMode.removeStop, eduMode.stem])

  const onSelectClient = useCallback(
    (clientId) => {
      setSelectedClientId(clientId)
      const arr = notesByClient.get(clientId) || []
      if (arr.length) setSelectedNoteId(arr[0].note_id)
    },
    [notesByClient]
  )

  const onSelectNote = useCallback((noteId) => setSelectedNoteId(noteId), [])

  const onAddChatMessage = useCallback((text) => {
    setChat((prev) => [...prev, { role: 'user', text }])
  }, [])

  const runExtractionOnSelected = useCallback(async () => {
    if (!selectedNote) return

    setExtracting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 450))

      const fake = {
        phase: 'Early Tx',
        targets: ['/f/ initial'],
        cueing: ['imitation', 'gestural'],
        progress: 'Improved with cues; inconsistent independent.',
        recommended_intensity: 2,
        discharge_signal: 'none',
        attendance_flags: ['fatigue mentioned', 'home practice 2x'],
        spans: [
          { label: 'target', text: 'Target: /f/ initial' },
          { label: 'performance', text: '12/20 accurate with imitation; improved to 16/20 with gestural cues' },
          { label: 'plan', text: 'Continue /f/ initial; introduce minimal pairs next week' },
        ],
      }

      setExtractionByNote((prev) => ({ ...prev, [selectedNote.note_id]: fake }))
    } finally {
      setExtracting(false)
    }
  }, [selectedNote])

  const agentSuggest = useCallback(() => {
    const suggestion =
      'Suggestion: Add 1-2 short examples (good/bad). Add explicit definitions for phase + discharge_signal. Require intensity justification from cues like "biweekly", "1x/week", or "transition".'
    setChat((prev) => [...prev, { role: 'assistant', text: suggestion }])
  }, [])

  const runBatchEvaluation = useCallback(async () => {
    if (!selectedClientNotes.length) return

    setRunError('')
    setRunning(true)
    const total = selectedClientNotes.length
    setProgress({ done: 0, total })

    try {
      for (let i = 0; i < total; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        setProgress({ done: i + 1, total })
      }
    } catch (e) {
      setRunError(e?.message || 'Batch run failed.')
    } finally {
      setRunning(false)
    }
  }, [selectedClientNotes])

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      // no-op
    }
  }, [prompt])

  const backPath = userRole === 'instructor' ? '/instructor' : '/student'

  if (!selectedNote) {
    return (
      <div className="notes-lab-page">
        <main className="notes-lab-main">
          <Card className="notes-empty">
            <h2>No notes available</h2>
            <p>Check backend response shape for `GET /notes/lab`.</p>
            <Link className="notes-back-link" to={backPath}>
              Back
            </Link>
          </Card>
        </main>
      </div>
    )
  }

  const highlightedText = highlightWithSpans(selectedNote.note, extracted?.spans || [])

  return (
    <div className="notes-lab-page">
      <NotesLabHeader step={step} setStep={setStep} running={running} backPath={backPath} />

      <main className="notes-lab-main">
        <section className="notes-layout">
          <aside>
            <ClientListPanel
              clientRows={clientRows}
              notesLoading={notesLoading}
              notesError={notesError}
              query={query}
              onQueryChange={setQuery}
              selectedClientId={selectedClientId}
              onSelectClient={onSelectClient}
            />
          </aside>

          <ChartWorkspace
            selectedNote={selectedNote}
            selectedStatusTone={selectedStatusTone}
            extracting={extracting}
            running={running}
            ehrTab={ehrTab}
            setEhrTab={setEhrTab}
            onRunExtraction={runExtractionOnSelected}
            selectedClientNotes={selectedClientNotes}
            extractionByNote={extractionByNote}
            onSelectNote={onSelectNote}
            extracted={extracted}
          />
        </section>

        <PipelineModules
          selectedNote={selectedNote}
          selectedClientNotes={selectedClientNotes}
          eduMode={eduMode}
          setEduMode={setEduMode}
          eduCleaned={eduCleaned}
          eduTokens={eduTokens}
          extracting={extracting}
          running={running}
          onRunExtraction={runExtractionOnSelected}
          chat={chat}
          onAgentSuggest={agentSuggest}
          onAddChatMessage={onAddChatMessage}
          prompt={prompt}
          setPrompt={setPrompt}
          onCopyPrompt={copyPrompt}
          onRunBatchEvaluation={runBatchEvaluation}
          progress={progress}
          runError={runError}
        />

        <div className="notes-footnote">
          Next connection to control-room simulation: batch outputs -&gt; client archetypes -&gt; Q* policy -&gt; predicted slot
          savings and discharge timing.
        </div>

        <ActiveNoteCard selectedNote={selectedNote} highlightedText={highlightedText} />
      </main>
    </div>
  )
}

export default NotesLabPage
