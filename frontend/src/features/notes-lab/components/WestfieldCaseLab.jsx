import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Pill } from './ui'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const CLUSTER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
const SCORE_LABELS = ['0 – Maintenance', '1 – Small improvement', '2 – Meaningful progress', '3 – Major gain']
const SCORE_COLORS = ['#94a3b8', '#60a5fa', '#34d399', '#f97316']


function seededRandom(seed) {
  let s = seed
  return function next() {
    s = (1664525 * s + 1013904223) >>> 0
    return (s >>> 0) / 4294967296
  }
}

function generateArchetypeScores(rng, archetype, sessions = 11) {
  const scores = []
  for (let i = 0; i < sessions; i++) {
    const t = i / (sessions - 1)
    let base
    switch (archetype) {
      case 'rapid': base = t < 0.3 ? 2.4 : t < 0.6 ? 1.2 : 0.4; break
      case 'steady': base = 1.3 + 0.3 * t; break
      case 'late': base = t < 0.4 ? 0.5 : t < 0.7 ? 1.5 : 2.3; break
      case 'plateau': base = 0.4 + 0.15 * t; break
      default: base = 1
    }
    scores.push(Math.max(0, Math.min(3, Math.round(base + (rng() - 0.5) * 0.8))))
  }
  return scores
}

function generateSyntheticDataset(seed = 42) {
  const rng = seededRandom(seed)
  const archetypes = [
    { type: 'rapid', count: 30 }, { type: 'steady', count: 30 },
    { type: 'late', count: 30 }, { type: 'plateau', count: 30 },
  ]
  const clients = []
  let idx = 1
  for (const arch of archetypes) {
    for (let i = 0; i < arch.count; i++) {
      clients.push({
        clientId: `WF-${String(idx).padStart(3, '0')}`,
        scores: generateArchetypeScores(rng, arch.type),
        trueArchetype: arch.type,
        ageYears: Math.round((2.5 + rng() * 2.5) * 10) / 10,
        complexityScore: Math.floor(rng() * 5) + 1,
      })
      idx++
    }
  }
  return clients
}


function movingAverage(arr, window = 3) {
  if (arr.length < window || window <= 1) return [...arr]
  const result = []
  for (let i = 0; i < arr.length; i++) {
    let sum = 0, count = 0
    for (let j = Math.max(0, i - Math.floor(window / 2)); j <= Math.min(arr.length - 1, i + Math.floor(window / 2)); j++) {
      sum += arr[j]; count++
    }
    result.push(sum / count)
  }
  return result
}

function buildCumulativeCurve(scores, smoothWindow = 3) {
  const smoothed = movingAverage(scores, smoothWindow)
  const cumulative = []
  let total = 0
  for (const val of smoothed) { total += val; cumulative.push(total) }
  return cumulative
}

function computeStoppingPoint(cumulative, alpha = 0.9) {
  if (cumulative.length === 0) return 0
  const target = alpha * cumulative[cumulative.length - 1]
  for (let i = 0; i < cumulative.length; i++) {
    if (cumulative[i] >= target) return i + 2
  }
  return cumulative.length + 1
}

function euclideanDistance(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

function standardizeMatrix(matrix) {
  const nCols = matrix[0].length
  const means = Array(nCols).fill(0)
  const stds = Array(nCols).fill(0)
  for (const row of matrix) for (let j = 0; j < nCols; j++) means[j] += row[j]
  for (let j = 0; j < nCols; j++) means[j] /= matrix.length
  for (const row of matrix) for (let j = 0; j < nCols; j++) stds[j] += (row[j] - means[j]) ** 2
  for (let j = 0; j < nCols; j++) stds[j] = Math.sqrt(stds[j] / matrix.length) || 1
  return matrix.map((row) => row.map((val, j) => (val - means[j]) / stds[j]))
}

function kMeans(data, k, maxIter = 100, seed = 42) {
  const rng = seededRandom(seed)
  const n = data.length, d = data[0].length
  const centroids = [], usedIndices = new Set()
  centroids.push([...data[Math.floor(rng() * n)]])
  usedIndices.add(0)
  for (let c = 1; c < k; c++) {
    const dists = data.map((point, idx) => {
      if (usedIndices.has(idx)) return 0
      let minD = Infinity
      for (const centroid of centroids) minD = Math.min(minD, euclideanDistance(point, centroid))
      return minD * minD
    })
    const totalDist = dists.reduce((a, b) => a + b, 0)
    let target = rng() * totalDist, chosen = 0
    for (let i = 0; i < n; i++) { target -= dists[i]; if (target <= 0) { chosen = i; break } }
    centroids.push([...data[chosen]]); usedIndices.add(chosen)
  }
  let labels = Array(n).fill(0)
  for (let iter = 0; iter < maxIter; iter++) {
    const newLabels = data.map((point) => {
      let bestC = 0, bestD = Infinity
      for (let c = 0; c < k; c++) { const dist = euclideanDistance(point, centroids[c]); if (dist < bestD) { bestD = dist; bestC = c } }
      return bestC
    })
    let changed = false
    for (let i = 0; i < n; i++) if (newLabels[i] !== labels[i]) { changed = true; break }
    labels = newLabels
    if (!changed) break
    for (let c = 0; c < k; c++) {
      const members = data.filter((_, idx) => labels[idx] === c)
      if (!members.length) continue
      for (let j = 0; j < d; j++) centroids[c][j] = members.reduce((sum, row) => sum + row[j], 0) / members.length
      }
    }
  return labels
}

function computeOptimalQ(tStars, tMax = 12) {
  if (tStars.length === 0) return { qStar: null, curve: [] }
  const curve = []
  let bestQ = 1, bestSavings = -Infinity
  for (let q = 1; q <= tMax; q++) {
    const fQ = tStars.filter((t) => t <= q).length / tStars.length
    const expectedSavings = fQ * (tMax - q)
    curve.push({ q, fQ, expectedSavings, expectedDelivered: tMax - expectedSavings })
    if (expectedSavings > bestSavings) { bestSavings = expectedSavings; bestQ = q }
    }
  return { qStar: bestQ, curve, bestSavings }
}

function computeMeanBaseline(tStars, tMax = 12) {
  if (tStars.length === 0) return { qMean: null, savings: 0 }
  const meanT = tStars.reduce((a, b) => a + b, 0) / tStars.length
  const qMean = Math.max(1, Math.min(tMax, Math.round(meanT)))
  const fQ = tStars.filter((t) => t <= qMean).length / tStars.length
  return { qMean, savings: fQ * (tMax - qMean) }
}


export default function WestfieldCaseLab() {
  const [activeStage, setActiveStage] = useState('q1')

  const [q1Data, setQ1Data] = useState(null)
  const [q1Loading, setQ1Loading] = useState(false)
  const [q1Error, setQ1Error] = useState('')
  const [q1SelectedClient, setQ1SelectedClient] = useState(0)
  const [q1Prompt, setQ1Prompt] = useState('')
  const [q1Scoring, setQ1Scoring] = useState(false)
  const [q1ScoreResult, setQ1ScoreResult] = useState(null)
  const [q1ScoreError, setQ1ScoreError] = useState('')

  const [nClusters, setNClusters] = useState(4)
  const [alpha, setAlpha] = useState(0.9)
  const [smoothWindow, setSmoothWindow] = useState(3)
  const [q2Results, setQ2Results] = useState(null)
  const [q2View, setQ2View] = useState('summary')
  const [q2DataSource, setQ2DataSource] = useState('backend')
  const [q2Loading, setQ2Loading] = useState(false)
  const [q2Error, setQ2Error] = useState('')

  const [q3Data, setQ3Data] = useState(null)
  const [q3Loading, setQ3Loading] = useState(false)
  const [q3Error, setQ3Error] = useState('')
  const [q3View, setQ3View] = useState('features')

  const syntheticDataset = useMemo(() => generateSyntheticDataset(42), [])

  const fetchQ1 = useCallback(async () => {
    setQ1Loading(true)
    setQ1Error('')
    try {
      const res = await fetch(`${API_BASE}/q1/summary?max_sample_clients=100`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setQ1Data(json)
      if (json.prompt && !q1Prompt) setQ1Prompt(json.prompt)
    } catch (e) {
      setQ1Error(e.message || 'Failed to load Q1 data')
    } finally {
      setQ1Loading(false)
    }
  }, [])

  const submitQ1Score = useCallback(async () => {
    setQ1Scoring(true)
    setQ1ScoreError('')
    setQ1ScoreResult(null)
    try {
      const res = await fetch(`${API_BASE}/q1/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q1Prompt, client_index: q1SelectedClient }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setQ1ScoreResult(json)
    } catch (e) {
      setQ1ScoreError(e.message || 'Failed to score client')
    } finally {
      setQ1Scoring(false)
    }
  }, [q1Prompt, q1SelectedClient])

  const runQ2Backend = useCallback(async () => {
    setQ2Loading(true)
    setQ2Error('')
    try {
      const params = new URLSearchParams({
        n_clusters: nClusters, smooth_window: smoothWindow, alpha, length_mode: 'truncate',
      })
      const res = await fetch(`${API_BASE}/notes/analytics?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const clusters = []
      for (let c = 0; c < nClusters; c++) {
        const key = String(c)
        const size = json.clusters?.counts?.[key] || 0
        const qStar = json.clusters?.Qstar?.[key] || null
        const qMean = json.clusters?.Qmean?.[key] || null
        const eSaved = json.clusters?.E_saved?.[key] || 0
        const eSavedMean = json.clusters?.E_saved_mean?.[key] || 0
        const histData = json.clusters?.hist_tstar?.[key] || []
        const tStars = histData.flatMap((h) => Array(h.count).fill(h.t))
        const meanTStar = tStars.length ? tStars.reduce((a, b) => a + b, 0) / tStars.length : 0
        const policyFrontier = json.clusters?.policy_frontier?.[key] || []
        const curve = policyFrontier.map((pt) => ({
          q: pt.Q, expectedSavings: json.config.T_max_sessions - pt.expected_delivered, expectedDelivered: pt.expected_delivered, fQ: 0,
        }))
        const meanCurve = json.clusters?.mean_curves?.[c] || []

        clusters.push({
          id: c, size, tStars, meanTStar, qStar, qMean,
          expectedSavedQStar: eSaved, expectedSavedQMean: eSavedMean,
          curve, meanCurve, color: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
          members: [], individualCurves: (json.clusters?.individual_curves || []).filter((ic) => ic.label === c),
        })
      }

      const tMax = json.config?.T_max_sessions || 12
      const totalClients = json.overall?.total_children || 0
      const totalOriginal = json.overall?.total_original_sessions || totalClients * tMax
      const totalSavedQStar = json.overall?.expected_total_saved || 0
      const totalSavedQMean = json.overall?.expected_total_saved_baseline || 0

      setQ2Results({
        clusters, tMax, totalClients, totalOriginal, totalSavedQStar, totalSavedQMean,
        archetypes: json.clusters?.archetypes_overall || {},
        archetypesByCluster: json.clusters?.archetypes_by_cluster || {},
        source: 'backend',
      })
    } catch (e) {
      setQ2Error(e.message || 'Failed to load backend data')
    } finally {
      setQ2Loading(false)
    }
  }, [nClusters, alpha, smoothWindow])

  const runQ2Synthetic = useCallback(() => {
    const tMax = 12
    const clientData = syntheticDataset.map((client) => {
      const cumulative = buildCumulativeCurve(client.scores, smoothWindow)
      const tStar = computeStoppingPoint(cumulative, alpha)
      return { ...client, cumulative, tStar: Math.min(tStar, tMax) }
    })
    const curveMatrix = clientData.map((c) => c.cumulative)
    const scaledMatrix = standardizeMatrix(curveMatrix)
    const labels = kMeans(scaledMatrix, nClusters, 100, 42)

    const clusters = []
    for (let c = 0; c < nClusters; c++) {
      const members = clientData.filter((_, idx) => labels[idx] === c)
      const tStars = members.map((m) => m.tStar)
      const { qStar, curve, bestSavings } = computeOptimalQ(tStars, tMax)
      const { qMean, savings: meanSavings } = computeMeanBaseline(tStars, tMax)
      const meanCurve = []
      if (members.length > 0) {
        const len = members[0].cumulative.length
        for (let i = 0; i < len; i++) meanCurve.push(members.reduce((sum, m) => sum + m.cumulative[i], 0) / members.length)
        }
      clusters.push({
        id: c, size: members.length, members, tStars, meanTStar: tStars.length ? tStars.reduce((a, b) => a + b, 0) / tStars.length : 0,
        qStar, qMean, expectedSavedQStar: bestSavings, expectedSavedQMean: meanSavings,
        curve, meanCurve, color: CLUSTER_COLORS[c % CLUSTER_COLORS.length],
      })
    }
    const totalClients = clientData.length
    const totalOriginal = totalClients * tMax
    const totalSavedQStar = clusters.reduce((sum, cl) => sum + cl.expectedSavedQStar * cl.size, 0)
    const totalSavedQMean = clusters.reduce((sum, cl) => sum + cl.expectedSavedQMean * cl.size, 0)
    setQ2Results({ clusters, tMax, totalClients, totalOriginal, totalSavedQStar, totalSavedQMean, source: 'synthetic' })
    setQ2Error('')
  }, [syntheticDataset, nClusters, alpha, smoothWindow])

  const runQ2 = useCallback(() => {
    if (q2DataSource === 'backend') runQ2Backend()
    else runQ2Synthetic()
  }, [q2DataSource, runQ2Backend, runQ2Synthetic])

  const fetchQ3 = useCallback(async () => {
    setQ3Loading(true)
    setQ3Error('')
    try {
      const params = new URLSearchParams({ n_clusters: nClusters, smooth_window: smoothWindow, alpha })
      const res = await fetch(`${API_BASE}/q3/analysis?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setQ3Data(json)
    } catch (e) {
      setQ3Error(e.message || 'Failed to load Q3 data')
    } finally {
      setQ3Loading(false)
    }
  }, [nClusters, smoothWindow, alpha])

  useEffect(() => { fetchQ1() }, [fetchQ1])


  function renderQ1() {
    if (q1Loading) return <div className="westfield-empty"><p>Loading Q1 scoring data...</p></div>
    if (q1Error) return <div className="westfield-empty"><p className="wf-error">{q1Error}</p><Button onClick={fetchQ1}>Retry</Button></div>
    if (!q1Data) return <div className="westfield-empty"><Button onClick={fetchQ1}>Load Q1 Data</Button></div>

    const client = q1Data.all_clients?.[q1SelectedClient] || q1Data.sample_clients?.[0]
    const totalScores = q1Data.total_scores || 0
    const dist = q1Data.score_distribution || {}
    const maxDistVal = Math.max(...Object.values(dist), 1)

    return (
      <div className="wf-q1">
        
        <div className="wf-section wf-prompt-section">
          <h4>1. Write Your Scoring Prompt</h4>
          <p className="notes-muted">
            Edit the prompt below, select a client, and click <strong>Score This Client</strong> to send
            their full clinical notes to the LLM. The model will return a JSON array of 0–3 scores for
            every consecutive session pair.
          </p>
          <textarea
            className="wf-prompt-editor"
            value={q1Prompt}
            onChange={(e) => setQ1Prompt(e.target.value)}
            rows={12}
            placeholder="Write your scoring prompt here..."
          />
          <div className="wf-prompt-actions">
            <div className="wf-client-nav">
              <label>
                <span>Client to score:</span>
                <select value={q1SelectedClient} onChange={(e) => { setQ1SelectedClient(Number(e.target.value)); setQ1ScoreResult(null) }}>
                  {(q1Data.all_clients || []).map((c, idx) => (
                    <option key={c.client_id} value={idx}>{c.client_id} ({c.archetype}) — {c.n_notes} notes</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="wf-prompt-btns">
              <Button variant="secondary" onClick={() => setQ1Prompt(q1Data.prompt || '')}>
                Reset to Default Prompt
              </Button>
              <Button onClick={submitQ1Score} disabled={q1Scoring || !q1Prompt.trim()}>
                {q1Scoring ? 'Scoring...' : `Score ${client?.client_id || 'Client'}`}
              </Button>
            </div>
          </div>
          {q1ScoreError && <p className="wf-error">{q1ScoreError}</p>}
        </div>

        
        {q1ScoreResult && (
          <div className="wf-section wf-score-results">
            <h4>Scoring Result — {q1ScoreResult.client_id} ({q1ScoreResult.archetype})</h4>
            <p className="notes-muted">
              Model: <strong>{q1ScoreResult.model_used}</strong> |
              Notes: {q1ScoreResult.n_notes} |
              Expected scores: {q1ScoreResult.expected_scores}
              {q1ScoreResult.parse_error && <span className="wf-error" style={{marginLeft: '1rem'}}>{q1ScoreResult.parse_error}</span>}
            </p>

            
            {q1ScoreResult.parsed_scores && (
              <div className="wf-comparison">
                <div className="wf-comparison-header">
                  <span>Transition</span>
                  <span>Your Prompt</span>
                  <span>Pre-computed</span>
                  <span>Match?</span>
                </div>
                {q1ScoreResult.parsed_scores.map((score, idx) => {
                  const precomputed = q1ScoreResult.precomputed_scores?.[idx]
                  const match = score === precomputed
                  const close = Math.abs(score - (precomputed ?? 0)) <= 1
                  return (
                    <div key={idx} className={`wf-comparison-row ${match ? 'wf-match' : close ? 'wf-close' : 'wf-miss'}`}>
                      <span className="wf-comp-label">{idx + 1}→{idx + 2}</span>
                      <span>
                        <span className="wf-score-chip-sm" style={{ background: SCORE_COLORS[score] }}>{score}</span>
                      </span>
                      <span>
                        {precomputed != null && <span className="wf-score-chip-sm" style={{ background: SCORE_COLORS[precomputed] }}>{precomputed}</span>}
                      </span>
                      <span className="wf-comp-icon">{match ? '✓' : close ? '~' : '✗'}</span>
                    </div>
                  )
                })}
              </div>
            )}

            
            {q1ScoreResult.comparison && (
              <div className="westfield-kpi-row" style={{ marginTop: '0.75rem' }}>
                <div className="westfield-kpi westfield-kpi-accent">
                  <span>Exact Match Rate</span>
                  <strong>{(q1ScoreResult.comparison.exact_match_rate * 100).toFixed(1)}%</strong>
                </div>
                <div className="westfield-kpi westfield-kpi-accent">
                  <span>Within-1 Rate</span>
                  <strong>{(q1ScoreResult.comparison.within_one_rate * 100).toFixed(1)}%</strong>
                </div>
                <div className="westfield-kpi">
                  <span>Transitions Scored</span>
                  <strong>{q1ScoreResult.comparison.n_transitions}</strong>
                </div>
              </div>
            )}

            
            <details className="wf-raw-response">
              <summary>Raw LLM Response</summary>
              <pre className="wf-prompt-box">{q1ScoreResult.llm_raw_response}</pre>
            </details>
          </div>
        )}

        
        <div className="wf-section">
          <h4>2. Pre-computed Score Distribution ({totalScores.toLocaleString()} total)</h4>
          <p className="notes-muted">These are the scores already generated by the pipeline across all {q1Data.total_clients} clients. Use this as a benchmark.</p>
          <div className="wf-score-dist">
            {[0, 1, 2, 3].map((score) => {
              const count = dist[String(score)] || 0
              const pct = totalScores > 0 ? ((count / totalScores) * 100).toFixed(1) : '0'
              const barW = maxDistVal > 0 ? (count / maxDistVal) * 100 : 0
              return (
                <div key={score} className="wf-score-row">
                  <span className="wf-score-label">{SCORE_LABELS[score]}</span>
                  <div className="wf-score-bar-track">
                    <div className="wf-score-bar-fill" style={{ width: `${barW}%`, background: SCORE_COLORS[score] }} />
                  </div>
                  <span className="wf-score-count">{count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>

        
        {q1Data.archetypes?.length > 0 && (
          <div className="wf-section">
            <h4>3. Scores by Trajectory Archetype</h4>
            <div className="westfield-table-wrap">
              <table className="westfield-table">
                <thead>
                  <tr>
                    <th>Archetype</th>
                    <th>Score 0</th>
                    <th>Score 1</th>
                    <th>Score 2</th>
                    <th>Score 3</th>
                    <th>Total</th>
                    <th>Mean</th>
                  </tr>
                </thead>
                <tbody>
                  {q1Data.archetypes.map((arch) => {
                    const d = q1Data.archetype_distributions[arch] || {}
                    const vals = [0, 1, 2, 3].map((s) => d[String(s)] || 0)
                    const total = vals.reduce((a, b) => a + b, 0)
                    const mean = total > 0 ? vals.reduce((sum, v, i) => sum + v * i, 0) / total : 0
                    return (
                      <tr key={arch}>
                        <td><strong>{arch}</strong></td>
                        {vals.map((v, i) => <td key={i}>{v}</td>)}
                        <td>{total}</td>
                        <td><strong>{mean.toFixed(2)}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        
        {client && (
          <div className="wf-section">
            <h4>4. Selected Client Notes</h4>
            <div className="wf-client-meta">
              <Pill tone="blue" label={client.client_id} />
              <Pill tone="slate" label={`Archetype: ${client.archetype}`} />
              <Pill tone="green" label={`${client.n_notes} notes → ${client.n_scores} scores`} />
            </div>
            <div className="wf-scores-track">
              <span className="notes-muted" style={{ fontSize: '0.78rem', marginRight: '0.4rem' }}>Pre-computed:</span>
              {client.scores.map((score, idx) => (
                <div key={idx} className="wf-score-chip" style={{ background: SCORE_COLORS[score] }} title={`Transition ${idx + 1}→${idx + 2}: Score ${score}`}>
                  {score}
                </div>
              ))}
            </div>
            <div className="wf-notes-scroll">
              {client.notes_preview?.map((note, idx) => (
                <div key={idx} className="wf-note-card">
                  <div className="wf-note-header">
                    <strong>Session {note.note_number}</strong>
                    {idx < client.scores.length && (
                      <span className="wf-note-score" style={{ background: SCORE_COLORS[client.scores[idx]] }}>
                        → Score {client.scores[idx]}
                      </span>
                    )}
                  </div>
                  <p className="wf-note-snippet">{note.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        
        <div className="wf-section wf-eval-box">
          <h4>Pipeline Summary</h4>
          <div className="westfield-kpi-row">
            <div className="westfield-kpi">
              <span>Total Clients Scored</span>
              <strong>{q1Data.total_clients}</strong>
            </div>
            <div className="westfield-kpi">
              <span>Total Transitions</span>
              <strong>{totalScores.toLocaleString()}</strong>
            </div>
            <div className="westfield-kpi">
              <span>Mean Score</span>
              <strong>{q1Data.mean_score}</strong>
            </div>
          </div>
        </div>
      </div>
    )
  }


  function renderQ2Controls() {
    return (
      <div className="wf-q2-controls">
        <div className="wf-control-row">
        <label>
            <span>Data Source</span>
            <select value={q2DataSource} onChange={(e) => setQ2DataSource(e.target.value)}>
              <option value="backend">Backend (Real Mock Notes)</option>
              <option value="synthetic">Synthetic (120 clients)</option>
            </select>
          </label>
          <label>
            <span>Clusters (K)</span>
          <div className="westfield-slider-row">
            <input type="range" min="2" max="6" value={nClusters} onChange={(e) => setNClusters(Number(e.target.value))} />
            <strong>{nClusters}</strong>
          </div>
        </label>
        <label>
            <span>α threshold</span>
          <div className="westfield-slider-row">
              <input type="range" min="0.70" max="0.99" step="0.01" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} />
            <strong>{(alpha * 100).toFixed(0)}%</strong>
          </div>
        </label>
        <label>
            <span>Smooth window</span>
          <div className="westfield-slider-row">
            <input type="range" min="1" max="5" value={smoothWindow} onChange={(e) => setSmoothWindow(Number(e.target.value))} />
            <strong>{smoothWindow}</strong>
          </div>
        </label>
        </div>
        <Button onClick={runQ2} disabled={q2Loading}>
          {q2Loading ? 'Running...' : 'Run Clustering + Optimization'}
        </Button>
      </div>
    )
  }

  function renderQ2Summary() {
    if (!q2Results) return null
    const { clusters, tMax, totalClients, totalOriginal, totalSavedQStar, totalSavedQMean } = q2Results
    return (
      <div className="westfield-summary">
        <h4>Cluster Policy Summary {q2Results.source === 'backend' ? '(Backend Data)' : '(Synthetic Data)'}</h4>
        <div className="westfield-table-wrap">
          <table className="westfield-table">
            <thead><tr><th>Cluster</th><th>Size</th><th>Mean t*</th><th>Q* (Optimized)</th><th>Q (Mean)</th><th>E[saved/child] Q*</th><th>E[saved/child] Baseline</th><th>Δ</th></tr></thead>
            <tbody>
              {clusters.map((cl) => (
                <tr key={cl.id}>
                  <td><span className="westfield-cluster-dot" style={{ background: cl.color }} />{cl.id}</td>
                  <td>{cl.size}</td><td>{cl.meanTStar.toFixed(1)}</td><td><strong>{cl.qStar}</strong></td><td>{cl.qMean}</td>
                  <td>{(cl.expectedSavedQStar / Math.max(cl.size, 1)).toFixed(2)}</td>
                  <td>{(cl.expectedSavedQMean / Math.max(cl.size, 1)).toFixed(2)}</td>
                  <td className={cl.expectedSavedQStar - cl.expectedSavedQMean > 0 ? 'westfield-positive' : ''}>
                    {((cl.expectedSavedQStar - cl.expectedSavedQMean) / Math.max(cl.size, 1)).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td><strong>Total</strong></td><td>{totalClients}</td><td>—</td><td>—</td><td>—</td>
              <td><strong>{(totalSavedQStar / Math.max(totalClients, 1)).toFixed(2)}</strong></td>
              <td>{(totalSavedQMean / Math.max(totalClients, 1)).toFixed(2)}</td>
              <td className="westfield-positive"><strong>{((totalSavedQStar - totalSavedQMean) / Math.max(totalClients, 1)).toFixed(2)}</strong></td>
            </tr></tfoot>
          </table>
        </div>
        <div className="westfield-kpi-row">
          <div className="westfield-kpi"><span>T<sub>max</sub></span><strong>{tMax}</strong></div>
          <div className="westfield-kpi"><span>Total Original</span><strong>{totalOriginal}</strong></div>
          <div className="westfield-kpi westfield-kpi-accent"><span>Total Saved (Q*)</span><strong>{totalSavedQStar.toFixed(1)}</strong></div>
          <div className="westfield-kpi westfield-kpi-accent"><span>% Saved</span><strong>{((totalSavedQStar / Math.max(totalOriginal, 1)) * 100).toFixed(1)}%</strong></div>
        </div>
      </div>
    )
  }

  function renderQ2Curves() {
    if (!q2Results) return null
    const { clusters, tMax } = q2Results
    const maxSavings = Math.max(...clusters.flatMap((cl) => cl.curve.map((pt) => pt.expectedSavings)), 1)
    return (
      <div className="westfield-curves">
        <h4>Expected Sessions Saved vs. Audit Session (Q)</h4>
        <p className="notes-muted">Each line = E[savings](Q) = F<sub>c</sub>(Q) × (T<sub>max</sub> − Q). Dashed marker = Q*.</p>
        <div className="westfield-chart-area">
          <div className="westfield-y-axis"><span>{maxSavings.toFixed(1)}</span><span>{(maxSavings / 2).toFixed(1)}</span><span>0</span></div>
          <div className="westfield-chart-body">
            {clusters.map((cl) => (
              <div key={cl.id} className="westfield-curve-row">
                {cl.curve.map((pt) => {
                  const height = maxSavings > 0 ? (pt.expectedSavings / maxSavings) * 100 : 0
                  const isQ = pt.q === cl.qStar
                  return <div key={pt.q} className={`westfield-bar ${isQ ? 'westfield-bar-star' : ''}`} style={{ height: `${Math.max(1, height)}%`, background: isQ ? cl.color : `${cl.color}66`, borderColor: cl.color }} title={`Cluster ${cl.id}, Q=${pt.q}: ${pt.expectedSavings.toFixed(2)}${isQ ? ' ← Q*' : ''}`} />
                })}
              </div>
            ))}
            <div className="westfield-x-axis">{Array.from({ length: tMax }, (_, i) => <span key={i + 1}>{i + 1}</span>)}</div>
            </div>
          </div>
        <div className="westfield-legend">{clusters.map((cl) => <span key={cl.id} className="westfield-legend-item"><span className="westfield-cluster-dot" style={{ background: cl.color }} />Cluster {cl.id} (Q*={cl.qStar})</span>)}</div>
      </div>
    )
  }

  function renderQ2Stopping() {
    if (!q2Results) return null
    const { clusters, tMax } = q2Results
    return (
      <div className="westfield-stopping">
        <h4>Stopping Point (t*) Distributions</h4>
        <p className="notes-muted">t* = earliest session where cumulative progress ≥ {(alpha * 100).toFixed(0)}% of total.</p>
        <div className="westfield-hist-grid">
          {clusters.map((cl) => {
            const bins = Array(tMax).fill(0)
            for (const t of cl.tStars) { const b = Math.max(0, Math.min(tMax - 1, Math.round(t) - 1)); bins[b]++ }
            const maxBin = Math.max(...bins, 1)
            return (
              <div key={cl.id} className="westfield-hist-panel">
                <div className="westfield-hist-title"><span className="westfield-cluster-dot" style={{ background: cl.color }} />Cluster {cl.id} <span className="notes-muted">(n={cl.size})</span></div>
                <div className="westfield-hist-bars">
                  {bins.map((count, i) => (
                    <div key={i} className="westfield-hist-col">
                      <div className="westfield-hist-fill" style={{ height: `${(count / maxBin) * 100}%`, background: cl.color }} title={`Session ${i + 1}: ${count}`} />
                      <span className="westfield-hist-label">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderQ2Archetypes() {
    if (!q2Results?.archetypesByCluster) return null
    const { clusters, archetypesByCluster } = q2Results
    const allArchs = [...new Set(Object.values(archetypesByCluster).flatMap((m) => Object.keys(m)))]
    if (!allArchs.length) return <p className="notes-muted">Archetype data not available for this data source.</p>
    return (
      <div className="wf-section">
        <h4>Archetype Composition by Cluster</h4>
        <div className="westfield-table-wrap">
          <table className="westfield-table">
            <thead><tr><th>Cluster</th>{allArchs.map((a) => <th key={a}>{a}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {clusters.map((cl) => {
                const byArch = archetypesByCluster[String(cl.id)] || {}
                const total = Object.values(byArch).reduce((s, v) => s + v, 0)
                return (
                  <tr key={cl.id}>
                    <td><span className="westfield-cluster-dot" style={{ background: cl.color }} />{cl.id}</td>
                    {allArchs.map((a) => <td key={a}>{byArch[a] || 0}</td>)}
                    <td><strong>{total}</strong></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderQ2() {
    const Q2_TABS = [
      { id: 'summary', label: 'Policy Summary' }, { id: 'curves', label: 'Savings Curves' },
      { id: 'stopping', label: 't* Distributions' }, { id: 'archetypes', label: 'Archetype Mix' },
    ]
    return (
      <div className="wf-q2">
        {renderQ2Controls()}
        {q2Error && <p className="wf-error">{q2Error}</p>}
        {q2Loading && <div className="westfield-empty"><p>Running clustering + optimization...</p></div>}
        {!q2Loading && !q2Results && <div className="westfield-empty"><p>Configure parameters above and click <strong>Run Clustering + Optimization</strong>.</p></div>}
        {q2Results && (
          <>
            <div className="westfield-view-tabs">
              {Q2_TABS.map((t) => <button key={t.id} type="button" className={`westfield-view-tab ${q2View === t.id ? 'active' : ''}`} onClick={() => setQ2View(t.id)}>{t.label}</button>)}
            </div>
            {q2View === 'summary' && renderQ2Summary()}
            {q2View === 'curves' && renderQ2Curves()}
            {q2View === 'stopping' && renderQ2Stopping()}
            {q2View === 'archetypes' && renderQ2Archetypes()}
          </>
        )}
      </div>
    )
  }


  function renderQ3Features() {
    if (!q3Data?.feature_exploration) return null
    const exploration = q3Data.feature_exploration
    const clusterIds = Object.keys(exploration).sort()
    const features = q3Data.features_used || []

    return (
      <div className="wf-section">
        <h4>Intake Feature Distributions by Cluster</h4>
        <p className="notes-muted">Box-plot-style summary showing how intake characteristics differ across trajectory groups.</p>
        <div className="westfield-table-wrap">
          <table className="westfield-table">
            <thead><tr><th>Feature</th>{clusterIds.map((c) => <th key={c}><span className="westfield-cluster-dot" style={{ background: CLUSTER_COLORS[Number(c)] }} />Cluster {c}</th>)}</tr></thead>
            <tbody>
              {features.map((feat) => (
                <tr key={feat}>
                  <td><strong>{feat}</strong></td>
                  {clusterIds.map((c) => {
                    const s = exploration[c]?.[feat] || {}
                    return <td key={c}>{s.mean?.toFixed(2) ?? '—'} ± {s.std?.toFixed(2) ?? '—'} <span className="notes-muted">[{s.min?.toFixed(1)}–{s.max?.toFixed(1)}]</span></td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        
        {features.map((feat) => {
          const allMeans = clusterIds.map((c) => exploration[c]?.[feat]?.mean || 0)
          const maxMean = Math.max(...allMeans, 0.01)
          return (
            <div key={feat} className="wf-feat-chart">
              <h5>{feat}</h5>
              <div className="wf-feat-bars">
                {clusterIds.map((c) => {
                  const mean = exploration[c]?.[feat]?.mean || 0
                  return (
                    <div key={c} className="wf-feat-bar-row">
                      <span className="wf-feat-bar-label">C{c}</span>
                      <div className="wf-feat-bar-track">
                        <div className="wf-feat-bar-fill" style={{ width: `${(mean / maxMean) * 100}%`, background: CLUSTER_COLORS[Number(c)] }} />
                      </div>
                      <span className="wf-feat-bar-val">{mean.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderQ3Models() {
    if (!q3Data?.models) return null
    const models = q3Data.models
    const modelNames = Object.keys(models)

    return (
      <div className="wf-section">
        <h4>Model Comparison</h4>
        <p className="notes-muted">
          Two classifiers trained on intake features to predict trajectory cluster.
          Train: {q3Data.train_size} | Test: {q3Data.test_size_actual} | Best: <strong>{q3Data.best_model}</strong>
        </p>
        <div className="westfield-table-wrap">
          <table className="westfield-table">
            <thead><tr><th>Model</th><th>Accuracy</th><th>Macro F1</th><th>Recommended</th></tr></thead>
            <tbody>
              {modelNames.map((name) => (
                <tr key={name} className={name === q3Data.best_model ? 'wf-best-row' : ''}>
                  <td><strong>{name.replace('_', ' ')}</strong></td>
                  <td>{(models[name].accuracy * 100).toFixed(1)}%</td>
                  <td>{(models[name].macro_f1 * 100).toFixed(1)}%</td>
                  <td>{name === q3Data.best_model ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        
        {modelNames.map((name) => {
          const cm = models[name].confusion_matrix
          const classLabels = models[name].class_labels || []
          if (!cm?.length) return null
          return (
            <div key={name} className="wf-cm-block">
              <h5>Confusion Matrix — {name.replace('_', ' ')}</h5>
              <div className="westfield-table-wrap">
                <table className="westfield-table wf-cm-table">
                  <thead><tr><th>True \ Pred</th>{classLabels.map((l) => <th key={l}>C{l}</th>)}</tr></thead>
                  <tbody>
                    {cm.map((row, ri) => (
                      <tr key={ri}>
                        <td><strong>C{classLabels[ri]}</strong></td>
                        {row.map((val, ci) => (
                          <td key={ci} className={ri === ci ? 'wf-cm-diag' : ''}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        
        {models.random_forest?.feature_importance && (
          <div className="wf-section">
            <h5>Feature Importance (Random Forest)</h5>
            <div className="wf-feat-bars">
              {Object.entries(models.random_forest.feature_importance)
                .sort(([, a], [, b]) => b - a)
                .map(([feat, imp]) => (
                  <div key={feat} className="wf-feat-bar-row">
                    <span className="wf-feat-bar-label">{feat}</span>
                    <div className="wf-feat-bar-track">
                      <div className="wf-feat-bar-fill" style={{ width: `${imp * 100}%`, background: '#6366f1' }} />
                    </div>
                    <span className="wf-feat-bar-val">{(imp * 100).toFixed(1)}%</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderQ3Waitlist() {
    if (!q3Data?.capacity_projection) return null
    const cap = q3Data.capacity_projection
    const mix = q3Data.waitlist_cluster_mix || {}

    return (
      <div className="wf-section">
        <h4>Waitlist Capacity Projection</h4>
        <p className="notes-muted">
          {q3Data.config?.waitlist_size || 40} synthetic waitlist clients classified by the best model ({q3Data.best_model?.replace('_', ' ')}).
          Compares differentiated Q* policy vs. uniform T<sub>max</sub>={q3Data.config?.T_max} baseline.
        </p>

        <div className="westfield-table-wrap">
          <table className="westfield-table">
            <thead><tr><th>Cluster</th><th>Waitlist Count</th><th>Q*</th><th>E[delivered/child]</th><th>Total Delivered</th></tr></thead>
            <tbody>
              {(cap.per_cluster || []).map((row) => (
                <tr key={row.cluster}>
                  <td><span className="westfield-cluster-dot" style={{ background: CLUSTER_COLORS[row.cluster] }} />Cluster {row.cluster} ({mix[String(row.cluster)] ? `${((mix[String(row.cluster)] / (q3Data.config?.waitlist_size || 40)) * 100).toFixed(0)}%` : ''})</td>
                  <td>{row.waitlist_count}</td>
                  <td>{row.q_star}</td>
                  <td>{row.e_delivered_per_child}</td>
                  <td>{row.total_delivered}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td><strong>Differentiated (Q*)</strong></td><td>{q3Data.config?.waitlist_size}</td><td>—</td><td>{(cap.projected_sessions / Math.max(q3Data.config?.waitlist_size || 1, 1)).toFixed(1)}</td><td><strong>{cap.projected_sessions}</strong></td></tr>
              <tr><td>Baseline (T<sub>max</sub>)</td><td>{q3Data.config?.waitlist_size}</td><td>—</td><td>{q3Data.config?.T_max}</td><td>{cap.baseline_sessions}</td></tr>
            </tfoot>
          </table>
        </div>

        <div className="westfield-kpi-row">
          <div className="westfield-kpi westfield-kpi-accent"><span>Sessions Freed</span><strong>{cap.sessions_saved}</strong></div>
          <div className="westfield-kpi westfield-kpi-accent"><span>% Capacity Freed</span><strong>{cap.percent_saved}%</strong></div>
          <div className="westfield-kpi"><span>Potential Extra Starts</span><strong>{cap.extra_starts_possible}</strong></div>
          <div className="westfield-kpi"><span>Baseline Total</span><strong>{cap.baseline_sessions}</strong></div>
          </div>
          </div>
    )
  }

  function renderQ3() {
    const Q3_TABS = [
      { id: 'features', label: 'Feature Exploration' },
      { id: 'models', label: 'Model Comparison' },
      { id: 'waitlist', label: 'Waitlist Projection' },
    ]

    return (
      <div className="wf-q3">
        <div className="wf-q3-controls">
          <p className="notes-muted">
            Uses cluster assignments from Q2 (K={nClusters}) plus synthetic intake features (age, complexity, severity).
            Trains logistic regression and random forest to predict trajectory group from intake data alone.
          </p>
          <Button onClick={fetchQ3} disabled={q3Loading}>
            {q3Loading ? 'Running Q3 Pipeline...' : 'Run Predictive Analytics'}
          </Button>
          </div>
        {q3Error && <p className="wf-error">{q3Error}</p>}
        {q3Loading && <div className="westfield-empty"><p>Training classifiers and generating predictions...</p></div>}
        {!q3Loading && !q3Data && <div className="westfield-empty"><p>Click <strong>Run Predictive Analytics</strong> to train models and generate waitlist predictions.</p></div>}
        {q3Data && (
          <>
            <div className="westfield-view-tabs">
              {Q3_TABS.map((t) => <button key={t.id} type="button" className={`westfield-view-tab ${q3View === t.id ? 'active' : ''}`} onClick={() => setQ3View(t.id)}>{t.label}</button>)}
        </div>
            {q3View === 'features' && renderQ3Features()}
            {q3View === 'models' && renderQ3Models()}
            {q3View === 'waitlist' && renderQ3Waitlist()}
          </>
        )}
      </div>
    )
  }


  const STAGES = [
    { id: 'q1', label: 'Q1: Progress Scoring', desc: 'LLM prompt engineering to extract 0–3 progress scores from clinical notes' },
    { id: 'q2', label: 'Q2: Clustering & Q*', desc: 'K-means trajectory clustering with newsvendor-style reassessment optimization' },
    { id: 'q3', label: 'Q3: Predictive Analytics', desc: 'Train classifiers on intake features → predict trajectory type → project capacity savings' },
  ]

  return (
    <div className="westfield-lab">
      <div className="westfield-intro">
        <h3>Westfield Children&apos;s Centre — Full Analytics Pipeline</h3>
        <p>
          End-to-end pipeline from the Westfield case: <strong>(Q1)</strong> extract per-session progress
          scores from clinical notes using an LLM, <strong>(Q2)</strong> cluster children into trajectory
          archetypes and derive optimal reassessment timing via newsvendor Q* optimization,
          <strong>(Q3)</strong> train predictive models on intake features and project capacity savings
          for the waitlist.
        </p>
        <div className="westfield-tag-row">
          <Pill tone="blue" label="Q1: Prompt Engineering" />
          <Pill tone="green" label="Q2: Clustering + Optimization" />
          <Pill tone="amber" label="Q3: Predictive Analytics" />
        </div>
      </div>

      <div className="wf-stage-tabs">
        {STAGES.map((s) => (
          <button key={s.id} type="button" className={`wf-stage-tab ${activeStage === s.id ? 'active' : ''}`} onClick={() => setActiveStage(s.id)}>
            <strong>{s.label}</strong>
            <span>{s.desc}</span>
                  </button>
                ))}
              </div>

      <div className="wf-stage-body">
        {activeStage === 'q1' && renderQ1()}
        {activeStage === 'q2' && renderQ2()}
        {activeStage === 'q3' && renderQ3()}
      </div>
    </div>
  )
}
