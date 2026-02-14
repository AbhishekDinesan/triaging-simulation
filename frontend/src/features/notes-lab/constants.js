export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export const STOPWORDS = new Set([
  'the',
  'and',
  'a',
  'an',
  'to',
  'of',
  'in',
  'with',
  'is',
  'was',
  'for',
  'if',
  'over',
  'this',
])

export const FALLBACK_NOTES = [
  {
    note_id: 'N-10021',
    client_id: 'C-0412',
    created_at: '2026-02-10',
    clinician: 'SLP-07',
    site: 'Cambridge',
    status: 'unprocessed',
    tags: ['Early Tx', 'imitation'],
    snippet: 'Targeted /f/ initial in CV; improved with gestural cues…',
    note:
      'SOAP NOTE\nS: Parent reports home practice happened 2x this week. Child was tired today.\nO: Target: /f/ initial in CV and word-level. 12/20 accurate with imitation; improved to 16/20 with gestural cues.\nA: Progress noted with initial /f/. Still inconsistent without cues. Attention impacted performance.\nP: Continue /f/ initial; introduce minimal pairs next week. Provide parent handout. Consider group trial if attention improves.',
    note_number: 1,
  },
  {
    note_id: 'N-10022',
    client_id: 'C-0412',
    created_at: '2026-02-08',
    clinician: 'SLP-07',
    site: 'Cambridge',
    status: 'extracted',
    tags: ['Assessment', 'screen'],
    snippet: 'Assessment summary; intelligibility reduced; caregiver concerns…',
    note:
      'INITIAL ASSESSMENT\nParent concerns: speech clarity, frustration when not understood.\nObservations: reduced intelligibility in spontaneous speech. Errors include final consonant deletion and cluster reduction.\nStimulability: improved accuracy with modeling. Recommend 1x/week to start. Discussed home practice and attendance expectations.',
    note_number: 0,
  },
  {
    note_id: 'N-10023',
    client_id: 'C-0450',
    created_at: '2026-02-07',
    clinician: 'SLP-02',
    site: 'Cambridge',
    status: 'evaluated',
    tags: ['Generalization', 'independent'],
    snippet: 'Generalizing /s/ blends into phrases; fewer cues; ready to discharge soon…',
    note:
      'PROGRESS NOTE\nO: /s/ blends in carrier phrases: 18/20 independent. Spontaneous speech still shows occasional errors under fatigue.\nA: Strong generalization; minimal cueing required.\nP: Transition to biweekly check-ins. If stability maintained over 2 sessions, plan discharge.',
    note_number: 1,
  },
]

export const DEFAULT_CHAT = [
  {
    role: 'assistant',
    text: 'Welcome to Notes Lab. Tell me what you want to extract (schema + definitions), and I can help produce a strict JSON prompt.',
  },
]

export const DEFAULT_PROMPT = `You are an expert pediatric SLP chart reviewer.
Given ONE clinical note, extract a STRICT JSON object that matches this schema exactly:

{
  "phase": "Assessment" | "Early Tx" | "Generalization" | "Unknown",
  "targets": string[],
  "cueing": string[],
  "recommended_intensity": 1 | 2 | 3,
  "discharge_signal": "none" | "watch" | "ready",
  "attendance_flags": string[],
  "progress_summary": string
}

Rules:
- If information is missing, use "Unknown" or [].
- Keep progress_summary <= 25 words.
- Do NOT include extra keys.
`
