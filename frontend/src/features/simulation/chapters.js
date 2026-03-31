export const SIMULATION_CHAPTERS = [
  {
    id: 1,
    title: 'Descriptive Analytics: Understanding the System',
    keyQuestion: 'What is happening in the system?',
    summary: 'Review baseline data and learn to interpret KPI dashboards before making decisions.',
    coreConcepts: ['Summary statistics', 'Distributions', 'Dashboards', 'KPI design'],
    technicalSkills: [
      'Design utilization, wait time, and throughput KPIs',
      'Compare distributions vs point estimates',
      'Distinguish leading vs lagging indicators',
      'Run cohort and time-series summaries',
    ],
    operationalContext:
      'Students begin with a pre-run baseline and historical system data to understand current performance.',
    notesLabEnabled: false,
    allowsHistoryTab: false,
  },
  {
    id: 2,
    title: 'Probability and Simulation Foundations',
    keyQuestion: 'How do we model a system under uncertainty?',
    summary: 'Introduce stochastic arrivals and repeated runs so learners see variability in outcomes.',
    coreConcepts: ['Discrete-event simulation', 'Probability distributions', 'Monte Carlo', 'Little’s Law'],
    technicalSkills: [
      'Fit distributions to empirical patterns',
      'Run and interpret Monte Carlo experiments',
      'Explain variance across repeated runs',
      'Compare deterministic and stochastic behavior',
    ],
    operationalContext:
      'Demand shifts from deterministic to stochastic so the same policy can produce different outcomes.',
    notesLabEnabled: false,
    allowsHistoryTab: true,
  },
  {
    id: 3,
    title: 'Predictive Analytics I: Regression',
    keyQuestion: 'Given what we know now, what outcome should we expect?',
    summary: 'Frame prediction tasks for wait times and cancellation risk using supervised regression methods.',
    coreConcepts: ['Linear regression', 'Logistic regression'],
    technicalSkills: [
      'Frame continuous vs categorical targets',
      'Use train/test and cross-validation',
      'Evaluate RMSE, R2, precision, recall, and AUC',
      'Interpret coefficients and calibration limits',
    ],
    operationalContext:
      'Use simulation-generated data to predict wait time and cancellation probability from operational features.',
    notesLabEnabled: false,
    allowsHistoryTab: true,
  },
  {
    id: 4,
    title: 'Predictive Analytics II: Tree-Based Methods',
    keyQuestion: 'Which factors matter most for outcomes?',
    summary: 'Use decision trees and random forests to capture nonlinear patterns and feature interactions.',
    coreConcepts: ['Decision trees', 'Random forest', 'Feature importance'],
    technicalSkills: [
      'Train tree-based supervised models',
      'Compare linear and nonlinear model behavior',
      'Use feature importance for interpretation',
      'Validate model robustness across samples',
    ],
    operationalContext:
      'Model outcomes under richer nonlinear dynamics and compare predictive lift versus regression baselines.',
    notesLabEnabled: false,
    allowsHistoryTab: true,
  },
  {
    id: 5,
    title: 'Predictive Analytics III: Forecasting',
    keyQuestion: 'What will demand look like next month?',
    summary: 'Forecast referral arrivals with time-series methods and quantify forecast uncertainty.',
    coreConcepts: ['ARIMA', 'Trend decomposition', 'Seasonality', 'Forecast intervals'],
    technicalSkills: [
      'Decompose trend, seasonality, and noise',
      'Select and fit ARIMA models',
      'Communicate forecast uncertainty',
      'Use forecasts as planning inputs',
    ],
    operationalContext:
      'Demand is explicitly time-varying, requiring forecasts to guide staffing and scheduling plans.',
    notesLabEnabled: false,
    allowsHistoryTab: true,
  },
  {
    id: 6,
    title: 'Prescriptive Analytics I: Optimization',
    keyQuestion: 'Given predictions and constraints, what should we do?',
    summary: 'Move from predicting outcomes to optimizing scheduling and capacity allocation decisions.',
    coreConcepts: ['Linear programming', 'Integer programming', 'Heuristics', 'Scheduling optimization'],
    technicalSkills: [
      'Formulate objectives and constraints',
      'Solve LP/IP planning formulations',
      'Run sensitivity analysis',
      'Compare optimization with heuristic rules',
    ],
    operationalContext:
      'Allocate clinician capacity between competing needs under explicit operational constraints.',
    notesLabEnabled: false,
    allowsHistoryTab: true,
  },
  {
    id: 7,
    title: 'Prescriptive Analytics II: Multi-Objective and Equity-Aware Optimization',
    keyQuestion: 'How do we optimize for multiple competing goals?',
    summary: 'Balance throughput, access, and fairness using explicit multi-objective policy tradeoffs.',
    coreConcepts: ['Multi-objective optimization', 'Pareto frontiers', 'Fairness constraints'],
    technicalSkills: [
      'Visualize Pareto frontiers',
      'Use weighted objectives and penalties',
      'Design hard constraints vs soft penalties',
      'Evaluate robustness under uncertainty',
    ],
    operationalContext:
      'Efficient policies may be inequitable, so equity constraints are integrated into decision design.',
    notesLabEnabled: true,
    allowsHistoryTab: true,
  },
  {
    id: 8,
    title: 'Unsupervised Learning and NLP',
    keyQuestion: 'How can unstructured data guide operations?',
    summary: 'Extract structure from clinical notes and link discovered groups to operational strategy.',
    coreConcepts: ['Clustering', 'Text embeddings', 'NLP extraction'],
    technicalSkills: [
      'Preprocess notes and generate embeddings',
      'Run and interpret clustering models',
      'Choose cluster counts and validate structure',
      'Connect clusters to care pathway decisions',
    ],
    operationalContext:
      'Clinical notes are transformed into operational signals to support pathway and discharge decisions.',
    notesLabEnabled: true,
    allowsHistoryTab: true,
  },
  {
    id: 9,
    title: 'Large Language Models for Decision Support',
    keyQuestion: 'How reliable are LLM outputs for operational decisions?',
    summary: 'Use LLM extraction and summarization with explicit quality checks and human review.',
    coreConcepts: ['Prompt engineering', 'Structured extraction', 'LLM evaluation'],
    technicalSkills: [
      'Design extraction prompts',
      'Evaluate consistency and hallucination risk',
      'Measure precision against expected outputs',
      'Design human-in-the-loop safeguards',
    ],
    operationalContext:
      'LLMs provide note-derived structured signals that are evaluated before being used in operations.',
    notesLabEnabled: true,
    allowsHistoryTab: true,
  },
  {
    id: 10,
    title: 'Agentic AI and Automated Decision Loops',
    keyQuestion: 'How do we design systems that act intelligently over time?',
    summary: 'Combine analytics modules into an agentic pipeline with escalation and guardrails.',
    coreConcepts: ['Agentic systems', 'Tool use', 'Automated decision pipelines'],
    technicalSkills: [
      'Define weekly decision-loop architecture',
      'Specify autonomous vs escalated actions',
      'Instrument agent behavior over time',
      'Detect policy drift and overfitting',
    ],
    operationalContext:
      'An agent monitors state, proposes actions, and executes approved interventions with oversight.',
    notesLabEnabled: true,
    allowsHistoryTab: true,
  },
]

export const DEFAULT_CHAPTER_ID = 1

export function getChapterById(chapterId) {
  return SIMULATION_CHAPTERS.find((chapter) => chapter.id === chapterId) || SIMULATION_CHAPTERS[0]
}
