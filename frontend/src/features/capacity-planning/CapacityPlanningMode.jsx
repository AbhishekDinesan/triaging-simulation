import { useEffect, useMemo, useState } from 'react'
import { useSimulationSettings } from '../simulation/SimulationSettingsContext'
import ARIMALab from '../arima-lab/ARIMALab'
import WestfieldCaseLab from '../notes-lab/components/WestfieldCaseLab'
import './CapacityPlanningMode.css'

const HORIZON_WEEKS = 24
const TRACKS = {
  technical: 'technical',
  application: 'application',
}

const CAPACITY_DIFFICULTY_PROFILES = {
  easy: {
    defaultDecisions: { clinicians: 4, hoursPerClinician: 7, arrivals: 3, bufferSlots: 1 },
    surgeMultiplier: 1.45,
    volatilityRange: 1,
    disruptionBase: 0.03,
    disruptionJitter: 0.04,
    progressMultiplier: 1.1,
  },
  medium: {
    defaultDecisions: { clinicians: 3, hoursPerClinician: 6, arrivals: 4, bufferSlots: 0 },
    surgeMultiplier: 1.8,
    volatilityRange: 2,
    disruptionBase: 0.08,
    disruptionJitter: 0.07,
    progressMultiplier: 1,
  },
  hard: {
    defaultDecisions: { clinicians: 3, hoursPerClinician: 5, arrivals: 6, bufferSlots: 0 },
    surgeMultiplier: 2.2,
    volatilityRange: 3,
    disruptionBase: 0.14,
    disruptionJitter: 0.1,
    progressMultiplier: 0.82,
  },
}

const TECHNICAL_CHAPTERS = [
  {
    id: 1,
    title: 'Descriptive Analytics: Understanding the System',
    keyQuestion: 'What is happening in the system?',
    coreConcepts: ['Summary statistics', 'Distributions', 'Dashboards', 'KPI design'],
    operationalContext:
      'Students receive a pre-run baseline dataset (arrivals, sessions delivered, wait times, cancellations) and focus on measuring system behavior with no policy decisions.',
    technicalSkills: [
      'Design meaningful KPIs (utilization, wait time percentiles, throughput)',
      'Visualize distributions versus point estimates',
      'Identify leading and lagging indicators',
      'Run cohort analysis and time-series summaries',
    ],
  },
  {
    id: 2,
    title: 'Probability & Simulation Foundations: Modeling Uncertainty',
    keyQuestion: 'How do we model a system under uncertainty?',
    coreConcepts: ['Discrete-event simulation', 'Probability distributions', 'Monte Carlo methods'],
    operationalContext:
      'Arrivals become stochastic instead of deterministic, showing that the same policy can produce different outcomes across runs.',
    technicalSkills: [
      'Fit distributions to empirical data (Poisson for arrivals, Beta for attendance)',
      'Run and interpret Monte Carlo simulation outputs',
      "Apply Little's Law and queueing intuition",
      'Interpret variance and run-to-run spread',
    ],
  },
  {
    id: 3,
    title: 'Predictive Analytics I: Regression (Supervised Learning)',
    keyQuestion: 'Given what we know about a client or a week, what outcome should we expect?',
    coreConcepts: ['Linear regression', 'Logistic regression'],
    operationalContext:
      'Students model two prediction problems: wait time/sessions delivered (linear) and appointment cancellation risk (logistic).',
    technicalSkills: [
      'Frame prediction targets (continuous versus categorical)',
      'Use train/test splits and cross-validation',
      'Evaluate with RMSE, R2, accuracy, precision, recall, and AUC-ROC',
      'Engineer features from operational simulation data',
      'Interpret coefficients, calibration, and prediction-versus-causation limits',
      'Use predictions operationally (for example, flag high cancellation-risk appointments)',
    ],
  },
  {
    id: 4,
    title: 'Predictive Analytics II: Tree-Based Methods (Supervised Learning)',
    keyQuestion: 'Which factors matter most when outcomes are nonlinear and interactive?',
    coreConcepts: ['Decision trees', 'Random forest', 'Feature importance'],
    operationalContext:
      'Students compare tree-based models against regression baselines for cancellations, wait-time risk, and throughput outcomes.',
    technicalSkills: [
      'Train and tune tree depth and ensemble size',
      'Interpret splits and feature importance',
      'Detect overfitting in flexible nonlinear models',
      'Compare model tradeoffs against linear baselines',
    ],
  },
  {
    id: 5,
    title: 'Predictive Analytics III: Forecasting Time Series (Supervised Learning)',
    keyQuestion: 'What will demand look like next month?',
    coreConcepts: ['ARIMA', 'Trend/seasonality decomposition', 'Forecast intervals'],
    operationalContext:
      'Demand shifts by season, so students forecast referral arrivals and use those forecasts to inform capacity decisions.',
    technicalSkills: [
      'Decompose series into trend, seasonality, and noise',
      'Fit and select ARIMA models',
      'Communicate forecast uncertainty',
      'Feed forecasts into downstream policy decisions',
    ],
  },
  {
    id: 6,
    title: 'Prescriptive Analytics I: Optimization',
    keyQuestion: 'Given our predictions and constraints, what should we do?',
    coreConcepts: ['Linear programming', 'Integer programming', 'Heuristics', 'Scheduling optimization'],
    operationalContext:
      'Given predicted demand and capacity budgets, students optimize clinician allocation across new versus continuing clients and individual versus group care.',
    technicalSkills: [
      'Formulate objective functions and constraints',
      'Build LP/IP allocation models',
      'Run sensitivity analysis',
      'Compare optimal plans with practical heuristics (FCFS, priority queues)',
    ],
  },
  {
    id: 7,
    title: 'Prescriptive Analytics II: Multi-Objective and Equity-Aware Optimization',
    keyQuestion: 'How do we optimize for multiple competing goals?',
    coreConcepts: ['Multi-objective optimization', 'Pareto frontiers', 'Fairness constraints'],
    operationalContext:
      'Students balance throughput, access, and equity because efficient policies can still create inequitable outcomes.',
    technicalSkills: [
      'Visualize throughput-equity Pareto tradeoffs',
      'Use weighted objectives and penalty terms',
      'Model hard constraints versus soft fairness penalties',
      'Evaluate robustness using mean and worst-case outcomes',
    ],
  },
  {
    id: 8,
    title: 'Unsupervised Learning & NLP: Structure from Unstructured Data',
    keyQuestion: 'How can unstructured data be used to guide operational decisions?',
    coreConcepts: ['Clustering', 'Text embeddings', 'NLP extraction'],
    operationalContext:
      'Students extract note-based features, embed notes, and cluster clients into operational archetypes that influence planning.',
    technicalSkills: [
      'Text preprocessing and embedding methods (TF-IDF, sentence embeddings)',
      'Use k-means/hierarchical clustering and choose k',
      'Interpret clusters as operational archetypes',
      'Connect cluster membership to downstream decisions',
    ],
  },
  {
    id: 9,
    title: 'Large Language Models: Extraction, Summarization and Decision Support',
    keyQuestion: 'How can unstructured data be used to guide operational decisions?',
    coreConcepts: ['Prompt engineering', 'LLM inference', 'Structured extraction'],
    operationalContext:
      'Students use LLMs to extract progress and risk signals from notes and assess whether those outputs are reliable enough for operations.',
    technicalSkills: [
      'Design prompts for structured extraction',
      'Evaluate precision, consistency, and hallucination risk',
      'Design human-in-the-loop validation checks',
    ],
  },
  {
    id: 10,
    title: 'Agentic AI',
    keyQuestion: 'How do we design a system that acts intelligently over time and where do humans stay in the loop?',
    coreConcepts: ['Agentic systems', 'Tool use', 'Automated decision pipelines'],
    operationalContext:
      'Students design an agent that monitors state each week, predicts outcomes, proposes decisions, flags equity risks, and executes approved actions.',
    technicalSkills: [
      'Architect an end-to-end decision loop',
      'Implement tool use and function calling patterns',
      'Define autonomous action versus escalation boundaries',
      'Evaluate agent behavior drift and overfitting over time',
    ],
  },
]

const APPLICATION_CHAPTERS = [
  {
    id: 1,
    title: 'Baseline Capacity Planning Under Deterministic Demand',
    keyQuestion: 'How do core allocation and cadence policies shape stability at baseline?',
    introduced: [
      'Single site (SLP), individual sessions only',
      'Fixed clinician capacity and session duration assumptions',
      'Fixed episode structure over a 12-24 week horizon',
    ],
    playerDecisions: ['Cadence policy', 'Buffer policy', 'FCFS vs urgency vs fairness'],
    tradeoffs: ['Aggressive throughput can increase instability', 'Conservative planning can increase backlog and access delay'],
  },
  {
    id: 2,
    title: 'Demand Uncertainty and Referral Surges',
    keyQuestion: 'How robust is the plan when demand regime changes?',
    introduced: ['Poisson/empirical stochastic arrivals', 'Normal/surge/drop demand regimes'],
    playerDecisions: ['Slack buffer versus high utilization policy'],
    tradeoffs: [
      'High utilization is fragile under surges',
      'Conservative capacity is safer but may underperform in stable demand',
    ],
  },
  {
    id: 3,
    title: 'Attendance and Cancellations as Capacity Loss',
    keyQuestion: 'How do we recover lost capacity without increasing overrun risk?',
    introduced: ['Appointment outcomes (attend, cancel, no-show)', 'Attendance regime uncertainty', 'Subgroup risk differences'],
    playerDecisions: ['Overbooking level', 'Booking horizon policy'],
    tradeoffs: ['Aggressive overbooking improves fill rate but raises overrun risk', 'Long horizons increase cancellation exposure'],
  },
  {
    id: 4,
    title: 'Care Pathway Design: Frequency and Block Structure',
    keyQuestion: 'How should frequency policy balance intensity and access?',
    introduced: ['Variable frequency pathways (weekly, biweekly, monthly)'],
    playerDecisions: ['Frequency policy by client stage'],
    tradeoffs: ['High intensity crowds out access', 'Low intensity expands access but delays progress'],
  },
  {
    id: 5,
    title: 'High Ratio Care Pathways to Increase Throughput',
    keyQuestion: 'When do group pathways increase throughput reliably?',
    introduced: ['Group blocks, fill uncertainty, and compatibility rules'],
    playerDecisions: ['Group volume and timing', 'Individual vs group pathway mix'],
    tradeoffs: ['Group-heavy strategy fails when attendance is weak', 'Throughput gains may vary by client subgroup'],
  },
  {
    id: 6,
    title: 'Operationalizing Clinical Notes: Clustering, Archetypes, and Q* Policy',
    keyQuestion: 'When should cluster-aware policies replace uniform treatment rules?',
    introduced: ['Note-derived trajectories', 'Client archetypes/clusters', 'Cluster-dependent Q* reassessment rules'],
    playerDecisions: ['Uniform Q vs cluster-specific Q*', 'Confidence threshold', 'Reassessment frequency'],
    tradeoffs: ['Misclassification can cause poor discharge decisions', 'Over-auditing consumes capacity'],
  },
  {
    id: 7,
    title: 'Policy Interaction Effects and Second-Order Consequences',
    keyQuestion: 'Which policy bundles are high-performing and robust?',
    introduced: ['Policy interactions across attendance, groups, Q*, and pathway design'],
    playerDecisions: ['Configure full policy bundles and compare outcomes across Monte Carlo runs'],
    tradeoffs: ['High-mean plans can be fragile', 'Robust plans may sacrifice peak performance'],
  },
  {
    id: 8,
    title: 'Equity in Aging Out Clients and Service Delivery',
    keyQuestion: 'How do we balance throughput, access, and benefit equity?',
    introduced: ['Access and benefit equity definitions', 'Aging-out risk', 'Minimum effective dose constraints'],
    playerDecisions: ['Protected capacity for high-risk clients', 'Dose commitments versus first-visit coverage', 'Risk-based prioritization'],
    tradeoffs: [
      'Coverage-focused plans can create token care',
      'Dose-commitment plans improve benefit but increase tail waits for others',
    ],
  },
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getArrivalsForWeek(baseArrivals, demandRegime, weekNumber, difficultyProfile) {
  if (demandRegime === 'surge' && weekNumber >= 8 && weekNumber <= 14) {
    return Math.round(baseArrivals * difficultyProfile.surgeMultiplier)
  }

  if (demandRegime === 'volatile') {
    const span = difficultyProfile.volatilityRange
    const noise = Math.floor(Math.random() * (span * 2 + 1)) - span
    return clamp(baseArrivals + noise, 1, 16)
  }

  return baseArrivals
}

function simulateNextWeek(simulationState, decisions, difficultyProfile) {
  const nextWeek = simulationState.week + 1
  const arrivals = getArrivalsForWeek(decisions.arrivals, decisions.demandRegime, nextWeek, difficultyProfile)
  const nominalCapacity = Math.max(0, decisions.clinicians * decisions.hoursPerClinician - decisions.bufferSlots)
  const disruptionRate = clamp(
    difficultyProfile.disruptionBase + (Math.random() - 0.5) * difficultyProfile.disruptionJitter,
    0,
    0.45
  )
  const availableCapacity = Math.max(0, nominalCapacity - Math.round(nominalCapacity * disruptionRate))

  const waitPressure = simulationState.waitlist / Math.max(1, simulationState.waitlist + simulationState.active)
  const targetStartShare = clamp(0.3 + waitPressure * 0.35, 0.3, 0.65)
  const newStartCapacity = Math.floor(availableCapacity * targetStartShare)
  const continuationCapacity = Math.max(0, availableCapacity - newStartCapacity)

  const queueBeforeScheduling = simulationState.waitlist + arrivals
  const newStarts = Math.min(queueBeforeScheduling, newStartCapacity)
  const waitlist = Math.max(0, queueBeforeScheduling - newStarts)

  const activePool = simulationState.active + newStarts
  const continuationVisits = Math.min(activePool, continuationCapacity)

  const baseCadenceRate = decisions.cadence === 'weekly' ? 0.12 : decisions.cadence === 'biweekly' ? 0.07 : 0.15
  const cadenceDischargeRate = baseCadenceRate * difficultyProfile.progressMultiplier
  const completed = Math.min(activePool, Math.round(activePool * cadenceDischargeRate))
  const active = Math.max(0, activePool - completed)

  const deliveredVisits = newStarts + continuationVisits
  const utilization = availableCapacity > 0 ? Math.round((deliveredVisits / availableCapacity) * 100) : 0

  const weekMetrics = {
    week: nextWeek,
    arrivals,
    capacity: availableCapacity,
    newStarts,
    continuationVisits,
    waitlist,
    active,
    completed,
    utilization: clamp(utilization, 0, 100),
  }

  return {
    ...simulationState,
    week: nextWeek,
    waitlist,
    active,
    completedTotal: simulationState.completedTotal + completed,
    history: [...simulationState.history, weekMetrics],
  }
}

function getInitialSimulationState() {
  return {
    week: 0,
    waitlist: 0,
    active: 0,
    completedTotal: 0,
    history: [],
  }
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values) {
  if (values.length <= 1) return 0
  const m = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  const w = idx - lower
  return sorted[lower] * (1 - w) + sorted[upper] * w
}

function splitTrainTest(features, labels, testRatio = 0.2) {
  const indices = features.map((_, idx) => idx)
  let seed = 42
  for (let i = indices.length - 1; i > 0; i--) {
    seed = (1664525 * seed + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  const testSize = Math.max(1, Math.floor(indices.length * testRatio))
  const testIdx = new Set(indices.slice(0, testSize))
  const trainX = []
  const trainY = []
  const testX = []
  const testY = []

  features.forEach((row, idx) => {
    if (testIdx.has(idx)) {
      testX.push(row)
      testY.push(labels[idx])
    } else {
      trainX.push(row)
      trainY.push(labels[idx])
    }
  })

  return { trainX, trainY, testX, testY }
}

function standardize(trainX, testX) {
  const featureCount = trainX[0]?.length || 0
  const means = Array.from({ length: featureCount }, (_, col) => mean(trainX.map((row) => row[col])))
  const stds = Array.from({ length: featureCount }, (_, col) => Math.max(1e-8, stdDev(trainX.map((row) => row[col]))))
  const normalize = (rows) => rows.map((row) => row.map((value, col) => (value - means[col]) / stds[col]))
  return { trainXs: normalize(trainX), testXs: normalize(testX) }
}

function trainLinearRegression(trainX, trainY, lr = 0.05, epochs = 1200) {
  const n = trainX.length
  const d = trainX[0]?.length || 0
  let weights = Array.from({ length: d }, () => 0)
  let bias = 0

  for (let i = 0; i < epochs; i++) {
    const preds = trainX.map((row) => row.reduce((sum, value, idx) => sum + value * weights[idx], bias))
    const errors = preds.map((pred, idx) => pred - trainY[idx])
    const gradW = Array.from({ length: d }, (_, j) => (2 / n) * errors.reduce((sum, err, r) => sum + err * trainX[r][j], 0))
    const gradB = (2 / n) * errors.reduce((sum, err) => sum + err, 0)
    weights = weights.map((w, j) => w - lr * gradW[j])
    bias -= lr * gradB
  }

  return { weights, bias }
}

function predictLinear(model, rows) {
  return rows.map((row) => row.reduce((sum, value, idx) => sum + value * model.weights[idx], model.bias))
}

function linearMetrics(actual, predicted) {
  if (!actual.length) return { rmse: 0, r2: 0 }
  const mse = actual.reduce((sum, y, idx) => sum + (y - predicted[idx]) ** 2, 0) / actual.length
  const rmse = Math.sqrt(mse)
  const avg = mean(actual)
  const ssTot = actual.reduce((sum, y) => sum + (y - avg) ** 2, 0)
  const ssRes = actual.reduce((sum, y, idx) => sum + (y - predicted[idx]) ** 2, 0)
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
  return { rmse, r2 }
}

function sigmoid(x) {
  if (x >= 0) {
    const z = Math.exp(-x)
    return 1 / (1 + z)
  }
  const z = Math.exp(x)
  return z / (1 + z)
}

function trainLogisticRegression(trainX, trainY, lr = 0.05, epochs = 1400) {
  const n = trainX.length
  const d = trainX[0]?.length || 0
  let weights = Array.from({ length: d }, () => 0)
  let bias = 0

  for (let i = 0; i < epochs; i++) {
    const probs = trainX.map((row) => sigmoid(row.reduce((sum, value, idx) => sum + value * weights[idx], bias)))
    const errors = probs.map((prob, idx) => prob - trainY[idx])
    const gradW = Array.from({ length: d }, (_, j) => (1 / n) * errors.reduce((sum, err, r) => sum + err * trainX[r][j], 0))
    const gradB = (1 / n) * errors.reduce((sum, err) => sum + err, 0)
    weights = weights.map((w, j) => w - lr * gradW[j])
    bias -= lr * gradB
  }

  return { weights, bias }
}

function predictLogistic(model, rows) {
  return rows.map((row) => sigmoid(row.reduce((sum, value, idx) => sum + value * model.weights[idx], model.bias)))
}

function binaryMetrics(actual, probs, threshold = 0.5) {
  if (!actual.length) return { accuracy: 0, precision: 0, recall: 0, auc: 0 }
  const preds = probs.map((p) => (p >= threshold ? 1 : 0))
  let tp = 0
  let tn = 0
  let fp = 0
  let fn = 0
  actual.forEach((y, idx) => {
    if (y === 1 && preds[idx] === 1) tp += 1
    else if (y === 0 && preds[idx] === 0) tn += 1
    else if (y === 0 && preds[idx] === 1) fp += 1
    else fn += 1
  })
  const accuracy = (tp + tn) / Math.max(1, actual.length)
  const precision = tp / Math.max(1, tp + fp)
  const recall = tp / Math.max(1, tp + fn)

  const ranked = probs.map((prob, idx) => ({ prob, label: actual[idx] })).sort((a, b) => b.prob - a.prob)
  const positives = actual.filter((value) => value === 1).length
  const negatives = actual.length - positives
  let auc = 0
  if (positives > 0 && negatives > 0) {
    let tprPrev = 0
    let fprPrev = 0
    let tpCount = 0
    let fpCount = 0
    ranked.forEach((entry) => {
      if (entry.label === 1) tpCount += 1
      else fpCount += 1
      const tpr = tpCount / positives
      const fpr = fpCount / negatives
      auc += (fpr - fprPrev) * ((tpr + tprPrev) / 2)
      tprPrev = tpr
      fprPrev = fpr
    })
  }

  return { accuracy, precision, recall, auc }
}

function runMonteCarlo(decisions, difficultyProfile, runs = 300, horizon = 24) {
  const outcomes = []
  for (let i = 0; i < runs; i++) {
    let s = getInitialSimulationState()
    for (let week = 0; week < horizon; week++) {
      s = simulateNextWeek(s, decisions, difficultyProfile)
    }
    outcomes.push({
      waitlistEnd: s.waitlist,
      completedTotal: s.completedTotal,
      avgUtilization: mean(s.history.map((entry) => entry.utilization)),
    })
  }

  const waitlistVals = outcomes.map((o) => o.waitlistEnd)
  const completedVals = outcomes.map((o) => o.completedTotal)
  const utilizationVals = outcomes.map((o) => o.avgUtilization)
  return {
    runs,
    waitlist: {
      mean: mean(waitlistVals),
      std: stdDev(waitlistVals),
      p10: percentile(waitlistVals, 0.1),
      p90: percentile(waitlistVals, 0.9),
    },
    completed: {
      mean: mean(completedVals),
      std: stdDev(completedVals),
      p10: percentile(completedVals, 0.1),
      p90: percentile(completedVals, 0.9),
    },
    utilization: {
      mean: mean(utilizationVals),
      std: stdDev(utilizationVals),
      p10: percentile(utilizationVals, 0.1),
      p90: percentile(utilizationVals, 0.9),
    },
  }
}

function CapacityPlanningMode({ onStateChange = null }) {
  const { simulationSettings } = useSimulationSettings()
  const simulationDifficulty = simulationSettings.simulationDifficulty || 'medium'
  const difficultyProfile = CAPACITY_DIFFICULTY_PROFILES[simulationDifficulty] || CAPACITY_DIFFICULTY_PROFILES.medium

  const [activeTrack, setActiveTrack] = useState(TRACKS.technical)
  const [selectedTechnicalChapterId, setSelectedTechnicalChapterId] = useState(1)
  const [selectedApplicationChapterId, setSelectedApplicationChapterId] = useState(1)
  const [decisions, setDecisions] = useState({
    clinicians: difficultyProfile.defaultDecisions.clinicians,
    hoursPerClinician: difficultyProfile.defaultDecisions.hoursPerClinician,
    bufferSlots: difficultyProfile.defaultDecisions.bufferSlots,
    arrivals: difficultyProfile.defaultDecisions.arrivals,
    demandRegime: 'normal',
    cadence: 'weekly',
  })
  const [simulationState, setSimulationState] = useState(getInitialSimulationState)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [monteCarloRuns, setMonteCarloRuns] = useState(300)
  const [monteCarloResult, setMonteCarloResult] = useState(null)
  const [regressionResult, setRegressionResult] = useState(null)

  useEffect(() => {
    if (!isAutoPlaying || simulationState.week >= HORIZON_WEEKS) return undefined

    const timerId = window.setTimeout(() => {
      setSimulationState((currentState) => simulateNextWeek(currentState, decisions, difficultyProfile))
    }, 350)

    return () => window.clearTimeout(timerId)
  }, [isAutoPlaying, simulationState.week, decisions, difficultyProfile])

  useEffect(() => {
    if (simulationState.week >= HORIZON_WEEKS) {
      setIsAutoPlaying(false)
    }
  }, [simulationState.week])

  useEffect(() => {
    setIsAutoPlaying(false)
    setSimulationState(getInitialSimulationState())
    setDecisions((prev) => ({
      ...prev,
      clinicians: difficultyProfile.defaultDecisions.clinicians,
      hoursPerClinician: difficultyProfile.defaultDecisions.hoursPerClinician,
      bufferSlots: difficultyProfile.defaultDecisions.bufferSlots,
      arrivals: difficultyProfile.defaultDecisions.arrivals,
    }))
  }, [simulationDifficulty, difficultyProfile])

  const latestWeek = simulationState.history[simulationState.history.length - 1]
  const recentHistory = simulationState.history.slice(-6).reverse()
  const activeChapters = activeTrack === TRACKS.technical ? TECHNICAL_CHAPTERS : APPLICATION_CHAPTERS
  const selectedChapterId = activeTrack === TRACKS.technical ? selectedTechnicalChapterId : selectedApplicationChapterId
  const selectedChapter = activeChapters.find((chapter) => chapter.id === selectedChapterId) || activeChapters[0]

  const utilizationSparkline = useMemo(
    () =>
      simulationState.history.map((entry) => ({
        week: entry.week,
        width: `${Math.max(2, entry.utilization)}%`,
      })),
    [simulationState.history]
  )

  const chapterTwoMode = activeTrack === TRACKS.technical && selectedChapter.id === 2
  const chapterThreeMode = activeTrack === TRACKS.technical && selectedChapter.id === 3
  const chapterFiveMode = activeTrack === TRACKS.technical && selectedChapter.id === 5
  const westfieldCaseMode = activeTrack === TRACKS.application && selectedChapter.id === 6

  const historicalArrivals = simulationState.history.map((entry) => entry.arrivals)
  const arrivalsLambda = mean(historicalArrivals)
  const arrivalsVariance = stdDev(historicalArrivals) ** 2
  const littleL = mean(simulationState.history.map((entry) => entry.waitlist))
  const littleLambda = Math.max(0.001, arrivalsLambda)
  const littleW = littleL / littleLambda

  useEffect(() => {
    if (typeof onStateChange !== 'function') return
    onStateChange({
      difficulty: simulationDifficulty,
      decisions,
      simulationState,
    })
  }, [onStateChange, simulationDifficulty, decisions, simulationState])

  function updateDecision(key, value) {
    setDecisions((prev) => ({ ...prev, [key]: value }))
  }

  function handleAdvanceWeek() {
    setSimulationState((currentState) => {
      if (currentState.week >= HORIZON_WEEKS) return currentState
      return simulateNextWeek(currentState, decisions, difficultyProfile)
    })
  }

  function handleReset() {
    setIsAutoPlaying(false)
    setSimulationState(getInitialSimulationState())
    setMonteCarloResult(null)
    setRegressionResult(null)
  }

  function handleRunMonteCarlo() {
    const runs = clamp(Math.round(monteCarloRuns), 50, 2000)
    const result = runMonteCarlo(decisions, difficultyProfile, runs, HORIZON_WEEKS)
    setMonteCarloResult(result)
  }

  function handleRunRegressionLab() {
    const history = simulationState.history
    if (history.length < 8) {
      setRegressionResult({
        error: 'Need at least 8 simulated weeks to run regression. Advance the simulation and try again.',
      })
      return
    }

    const features = []
    const targetWaitlist = []
    const targetBacklogGrowth = []
    for (let i = 0; i < history.length - 1; i++) {
      const current = history[i]
      const next = history[i + 1]
      features.push([
        current.week,
        current.arrivals,
        current.capacity,
        current.waitlist,
        current.active,
        current.utilization,
      ])
      targetWaitlist.push(next.waitlist)
      targetBacklogGrowth.push(next.waitlist > current.waitlist ? 1 : 0)
    }

    const { trainX, trainY, testX, testY } = splitTrainTest(features, targetWaitlist, 0.25)
    const { trainXs, testXs } = standardize(trainX, testX)
    const linearModel = trainLinearRegression(trainXs, trainY)
    const linearPred = predictLinear(linearModel, testXs)
    const linearEval = linearMetrics(testY, linearPred)

    const splitBinary = splitTrainTest(features, targetBacklogGrowth, 0.25)
    const standardizedBinary = standardize(splitBinary.trainX, splitBinary.testX)
    const logisticModel = trainLogisticRegression(standardizedBinary.trainXs, splitBinary.trainY)
    const logisticProbs = predictLogistic(logisticModel, standardizedBinary.testXs)
    const logisticEval = binaryMetrics(splitBinary.testY, logisticProbs)

    setRegressionResult({
      samples: features.length,
      linear: linearEval,
      logistic: logisticEval,
      targetDescription: {
        linear: 'Predict next-week waitlist size',
        logistic: 'Predict backlog growth risk (next-week waitlist increase)',
      },
    })
  }

  function handleSelectChapter(chapterId) {
    if (activeTrack === TRACKS.technical) {
      setSelectedTechnicalChapterId(chapterId)
      return
    }
    setSelectedApplicationChapterId(chapterId)
  }

  return (
    <section className="capacity-mode">
      <header className="capacity-mode-header">
        <div>
          <h2>Capacity Planning Simulation</h2>
          <p>
            Plan weekly service capacity against uncertain demand. Tune staffing and policy levers to stabilize
            waitlist growth while maintaining utilization.
          </p>
          <p className="capacity-difficulty-pill">Difficulty: {simulationDifficulty}</p>
        </div>
        <div className="capacity-mode-actions">
          <button onClick={handleAdvanceWeek} disabled={simulationState.week >= HORIZON_WEEKS}>
            Advance Week
          </button>
          <button onClick={() => setIsAutoPlaying((prev) => !prev)} disabled={simulationState.week >= HORIZON_WEEKS}>
            {isAutoPlaying ? 'Pause' : 'Auto Play'}
          </button>
          <button className="ghost" onClick={handleReset}>
            Reset
          </button>
        </div>
      </header>

      <div className="capacity-progress">
        <div className="capacity-progress-meta">
          <span>Week {simulationState.week}</span>
          <span>{HORIZON_WEEKS} week horizon</span>
        </div>
        <div className="capacity-progress-bar">
          <div style={{ width: `${(simulationState.week / HORIZON_WEEKS) * 100}%` }} />
        </div>
      </div>

      <section className="capacity-curriculum">
        <header className="curriculum-header">
          <h3>Capacity Planning Curriculum</h3>
          <div className="track-toggle">
            <button
              className={activeTrack === TRACKS.technical ? 'active' : ''}
              onClick={() => setActiveTrack(TRACKS.technical)}
            >
              Technical Chapters (1-10)
            </button>
            <button
              className={activeTrack === TRACKS.application ? 'active' : ''}
              onClick={() => setActiveTrack(TRACKS.application)}
            >
              Application Chapters (1-8)
            </button>
          </div>
        </header>

        <div className="curriculum-layout">
          <aside className="chapter-list">
            {activeTrack === TRACKS.application && (
              <button
                className="westfield-banner-pill"
                onClick={() => handleSelectChapter(6)}
              >
                <span className="westfield-banner-icon">📋</span>
                <span>
                  <strong>Westfield Case Study</strong>
                  <small>App Ch 6 — Trajectories, Q*, Waitlist</small>
                </span>
              </button>
            )}
            {activeChapters.map((chapter) => (
              <button
                key={chapter.id}
                className={`chapter-pill ${chapter.id === selectedChapter.id ? 'active' : ''} ${activeTrack === TRACKS.application && chapter.id === 6 ? 'westfield-highlight' : ''}`}
                onClick={() => handleSelectChapter(chapter.id)}
              >
                <span>Chapter {chapter.id}</span>
                <strong>{chapter.title}</strong>
              </button>
            ))}
          </aside>

          <article className="chapter-detail">
            <h4>
              Chapter {selectedChapter.id}: {selectedChapter.title}
            </h4>
            <p className="chapter-key">Key Question: {selectedChapter.keyQuestion}</p>

            {selectedChapter.coreConcepts && (
              <div className="chapter-section">
                <h5>Core Technical Concepts</h5>
                <ul>
                  {selectedChapter.coreConcepts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedChapter.operationalContext && (
              <div className="chapter-section">
                <h5>Operational Context</h5>
                <p>{selectedChapter.operationalContext}</p>
              </div>
            )}

            {selectedChapter.technicalSkills && (
              <div className="chapter-section">
                <h5>Technical Skills</h5>
                <ul>
                  {selectedChapter.technicalSkills.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedChapter.introduced && (
              <div className="chapter-section">
                <h5>What is Introduced</h5>
                <ul>
                  {selectedChapter.introduced.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedChapter.playerDecisions && (
              <div className="chapter-section">
                <h5>Player Decisions</h5>
                <ul>
                  {selectedChapter.playerDecisions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedChapter.tradeoffs && (
              <div className="chapter-section">
                <h5>Tradeoffs</h5>
                <ul>
                  {selectedChapter.tradeoffs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </div>
      </section>

      {chapterTwoMode && (
        <section className="capacity-chapter-tools">
          <header>
            <h3>Chapter II Lab: Uncertainty Modeling</h3>
            <p>
              Fit distributional assumptions from observed runs, then compare policy outcomes with Monte Carlo
              distributions instead of single trajectories.
            </p>
          </header>
          <div className="chapter-tools-grid">
            <article className="chapter-tool-card">
              <h4>Distribution Fitting (Arrivals)</h4>
              <p>Poisson fit uses historical arrivals from your current simulation history.</p>
              <div className="chapter-tool-metrics">
                <span>Estimated lambda (mean arrivals): {arrivalsLambda.toFixed(2)}</span>
                <span>Empirical variance: {arrivalsVariance.toFixed(2)}</span>
                <span>Samples: {historicalArrivals.length}</span>
              </div>
            </article>
            <article className="chapter-tool-card">
              <h4>Little&apos;s Law Approximation</h4>
              <p>Queueing sanity check from simulation output: L ≈ lambda × W.</p>
              <div className="chapter-tool-metrics">
                <span>Average waitlist L: {littleL.toFixed(2)}</span>
                <span>Average arrivals lambda: {littleLambda.toFixed(2)}</span>
                <span>Estimated W = L/lambda: {littleW.toFixed(2)} weeks</span>
              </div>
            </article>
            <article className="chapter-tool-card full">
              <h4>Monte Carlo Runner</h4>
              <div className="chapter-tool-controls">
                <label>
                  Runs: <strong>{monteCarloRuns}</strong>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={monteCarloRuns}
                    onChange={(event) => setMonteCarloRuns(Number(event.target.value))}
                  />
                </label>
                <button onClick={handleRunMonteCarlo}>Run Monte Carlo</button>
              </div>
              {monteCarloResult ? (
                <div className="chapter-tool-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Mean</th>
                        <th>Std</th>
                        <th>P10</th>
                        <th>P90</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>End Waitlist</td>
                        <td>{monteCarloResult.waitlist.mean.toFixed(1)}</td>
                        <td>{monteCarloResult.waitlist.std.toFixed(1)}</td>
                        <td>{monteCarloResult.waitlist.p10.toFixed(1)}</td>
                        <td>{monteCarloResult.waitlist.p90.toFixed(1)}</td>
                      </tr>
                      <tr>
                        <td>Completed Total</td>
                        <td>{monteCarloResult.completed.mean.toFixed(1)}</td>
                        <td>{monteCarloResult.completed.std.toFixed(1)}</td>
                        <td>{monteCarloResult.completed.p10.toFixed(1)}</td>
                        <td>{monteCarloResult.completed.p90.toFixed(1)}</td>
                      </tr>
                      <tr>
                        <td>Avg Utilization</td>
                        <td>{monteCarloResult.utilization.mean.toFixed(1)}%</td>
                        <td>{monteCarloResult.utilization.std.toFixed(1)}</td>
                        <td>{monteCarloResult.utilization.p10.toFixed(1)}%</td>
                        <td>{monteCarloResult.utilization.p90.toFixed(1)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-note">Run Monte Carlo to view outcome distributions.</p>
              )}
            </article>
          </div>
        </section>
      )}

      {chapterThreeMode && (
        <section className="capacity-chapter-tools">
          <header>
            <h3>Chapter III Lab: Predictive Analytics (Regression)</h3>
            <p>
              Train supervised models on simulated weekly data to predict next-week outcomes and operational risk.
            </p>
          </header>
          <div className="chapter-tools-grid">
            <article className="chapter-tool-card full">
              <h4>Model Runner</h4>
              <p>
                Linear target: next-week waitlist. Logistic target: backlog growth risk (whether next-week waitlist
                increases).
              </p>
              <div className="chapter-tool-controls">
                <button onClick={handleRunRegressionLab}>Train Models</button>
              </div>
              {regressionResult?.error ? (
                <p className="empty-note">{regressionResult.error}</p>
              ) : regressionResult ? (
                <div className="chapter-tool-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Metric 1</th>
                        <th>Metric 2</th>
                        <th>Metric 3</th>
                        <th>Metric 4</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Linear Regression</td>
                        <td>RMSE: {regressionResult.linear.rmse.toFixed(2)}</td>
                        <td>R2: {regressionResult.linear.r2.toFixed(2)}</td>
                        <td>Samples: {regressionResult.samples}</td>
                        <td>{regressionResult.targetDescription.linear}</td>
                      </tr>
                      <tr>
                        <td>Logistic Regression</td>
                        <td>Accuracy: {(regressionResult.logistic.accuracy * 100).toFixed(1)}%</td>
                        <td>Precision: {(regressionResult.logistic.precision * 100).toFixed(1)}%</td>
                        <td>Recall: {(regressionResult.logistic.recall * 100).toFixed(1)}%</td>
                        <td>AUC-ROC: {regressionResult.logistic.auc.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-note">Advance simulation for several weeks, then train models.</p>
              )}
            </article>
          </div>
        </section>
      )}

      {chapterFiveMode && (
        <section className="capacity-chapter-tools">
          <header>
            <h3>Chapter V Lab: Time Series Forecasting (ARIMA)</h3>
            <p>
              Explore historical visit data, learn ARIMA concepts step-by-step, tune (p,d,q) parameters interactively,
              and generate Python code for real forecasting.
            </p>
          </header>
          <div className="chapter-tools-grid">
            <article className="chapter-tool-card full">
              <ARIMALab />
            </article>
          </div>
        </section>
      )}

      {westfieldCaseMode && (
        <section className="capacity-chapter-tools westfield-case-section">
          <header>
            <h3>Application Chapter 6 Lab: Westfield Children&apos;s Centre Case Study</h3>
            <p>
              From clinical notes to optimal service policies. Cluster children by progress trajectory, derive
              reassessment timing (Q*) using the newsvendor audit model, and project capacity savings for the waitlist.
            </p>
          </header>
          <div className="chapter-tools-grid">
            <article className="chapter-tool-card full">
              <WestfieldCaseLab />
            </article>
          </div>
        </section>
      )}

      <div className="capacity-layout">
        <aside className="capacity-controls">
          <h3>Planning Levers</h3>
          <label>
            Clinicians: <strong>{decisions.clinicians}</strong>
            <input
              type="range"
              min="1"
              max="8"
              value={decisions.clinicians}
              onChange={(event) => updateDecision('clinicians', Number(event.target.value))}
            />
          </label>
          <label>
            Hours per Clinician: <strong>{decisions.hoursPerClinician}</strong>
            <input
              type="range"
              min="2"
              max="10"
              value={decisions.hoursPerClinician}
              onChange={(event) => updateDecision('hoursPerClinician', Number(event.target.value))}
            />
          </label>
          <label>
            Protected Buffer Slots: <strong>{decisions.bufferSlots}</strong>
            <input
              type="range"
              min="0"
              max="6"
              value={decisions.bufferSlots}
              onChange={(event) => updateDecision('bufferSlots', Number(event.target.value))}
            />
          </label>
          <label>
            Base Arrivals / Week: <strong>{decisions.arrivals}</strong>
            <input
              type="range"
              min="1"
              max="10"
              value={decisions.arrivals}
              onChange={(event) => updateDecision('arrivals', Number(event.target.value))}
            />
          </label>

          <label>
            Demand Regime
            <select value={decisions.demandRegime} onChange={(event) => updateDecision('demandRegime', event.target.value)}>
              <option value="normal">Normal</option>
              <option value="surge">Surge (weeks 8-14)</option>
              <option value="volatile">Volatile</option>
            </select>
          </label>

          <label>
            Cadence Policy
            <select value={decisions.cadence} onChange={(event) => updateDecision('cadence', event.target.value)}>
              <option value="weekly">Weekly follow-ups</option>
              <option value="biweekly">Biweekly follow-ups</option>
              <option value="intensive">Intensive blocks</option>
            </select>
          </label>
        </aside>

        <div className="capacity-results">
          <div className="capacity-metrics">
            <article>
              <span>Waitlist</span>
              <strong>{latestWeek?.waitlist ?? 0}</strong>
            </article>
            <article>
              <span>Active Caseload</span>
              <strong>{latestWeek?.active ?? 0}</strong>
            </article>
            <article>
              <span>Utilization</span>
              <strong>{latestWeek?.utilization ?? 0}%</strong>
            </article>
            <article>
              <span>Completed (Total)</span>
              <strong>{simulationState.completedTotal}</strong>
            </article>
          </div>

          <section className="capacity-panel">
            <h3>Utilization Trend</h3>
            {utilizationSparkline.length === 0 && <p className="empty-note">Advance a week to start the simulation.</p>}
            <div className="utilization-bars">
              {utilizationSparkline.map((entry) => (
                <div key={entry.week} className="utilization-row">
                  <span>W{entry.week}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: entry.width }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="capacity-panel">
            <h3>Recent Weekly Outcomes</h3>
            {recentHistory.length === 0 ? (
              <p className="empty-note">No results yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Arrivals</th>
                    <th>Starts</th>
                    <th>Waitlist</th>
                    <th>Util</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHistory.map((entry) => (
                    <tr key={entry.week}>
                      <td>{entry.week}</td>
                      <td>{entry.arrivals}</td>
                      <td>{entry.newStarts}</td>
                      <td>{entry.waitlist}</td>
                      <td>{entry.utilization}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

export default CapacityPlanningMode
