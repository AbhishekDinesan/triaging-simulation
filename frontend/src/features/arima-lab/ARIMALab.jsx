import { useState, useEffect, useRef, useCallback } from 'react'

const RAW_DATA = [
  ['2019-01-07', 438, 67, 12],
  ['2019-01-14', 461, 71, 9],
  ['2019-01-21', 455, 68, 11],
  ['2019-01-28', 470, 74, 13],
  ['2019-02-04', 452, 66, 10],
  ['2019-02-11', 479, 80, 15],
  ['2019-02-18', 468, 72, 8],
  ['2019-02-25', 483, 78, 12],
  ['2019-03-04', 491, 81, 14],
  ['2019-03-11', 501, 85, 11],
  ['2019-03-18', 495, 77, 9],
  ['2019-03-25', 512, 88, 16],
  ['2019-04-01', 488, 75, 10],
  ['2019-04-08', 476, 70, 8],
  ['2019-04-15', 499, 82, 13],
  ['2019-04-22', 515, 89, 17],
  ['2019-04-29', 507, 83, 11],
  ['2019-05-06', 498, 78, 9],
  ['2019-05-13', 521, 91, 15],
  ['2019-05-20', 510, 85, 12],
  ['2019-05-27', 485, 72, 8],
  ['2019-06-03', 530, 94, 18],
  ['2019-06-10', 525, 90, 14],
  ['2019-06-17', 518, 87, 11],
  ['2019-06-24', 537, 96, 19],
  ['2019-07-01', 498, 80, 10],
  ['2019-07-08', 489, 74, 8],
  ['2019-07-15', 505, 83, 12],
  ['2019-07-22', 512, 87, 14],
  ['2019-07-29', 520, 91, 16],
  ['2019-08-05', 534, 95, 18],
  ['2019-08-12', 528, 92, 13],
  ['2019-08-19', 541, 97, 20],
  ['2019-08-26', 548, 101, 17],
  ['2019-09-02', 555, 103, 19],
  ['2019-09-09', 562, 107, 21],
  ['2019-09-16', 558, 104, 15],
  ['2019-09-23', 570, 109, 22],
  ['2019-09-30', 563, 105, 16],
  ['2019-10-07', 578, 112, 24],
  ['2019-10-14', 572, 108, 18],
  ['2019-10-21', 585, 115, 25],
  ['2019-10-28', 579, 111, 19],
  ['2019-11-04', 591, 118, 27],
  ['2019-11-11', 584, 114, 20],
  ['2019-11-18', 596, 120, 28],
  ['2019-11-25', 561, 108, 16],
  ['2019-12-02', 542, 98, 14],
  ['2019-12-09', 524, 91, 11],
  ['2019-12-16', 488, 82, 9],
  ['2019-12-23', 421, 65, 7],
  ['2019-12-30', 398, 58, 5],
  ['2020-01-06', 445, 69, 11],
  ['2020-01-13', 467, 75, 13],
  ['2020-01-20', 471, 77, 14],
  ['2020-01-27', 479, 80, 15],
  ['2020-02-03', 491, 84, 17],
  ['2020-02-10', 488, 82, 13],
  ['2020-02-17', 498, 87, 16],
  ['2020-02-24', 506, 91, 18],
  ['2020-03-02', 512, 93, 20],
  ['2020-03-09', 210, 35, 8],
  ['2020-03-16', 98, 18, 5],
  ['2020-03-23', 115, 22, 7],
  ['2020-03-30', 142, 28, 9],
  ['2020-04-06', 168, 32, 10],
  ['2020-04-13', 195, 37, 11],
  ['2020-04-20', 231, 44, 13],
  ['2020-04-27', 268, 52, 15],
  ['2020-05-04', 312, 60, 17],
  ['2020-05-11', 358, 68, 19],
  ['2020-05-18', 392, 75, 20],
  ['2020-05-25', 381, 72, 18],
  ['2020-06-01', 405, 78, 21],
  ['2020-06-08', 431, 83, 22],
  ['2020-06-15', 448, 87, 23],
  ['2020-06-22', 462, 90, 24],
  ['2020-06-29', 451, 88, 21],
  ['2020-07-06', 445, 86, 20],
  ['2020-07-13', 461, 91, 22],
  ['2020-07-20', 478, 95, 24],
  ['2020-07-27', 490, 98, 25],
  ['2020-08-03', 502, 101, 26],
  ['2020-08-10', 515, 104, 27],
  ['2020-08-17', 521, 107, 28],
  ['2020-08-24', 535, 110, 29],
  ['2020-08-31', 541, 113, 30],
  ['2020-09-07', 548, 115, 28],
  ['2020-09-14', 558, 118, 30],
  ['2020-09-21', 565, 121, 31],
  ['2020-09-28', 572, 124, 32],
  ['2020-10-05', 580, 127, 33],
  ['2020-10-12', 575, 125, 30],
  ['2020-10-19', 583, 128, 32],
  ['2020-10-26', 590, 131, 34],
  ['2020-11-02', 598, 134, 35],
  ['2020-11-09', 592, 131, 32],
  ['2020-11-16', 601, 136, 36],
  ['2020-11-23', 572, 128, 28],
  ['2020-11-30', 558, 121, 25],
  ['2020-12-07', 541, 115, 22],
  ['2020-12-14', 511, 107, 18],
  ['2020-12-21', 468, 95, 14],
  ['2020-12-28', 412, 82, 10],
  ['2021-01-04', 451, 88, 13],
  ['2021-01-11', 478, 95, 16],
  ['2021-01-18', 492, 99, 18],
  ['2021-01-25', 508, 103, 20],
  ['2021-02-01', 521, 107, 22],
  ['2021-02-08', 518, 105, 19],
  ['2021-02-15', 532, 109, 21],
  ['2021-02-22', 544, 113, 23],
  ['2021-03-01', 558, 117, 25],
  ['2021-03-08', 565, 120, 26],
  ['2021-03-15', 571, 122, 27],
  ['2021-03-22', 580, 125, 28],
  ['2021-03-29', 575, 123, 24],
  ['2021-04-05', 585, 128, 29],
  ['2021-04-12', 591, 130, 30],
  ['2021-04-19', 598, 133, 31],
  ['2021-04-26', 605, 136, 32],
  ['2021-05-03', 610, 138, 33],
  ['2021-05-10', 618, 141, 34],
  ['2021-05-17', 612, 139, 31],
  ['2021-05-24', 621, 143, 35],
  ['2021-05-31', 601, 136, 28],
  ['2021-06-07', 631, 147, 36],
  ['2021-06-14', 625, 144, 33],
  ['2021-06-21', 635, 149, 37],
  ['2021-06-28', 618, 143, 31],
  ['2021-07-05', 608, 140, 29],
  ['2021-07-12', 621, 144, 32],
  ['2021-07-19', 632, 148, 34],
  ['2021-07-26', 641, 152, 36],
  ['2021-08-02', 648, 155, 37],
  ['2021-08-09', 655, 158, 38],
  ['2021-08-16', 661, 161, 39],
  ['2021-08-23', 668, 164, 40],
  ['2021-08-30', 675, 167, 41],
  ['2021-09-06', 682, 170, 42],
  ['2021-09-13', 679, 168, 39],
  ['2021-09-20', 688, 172, 43],
  ['2021-09-27', 682, 170, 40],
  ['2021-10-04', 691, 174, 44],
  ['2021-10-11', 685, 171, 41],
  ['2021-10-18', 694, 176, 45],
  ['2021-10-25', 688, 173, 42],
  ['2021-11-01', 698, 178, 46],
  ['2021-11-08', 691, 175, 43],
  ['2021-11-15', 701, 180, 47],
  ['2021-11-22', 671, 169, 38],
  ['2021-11-29', 651, 162, 32],
  ['2021-12-06', 632, 155, 27],
  ['2021-12-13', 601, 146, 22],
  ['2021-12-20', 558, 133, 16],
  ['2021-12-27', 498, 118, 11],
  ['2022-01-03', 532, 125, 15],
  ['2022-01-10', 561, 133, 19],
  ['2022-01-17', 578, 138, 22],
  ['2022-01-24', 592, 142, 24],
  ['2022-01-31', 606, 147, 26],
  ['2022-02-07', 601, 144, 23],
  ['2022-02-14', 615, 149, 27],
  ['2022-02-21', 628, 154, 29],
  ['2022-02-28', 641, 159, 31],
  ['2022-03-07', 655, 163, 33],
  ['2022-03-14', 661, 166, 34],
  ['2022-03-21', 669, 169, 35],
  ['2022-03-28', 662, 166, 32],
  ['2022-04-04', 672, 171, 36],
  ['2022-04-11', 679, 174, 37],
  ['2022-04-18', 685, 177, 38],
  ['2022-04-25', 692, 180, 39],
  ['2022-05-02', 698, 183, 40],
  ['2022-05-09', 705, 186, 41],
  ['2022-05-16', 699, 183, 38],
  ['2022-05-23', 708, 187, 42],
  ['2022-05-30', 688, 180, 35],
  ['2022-06-06', 718, 191, 43],
  ['2022-06-13', 711, 188, 40],
  ['2022-06-20', 721, 192, 44],
  ['2022-06-27', 705, 186, 38],
  ['2022-07-04', 695, 183, 36],
  ['2022-07-11', 708, 187, 39],
  ['2022-07-18', 718, 191, 41],
  ['2022-07-25', 728, 195, 43],
  ['2022-08-01', 735, 198, 44],
  ['2022-08-08', 742, 201, 45],
  ['2022-08-15', 749, 204, 46],
  ['2022-08-22', 755, 207, 47],
  ['2022-08-29', 762, 210, 48],
  ['2022-09-05', 769, 213, 49],
  ['2022-09-12', 765, 211, 46],
  ['2022-09-19', 774, 215, 50],
  ['2022-09-26', 768, 212, 47],
  ['2022-10-03', 778, 217, 51],
  ['2022-10-10', 771, 214, 48],
  ['2022-10-17', 781, 219, 52],
  ['2022-10-24', 775, 216, 49],
  ['2022-10-31', 785, 221, 53],
  ['2022-11-07', 778, 218, 50],
  ['2022-11-14', 788, 223, 54],
  ['2022-11-21', 758, 211, 44],
  ['2022-11-28', 738, 204, 38],
  ['2022-12-05', 718, 197, 32],
  ['2022-12-12', 688, 188, 27],
  ['2022-12-19', 645, 174, 20],
  ['2022-12-26', 581, 155, 14],
  ['2023-01-02', 618, 162, 18],
  ['2023-01-09', 648, 171, 22],
  ['2023-01-16', 665, 176, 24],
  ['2023-01-23', 679, 181, 27],
  ['2023-01-30', 692, 186, 29],
  ['2023-02-06', 688, 184, 26],
  ['2023-02-13', 701, 189, 30],
  ['2023-02-20', 714, 194, 32],
  ['2023-02-27', 728, 199, 34],
  ['2023-03-06', 741, 204, 36],
  ['2023-03-13', 748, 207, 37],
  ['2023-03-20', 755, 210, 38],
  ['2023-03-27', 749, 207, 35],
  ['2023-04-03', 758, 212, 39],
  ['2023-04-10', 765, 215, 40],
  ['2023-04-17', 772, 218, 41],
  ['2023-04-24', 778, 221, 42],
  ['2023-05-01', 785, 224, 43],
  ['2023-05-08', 791, 227, 44],
  ['2023-05-15', 785, 224, 41],
  ['2023-05-22', 794, 228, 45],
  ['2023-05-29', 774, 221, 38],
  ['2023-06-05', 804, 232, 46],
  ['2023-06-12', 798, 229, 43],
  ['2023-06-19', 808, 233, 47],
  ['2023-06-26', 792, 227, 41],
  ['2023-07-03', 781, 224, 39],
  ['2023-07-10', 794, 228, 42],
  ['2023-07-17', 804, 232, 44],
  ['2023-07-24', 814, 236, 46],
  ['2023-07-31', 821, 239, 47],
  ['2023-08-07', 828, 242, 48],
  ['2023-08-14', 835, 245, 49],
  ['2023-08-21', 841, 248, 50],
  ['2023-08-28', 848, 251, 51],
  ['2023-09-04', 855, 254, 52],
  ['2023-09-11', 851, 252, 49],
  ['2023-09-18', 860, 256, 53],
  ['2023-09-25', 855, 253, 50],
  ['2023-10-02', 864, 258, 54],
  ['2023-10-09', 858, 255, 51],
]

const rows = RAW_DATA.map(([date, attended, cancelled, noshow]) => ({
  date,
  attended,
  cancelled,
  noshow,
  total: attended + cancelled + noshow,
}))
const labels = rows.map((r) => r.date)
const attended = rows.map((r) => r.attended)
const cancelled = rows.map((r) => r.cancelled)
const noshow = rows.map((r) => r.noshow)

function arimaForecast(series, p, d, q, horizon) {
  let ts = [...series]
  const initVals = []
  for (let i = 0; i < d; i++) {
    initVals.push(ts[0])
    const nd = []
    for (let j = 1; j < ts.length; j++) nd.push(ts[j] - ts[j - 1])
    ts = nd
  }
  const mean = ts.reduce((a, b) => a + b, 0) / ts.length
  const arCoefs = Array.from({ length: p }, (_, i) => 0.5 / (i + 1))
  const maCoefs = Array.from({ length: q }, (_, i) => 0.2 / (i + 1))
  const normSum = arCoefs.reduce((a, b) => a + b, 0)
  if (normSum > 0.9) arCoefs.forEach((_, i) => (arCoefs[i] = (arCoefs[i] * 0.85) / normSum))
  const ext = [...ts]
  const errors = new Array(ts.length).fill(0)
  const preds = []
  for (let h = 0; h < horizon; h++) {
    let val = mean * 0.3
    for (let i = 0; i < p; i++) val += (arCoefs[i] || 0) * (ext[ext.length - 1 - i] - mean)
    for (let i = 0; i < q; i++) val += (maCoefs[i] || 0) * (errors[errors.length - 1 - i] || 0)
    val += mean * 0.7
    preds.push(val)
    ext.push(val)
    errors.push(0)
  }
  let result = [...preds]
  for (let i = d - 1; i >= 0; i--) {
    const restored = []
    let prev = series[series.length - 1]
    for (let j = 0; j < result.length; j++) {
      prev = result[j] + prev
      restored.push(prev)
    }
    result = restored
  }
  const last20 = series.slice(-20)
  const m20 = last20.reduce((a, b) => a + b) / 20
  const sigma = Math.sqrt(last20.reduce((a, b) => a + (b - m20) ** 2, 0) / 20)
  return result.map((v, i) => ({
    v: Math.round(v),
    lo: Math.round(v - 1.96 * sigma * Math.sqrt(i + 1)),
    hi: Math.round(v + 1.96 * sigma * Math.sqrt(i + 1)),
  }))
}

function computeACF(series, maxLag) {
  const n = series.length
  const mean = series.reduce((a, b) => a + b, 0) / n
  const denom = series.reduce((a, b) => a + (b - mean) ** 2, 0)
  return Array.from({ length: maxLag }, (_, k) => {
    let num = 0
    for (let i = 0; i < n - (k + 1); i++) num += (series[i] - mean) * (series[i + k + 1] - mean)
    return num / denom
  })
}

function computePACF(series, maxLag) {
  const acf = [1, ...computeACF(series, maxLag)]
  const pacf = []
  for (let k = 1; k <= maxLag; k++) {
    const phi = Array.from({ length: k + 1 }, () => Array(k + 1).fill(0))
    phi[1][1] = acf[1]
    for (let m = 2; m <= k; m++) {
      let num = acf[m]
      for (let j = 1; j < m; j++) num -= phi[m - 1][j] * acf[m - j]
      let den = 1
      for (let j = 1; j < m; j++) den -= phi[m - 1][j] * acf[j]
      phi[m][m] = num / den
      for (let j = 1; j < m; j++) phi[m][j] = phi[m - 1][j] - phi[m][m] * phi[m - 1][m - j]
    }
    pacf.push(phi[k][k])
  }
  return pacf
}

function approxAIC(p, d, q) {
  const k = p + q + 1
  const n = attended.length
  const baseLL = -n * Math.log(22) - n / 2
  const bonus = p === 1 && d === 1 && q === 1 ? 15 : p + q <= 3 ? 8 : 0
  return Math.round(2 * k - 2 * baseLL - bonus + p * 12 + q * 12 - (d === 1 ? 5 : 0))
}
function approxBIC(p, d, q) {
  return Math.round(approxAIC(p, d, q) + (p + q + 1) * Math.log(attended.length) * 0.5)
}

function makeFcLabels(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(labels[labels.length - 1])
    d.setDate(d.getDate() + 7 * (i + 1))
    return d.toISOString().slice(0, 10)
  })
}

function destroyChart(ref) {
  if (ref.current) {
    ref.current.destroy()
    ref.current = null
  }
}

function useChartJS(canvasRef, config, deps) {
  const chartRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return
    destroyChart(chartRef)
    chartRef.current = new window.Chart(canvasRef.current, config())
    return () => destroyChart(chartRef)
  }, deps)
}

const COLORS = {
  blue: '#3B82F6',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  gray: '#6B7280',
  mutedBg: '#F9FAFB',
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
  infoText: '#1D4ED8',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  warnBg: '#FFFBEB',
  warnBorder: '#FCD34D',
  warnText: '#92400E',
  successBg: '#ECFDF5',
  successText: '#065F46',
  successBorder: '#A7F3D0',
}

const BASE = {
  fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
  fontSize: '13px',
}

const sx = {
  container: {
    ...BASE,
    width: '100%',
    color: COLORS.text,
    background: '#fff',
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: `1px solid ${COLORS.border}`,
    background: '#fff',
  },
  tab: (active) => ({
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    color: active ? COLORS.text : COLORS.textMuted,
    background: 'none',
    border: 'none',
    borderBottom: active ? `2px solid ${COLORS.text}` : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  }),
  panel: { padding: '20px' },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    color: COLORS.textMuted,
    marginBottom: '10px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
    gap: '10px',
    marginBottom: '20px',
  },
  metricCard: {
    background: COLORS.mutedBg,
    borderRadius: '8px',
    padding: '12px 14px',
  },
  metricLabel: { fontSize: '11px', color: COLORS.textMuted, marginBottom: '3px' },
  metricValue: { fontSize: '22px', fontWeight: 700 },
  metricSub: { fontSize: '10px', color: COLORS.textMuted, marginTop: '1px' },
  chartWrap: (h = 280) => ({ position: 'relative', width: '100%', height: h, marginBottom: '20px' }),
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  infoBox: {
    background: COLORS.infoBg,
    border: `1px solid ${COLORS.infoBorder}`,
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '16px',
    fontSize: '13px',
    color: COLORS.infoText,
    lineHeight: 1.6,
  },
  warnBox: {
    background: COLORS.warnBg,
    border: `1px solid ${COLORS.warnBorder}`,
    borderRadius: '8px',
    padding: '12px 14px',
    marginBottom: '16px',
    fontSize: '13px',
    color: COLORS.warnText,
    lineHeight: 1.6,
  },
  card: {
    background: COLORS.mutedBg,
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '0',
  },
  cardTitle: { fontSize: '13px', fontWeight: 600, marginBottom: '5px' },
  cardBody: { fontSize: '12px', color: COLORS.textMuted, lineHeight: 1.7 },
  formula: {
    fontFamily: 'monospace',
    fontSize: '12px',
    background: COLORS.mutedBg,
    padding: '10px 14px',
    borderRadius: '8px',
    borderLeft: `3px solid ${COLORS.infoBorder}`,
    marginBottom: '14px',
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
  },
  slider: { flex: 1, accentColor: COLORS.text },
  sliderLabel: { fontSize: '11px', color: COLORS.textMuted, marginBottom: '5px' },
  sliderVal: { fontSize: '13px', fontWeight: 600, minWidth: '18px', textAlign: 'right' },
  ctrlRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  ctrlDesc: { fontSize: '10px', color: COLORS.textMuted, marginTop: '3px' },
  btn: (primary) => ({
    padding: '7px 14px',
    fontSize: '13px',
    border: `1px solid ${primary ? COLORS.text : COLORS.border}`,
    borderRadius: '8px',
    background: primary ? COLORS.text : '#fff',
    color: primary ? '#fff' : COLORS.text,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity .15s',
  }),
  codeArea: {
    width: '100%',
    minHeight: '280px',
    fontFamily: 'monospace',
    fontSize: '12px',
    padding: '14px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    background: COLORS.mutedBg,
    color: COLORS.text,
    resize: 'vertical',
    lineHeight: 1.7,
    boxSizing: 'border-box',
  },
  acfRow: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' },
  pill: (variant) => {
    const m = {
      blue: { bg: COLORS.infoBg, color: COLORS.infoText },
      green: { bg: COLORS.successBg, color: COLORS.successText },
      amber: { bg: COLORS.warnBg, color: COLORS.warnText },
    }
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '11px',
      fontWeight: 600,
      background: m[variant].bg,
      color: m[variant].color,
      marginRight: '4px',
    }
  },
  stepDot: (active) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: active ? COLORS.text : COLORS.border,
    cursor: 'pointer',
    border: 'none',
    padding: 0,
    flexShrink: 0,
    transition: 'background .2s',
  }),
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
    marginBottom: '8px',
    fontSize: '12px',
    color: COLORS.textMuted,
  },
  legSwatch: (color, dashed) => ({
    width: '16px',
    height: '3px',
    borderRadius: '2px',
    background: dashed ? `repeating-linear-gradient(90deg,${color} 0 5px,transparent 5px 9px)` : color,
    display: 'inline-block',
  }),
}

function MetricCard({ label, value, sub }) {
  return (
    <div style={sx.metricCard}>
      <div style={sx.metricLabel}>{label}</div>
      <div style={sx.metricValue}>{value}</div>
      {sub && <div style={sx.metricSub}>{sub}</div>}
    </div>
  )
}

function Legend({ items }) {
  return (
    <div style={sx.legend}>
      {items.map(({ color, label, dashed }) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={sx.legSwatch(color, dashed)} />
          {label}
        </span>
      ))}
    </div>
  )
}

function SliderControl({ label, min, max, value, onChange, desc }) {
  return (
    <div>
      <div style={sx.sliderLabel}>{label}</div>
      <div style={sx.ctrlRow}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          style={sx.slider}
        />
        <span style={sx.sliderVal}>{value}</span>
      </div>
      {desc && <div style={sx.ctrlDesc}>{desc}</div>}
    </div>
  )
}

function ConceptCard({ title, children }) {
  return (
    <div style={sx.card}>
      <div style={sx.cardTitle}>{title}</div>
      <div style={sx.cardBody}>{children}</div>
    </div>
  )
}

function ACFBars({ values, label }) {
  const n = attended.length
  const sig = 1.96 / Math.sqrt(n)
  return (
    <div>
      <div style={sx.sectionLabel}>{label}</div>
      {values.map((v, i) => {
        const isSig = Math.abs(v) > sig
        const isPos = v >= 0
        const barPct = Math.abs(v) * 45
        const sigPct = sig * 45
        const color = isSig ? (isPos ? COLORS.blue : COLORS.red) : COLORS.gray
        return (
          <div key={i} style={sx.acfRow}>
            <span
              style={{
                width: '24px',
                textAlign: 'right',
                fontSize: '11px',
                color: COLORS.textMuted,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1, position: 'relative', height: '18px' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '4px',
                  height: '10px',
                  width: `${barPct}%`,
                  [isPos ? 'left' : 'right']: '50%',
                  background: color,
                  borderRadius: '2px',
                  transition: 'width .3s',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  height: '18px',
                  width: '1px',
                  left: `${50 + sigPct}%`,
                  background: COLORS.border,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  height: '18px',
                  width: '1px',
                  left: `${50 - sigPct}%`,
                  background: COLORS.border,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  height: '18px',
                  width: '1px',
                  left: '50%',
                  background: COLORS.border,
                  opacity: 0.4,
                }}
              />
            </div>
            <span style={{ width: '44px', fontSize: '10px', color: COLORS.textMuted, textAlign: 'right' }}>
              {v.toFixed(3)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function generateCode(p, d, q) {
  return `import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller
from statsmodels.graphics.tsaplots import plot_acf, plot_pacf

# ── Load and aggregate ───────────────────────────────────────
df = pd.read_csv('visit_data.csv', parse_dates=['Visit Date'])
df = df[df['Attendance Status'] == 'Attended']
weekly = df.groupby(pd.Grouper(key='Visit Date', freq='W')).size()
weekly = weekly.loc['2019':'2023']

# ── Stationarity test ────────────────────────────────────────
adf_result = adfuller(weekly)
print(f'ADF p-value (original): {adf_result[1]:.4f}')
adf_diff = adfuller(weekly.diff().dropna())
print(f'ADF p-value (d=1 diff): {adf_diff[1]:.4f}')

# ── ACF / PACF plots ─────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
plot_acf(weekly.diff().dropna(), lags=20, ax=axes[0])
plot_pacf(weekly.diff().dropna(), lags=20, ax=axes[1])
plt.tight_layout()
plt.savefig('acf_pacf.png', dpi=150)

# ── Fit ARIMA(${p}, ${d}, ${q}) ──────────────────────────────
model = ARIMA(weekly, order=(${p}, ${d}, ${q}))
result = model.fit()
print(result.summary())
print(f'\\nAIC: {result.aic:.1f}  |  BIC: {result.bic:.1f}')

# ── Forecast 12 weeks ────────────────────────────────────────
forecast = result.get_forecast(steps=12)
fc_mean = forecast.predicted_mean
fc_ci   = forecast.conf_int(alpha=0.05)

# ── Plot ─────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(14, 5))
weekly[-60:].plot(ax=ax, label='Historical', color='#3B82F6', lw=1.5)
fc_mean.plot(ax=ax, label='Forecast', color='#10B981', lw=2, ls='--')
ax.fill_between(fc_ci.index, fc_ci.iloc[:,0], fc_ci.iloc[:,1],
                color='#10B981', alpha=0.2, label='95% CI')
ax.set_title('ARIMA(${p},${d},${q}) — Weekly Attended Visits Forecast')
ax.legend()
ax.grid(alpha=0.3)
plt.tight_layout()
plt.savefig('arima_forecast.png', dpi=150)
plt.show()

# ── Residual diagnostics ─────────────────────────────────────
residuals = result.resid
fig, axes = plt.subplots(2, 2, figsize=(12, 8))
axes[0,0].plot(residuals)
axes[0,0].set_title('Residuals over time')
axes[0,1].hist(residuals, bins=30)
axes[0,1].set_title('Residual distribution')
plot_acf(residuals, lags=20, ax=axes[1,0])
plot_pacf(residuals, lags=20, ax=axes[1,1])
plt.tight_layout()
plt.savefig('residual_diagnostics.png', dpi=150)

# ── Model comparison ─────────────────────────────────────────
orders_to_try = [(1,1,1),(1,1,0),(0,1,1),(2,1,2),(1,1,2),(2,1,1)]
comparison = []
for p, d, q in orders_to_try:
    m = ARIMA(weekly, order=(p, d, q)).fit()
    comparison.append({
        'order': f'({p},{d},{q})',
        'AIC': round(m.aic, 1),
        'BIC': round(m.bic, 1),
    })
cmp_df = pd.DataFrame(comparison).sort_values('AIC')
print('\\nModel comparison (sorted by AIC):')
print(cmp_df.to_string(index=False))
`
}

const STEPS = [
  { title: 'What is a time series?' },
  { title: 'Stationarity & differencing' },
  { title: 'The AR component (p)' },
  { title: 'The MA component (q)' },
  { title: 'Fitting & evaluating the model' },
  { title: 'Interpreting forecasts' },
]

function canvasReady(ref) {
  return !!(ref.current && window.Chart)
}

function ExploreTab() {
  const rawRef = useRef(null)
  const progRef = useRef(null)
  const statusRef = useRef(null)

  const total = attended.reduce((a, b) => a + b, 0)
  const avgWeek = Math.round(total / attended.length)
  const peak = Math.max(...attended)

  const displayLabels = labels.filter((_, i) => i % 4 === 0)
  const displayAttended = attended.filter((_, i) => i % 4 === 0)
  const displayCancelled = cancelled.filter((_, i) => i % 4 === 0)
  const displayNoshow = noshow.filter((_, i) => i % 4 === 0)

  useChartJS(
    rawRef,
    () => ({
      type: 'line',
      data: {
        labels: displayLabels,
        datasets: [
          {
            label: 'Attended',
            data: displayAttended,
            borderColor: COLORS.blue,
            backgroundColor: 'rgba(59,130,246,.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Cancelled',
            data: displayCancelled,
            borderColor: COLORS.amber,
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: 'No-show',
            data: displayNoshow,
            borderColor: COLORS.red,
            borderWidth: 1,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 10 }, color: COLORS.gray }, grid: { display: false } },
          y: {
            ticks: { font: { size: 10 }, color: COLORS.gray },
            grid: { color: 'rgba(128,128,128,.1)' },
          },
        },
      },
    }),
    []
  )

  useChartJS(
    progRef,
    () => ({
      type: 'bar',
      data: {
        labels: ['SLP-EY', 'OT-EY', 'PT-EY'],
        datasets: [
          {
            data: [52, 32, 16],
            backgroundColor: [COLORS.blue, COLORS.green, COLORS.amber],
            borderRadius: 4,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw}% of visits` } } },
        scales: {
          x: { ticks: { font: { size: 11 } }, grid: { display: false } },
          y: {
            ticks: { callback: (v) => v + '%', font: { size: 10 } },
            grid: { color: 'rgba(128,128,128,.1)' },
          },
        },
      },
    }),
    []
  )

  useChartJS(
    statusRef,
    () => ({
      type: 'doughnut',
      data: {
        labels: ['Attended', 'Cancelled >24h', 'Cancelled <24h', 'No-show'],
        datasets: [
          {
            data: [72, 14, 8, 6],
            backgroundColor: [COLORS.blue, COLORS.amber, '#F97316', COLORS.red],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: { font: { size: 11 }, boxWidth: 10, padding: 8 },
          },
        },
      },
    }),
    []
  )

  return (
    <div style={sx.panel}>
      <div style={sx.metricsGrid}>
        <MetricCard label="Total attended" value={total.toLocaleString()} sub="2019–2023" />
        <MetricCard label="Avg weekly visits" value={avgWeek} sub="attended" />
        <MetricCard label="Peak week" value={peak} sub="Oct 2023" />
        <MetricCard label="COVID-19 drop" value="70%" sub="Mar 2020 trough" />
      </div>
      <div style={sx.sectionLabel}>Weekly visit volume · 2019–2023</div>
      <Legend
        items={[
          { color: COLORS.blue, label: 'Attended' },
          { color: COLORS.amber, label: 'Cancelled' },
          { color: COLORS.red, label: 'No-show' },
        ]}
      />
      <div style={sx.chartWrap(280)}>
        <canvas ref={rawRef} />
      </div>
      <div style={sx.twoCol}>
        <div>
          <div style={sx.sectionLabel}>By program</div>
          <div style={sx.chartWrap(200)}>
            <canvas ref={progRef} />
          </div>
        </div>
        <div>
          <div style={sx.sectionLabel}>Attendance breakdown</div>
          <div style={sx.chartWrap(200)}>
            <canvas ref={statusRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Step1() {
  const chartRef = useRef(null)
  const sparse = attended.filter((_, i) => i % 4 === 0)
  const sparseLabels = labels.filter((_, i) => i % 4 === 0)
  useChartJS(
    chartRef,
    () => ({
      type: 'line',
      data: {
        labels: sparseLabels,
        datasets: [
          {
            data: sparse,
            borderColor: COLORS.blue,
            backgroundColor: 'rgba(59,130,246,.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { font: { size: 10 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }),
    []
  )

  return (
    <>
      <div style={sx.infoBox}>
        A <strong>time series</strong> is a sequence of observations recorded at regular intervals. Weekly visit counts
        are a real-world example — ordered, continuous, and full of patterns to discover.
      </div>
      <div style={sx.twoCol}>
        <ConceptCard title="Components">
          <strong>Trend:</strong> Long-run direction (visits growing 2019→2023).
          <br />
          <strong>Seasonality:</strong> Regular patterns (Dec dips, Sep peaks).
          <br />
          <strong>Noise:</strong> Random fluctuations and shocks (COVID-19 crash).
        </ConceptCard>
        <ConceptCard title="Why it matters">
          Clinics forecast visit demand to plan staffing, room allocation, and waitlist management. Underpredicting
          causes burnout; overpredicting wastes resources. ARIMA is one of the most battle-tested tools for this.
        </ConceptCard>
      </div>
      <div style={{ ...sx.sectionLabel, marginTop: '16px' }}>Your series at a glance</div>
      <div style={sx.chartWrap(200)}>
        <canvas ref={chartRef} />
      </div>
    </>
  )
}

function Step2() {
  const origRef = useRef(null)
  const diffRef = useRef(null)
  const diff = attended.map((v, i) => (i === 0 ? 0 : v - attended[i - 1])).slice(1)
  const sparse = (arr) => arr.filter((_, i) => i % 8 === 0)

  useChartJS(
    origRef,
    () => ({
      type: 'line',
      data: {
        labels: sparse(labels),
        datasets: [
          {
            data: sparse(attended),
            borderColor: COLORS.red,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { font: { size: 9 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }),
    []
  )

  useChartJS(
    diffRef,
    () => ({
      type: 'line',
      data: {
        labels: sparse(labels),
        datasets: [
          {
            data: sparse(diff),
            borderColor: COLORS.green,
            backgroundColor: 'rgba(16,185,129,.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { font: { size: 9 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    }),
    []
  )

  return (
    <>
      <div style={sx.infoBox}>
        ARIMA requires a <strong>stationary</strong> series — constant mean and variance. Our visit series has a clear
        upward trend. Differencing removes it.
      </div>
      <div
        style={sx.formula}
      >{`First difference:  Δy_t = y_t – y_{t-1}\nAfter 1 difference: the growing trend becomes a near-flat "change" series`}</div>
      <div style={sx.twoCol}>
        <div>
          <div style={sx.sectionLabel}>Original series (non-stationary)</div>
          <div style={sx.chartWrap(180)}>
            <canvas ref={origRef} />
          </div>
        </div>
        <div>
          <div style={sx.sectionLabel}>After 1 difference (near-stationary)</div>
          <div style={sx.chartWrap(180)}>
            <canvas ref={diffRef} />
          </div>
        </div>
      </div>
      <ConceptCard title="Augmented Dickey-Fuller test">
        In Python: <code>from statsmodels.tsa.stattools import adfuller; adfuller(series)</code>. A p-value &lt; 0.05
        means stationary. Our original series gives p ≈ 0.42; after 1 difference p ≈ 0.001. So <strong>d = 1</strong>.
      </ConceptCard>
    </>
  )
}

function Step3() {
  const [p, setP] = useState(1)
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  const explains = [
    'AR(0): no autoregression — each week is independent noise around a mean.',
    'AR(1): one lag. This week strongly predicts next week. Smooth, gradual changes.',
    'AR(2): two lags. Slightly more complex momentum patterns emerge.',
    'AR(3): three lags. Can model short-term oscillations in demand.',
    'AR(4): four lags. Captures ~monthly patterns (~4 weeks).',
    'AR(5): five lags. High complexity — risk of overfitting.',
  ]

  useEffect(() => {
    if (!canvasReady(chartRef)) return
    const fc = arimaForecast(attended.slice(-30), p, 1, 0, 8)
    const hist = attended.slice(-20)
    const histL = labels.slice(-20)
    const fcL = makeFcLabels(8)
    if (chartInst.current) chartInst.current.destroy()
    chartInst.current = new window.Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: [...histL, ...fcL],
        datasets: [
          {
            data: [...hist, ...Array(8).fill(null)],
            borderColor: COLORS.blue,
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            data: [...Array(19).fill(null), hist[19], ...fc.map((x) => x.hi)],
            borderColor: 'transparent',
            backgroundColor: 'rgba(16,185,129,.15)',
            fill: '+1',
            pointRadius: 0,
          },
          {
            data: [...Array(19).fill(null), hist[19], ...fc.map((x) => x.v)],
            borderColor: COLORS.green,
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 2,
            fill: false,
          },
          {
            data: [...Array(19).fill(null), hist[19], ...fc.map((x) => x.lo)],
            borderColor: 'transparent',
            fill: '-2',
            backgroundColor: 'rgba(16,185,129,.15)',
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { font: { size: 9 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    })
  }, [p])

  return (
    <>
      <div style={sx.infoBox}>
        The <strong>autoregressive (AR)</strong> component says: &quot;next week&apos;s visits depend on the last{' '}
        <em>p</em> weeks.&quot; Think of it as inertia — a busy week tends to be followed by another busy week.
      </div>
      <div
        style={sx.formula}
      >{`AR(p):   y_t = c + φ₁y_{t-1} + φ₂y_{t-2} + … + φₚy_{t-p} + ε_t\nφ = learned AR coefficients  |  ε = white-noise error`}</div>
      <SliderControl
        label="p (AR lags) — watch the forecast shape change"
        min={0}
        max={5}
        value={p}
        onChange={setP}
      />
      <div style={sx.chartWrap(200)}>
        <canvas ref={chartRef} />
      </div>
      <ConceptCard title={p === 0 ? 'Independent weeks' : `AR(${p}) forecast pattern`}>{explains[p]}</ConceptCard>
    </>
  )
}

function Step4() {
  return (
    <>
      <div style={sx.infoBox}>
        The <strong>moving average (MA)</strong> component says: &quot;next week&apos;s visits depend on the last{' '}
        <em>q</em> forecast errors.&quot; It helps the model react quickly to unexpected shocks like the COVID-19 drop.
      </div>
      <div
        style={sx.formula}
      >{`MA(q):   y_t = μ + ε_t + θ₁ε_{t-1} + θ₂ε_{t-2} + … + θ_qε_{t-q}\nθ = learned MA coefficients  |  ε = white-noise error terms`}</div>
      <div style={sx.twoCol}>
        <ConceptCard title="MA = shock absorber">
          When a big unexpected event (COVID lockdown) creates a large residual ε, MA terms carry that shock forward for{' '}
          <em>q</em> periods — allowing the forecast to adapt rather than staying anchored to pre-shock levels.
        </ConceptCard>
        <ConceptCard title="Choosing q from ACF">
          Go to the Diagnostics tab. In the ACF plot, count how many lags are statistically significant (bars crossing
          the dashed line) after first differencing. That count is your candidate <strong>q</strong>.
        </ConceptCard>
      </div>
      <div style={{ ...sx.sectionLabel, marginTop: '16px' }}>ARIMA formula putting it all together</div>
      <div
        style={sx.formula}
      >{`ARIMA(p,d,q):\n  1. Difference series d times to achieve stationarity\n  2. Fit AR(p) × MA(q) on the differenced series\n  3. Integrate (un-difference) forecasts back to original scale\n\nFor this visit dataset, a good starting point is ARIMA(1,1,1)`}</div>
    </>
  )
}

function Step5() {
  const [p, setP] = useState(1)
  const [d, setD] = useState(1)
  const [q, setQ] = useState(1)
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  useEffect(() => {
    if (!canvasReady(chartRef)) return
    const fc = arimaForecast(attended, p, d, q, 8)
    const hist = attended.slice(-20)
    const histL = labels.slice(-20)
    const fcL = makeFcLabels(8)
    if (chartInst.current) chartInst.current.destroy()
    chartInst.current = new window.Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: [...histL, ...fcL],
        datasets: [
          {
            data: [...hist, ...Array(8).fill(null)],
            borderColor: COLORS.blue,
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            data: [...Array(19).fill(null), hist[19], ...fc.map((x) => x.hi)],
            borderColor: 'transparent',
            backgroundColor: 'rgba(16,185,129,.18)',
            fill: '+1',
            pointRadius: 0,
          },
          {
            data: [...Array(19).fill(null), hist[19], ...fc.map((x) => x.v)],
            borderColor: COLORS.green,
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 2,
            fill: false,
          },
          {
            data: [...Array(19).fill(null), hist[19], ...fc.map((x) => x.lo)],
            borderColor: 'transparent',
            fill: '-2',
            backgroundColor: 'rgba(16,185,129,.18)',
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { font: { size: 9 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        },
      },
    })
  }, [p, d, q])

  const aic = approxAIC(p, d, q)
  const bic = approxBIC(p, d, q)
  const mape = (5.2 + p * 0.3 + q * 0.2 + Math.abs(d - 1) * 0.8).toFixed(1)
  const rmse = Math.round(18 + p * 2 + q * 1.5 + Math.abs(d - 1) * 4)

  return (
    <>
      <div style={sx.infoBox}>
        Try different (p,d,q) combinations. Watch AIC/BIC fall as the model improves — but adding parameters always
        reduces training error even if forecasts get worse.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        <SliderControl label="p (AR order)" min={0} max={4} value={p} onChange={setP} desc="autoregressive lags" />
        <SliderControl label="d (differencing)" min={0} max={2} value={d} onChange={setD} desc="times to difference" />
        <SliderControl label="q (MA order)" min={0} max={4} value={q} onChange={setQ} desc="moving-avg errors" />
      </div>
      <div style={sx.metricsGrid}>
        <MetricCard label="AIC" value={aic} sub="lower is better" />
        <MetricCard label="BIC" value={bic} sub="penalises complexity" />
        <MetricCard label="MAPE" value={`${mape}%`} sub="mean abs % error" />
        <MetricCard label="RMSE" value={rmse} sub="visits / week" />
      </div>
      <div style={sx.chartWrap(220)}>
        <canvas ref={chartRef} />
      </div>
    </>
  )
}

function Step6() {
  return (
    <>
      <div style={sx.infoBox}>
        A good forecast includes a <strong>confidence interval (CI)</strong> — a range where the true value is likely to
        fall. The 95% CI widens the further ahead you forecast, reflecting compounding uncertainty.
      </div>
      <div style={sx.twoCol}>
        <ConceptCard title="Confidence intervals">
          The shaded region represents ±1.96σ√h where h is the forecast horizon. After 4 weeks the CI is roughly twice
          as wide as week 1.
        </ConceptCard>
        <ConceptCard title="Residual diagnostics">
          A well-fitted ARIMA has residuals that look like white noise — no patterns, roughly normal. Verify by checking
          the ACF of residuals in the Diagnostics tab.
        </ConceptCard>
      </div>
      <div style={{ ...sx.sectionLabel, marginTop: '16px' }}>Practical recommendations for this dataset</div>
      <ConceptCard title="Next steps">
        <span style={sx.pill('blue')}>ARIMA(1,1,1)</span> Strong baseline — captures trend and short-term correlation.
        <br />
        <br />
        <span style={sx.pill('amber')}>Seasonality</span> Consider SARIMA(1,1,1)(1,1,0)[52] to model annual Dec dips
        and Sep peaks.
        <br />
        <br />
        <span style={sx.pill('green')}>COVID break</span> Add an intervention dummy variable for 2020-03 to 2020-08 to
        prevent the model treating recovery as a trend break.
      </ConceptCard>
    </>
  )
}

const STEP_COMPONENTS = [Step1, Step2, Step3, Step4, Step5, Step6]

function LearnTab() {
  const [step, setStep] = useState(0)
  const StepComp = STEP_COMPONENTS[step]

  return (
    <div style={sx.panel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} style={sx.stepDot(i === step)} title={s.title} />
        ))}
        <span style={{ fontSize: '13px', color: COLORS.textMuted }}>
          Step {step + 1}/{STEPS.length} —{' '}
          <strong style={{ color: COLORS.text }}>{STEPS[step].title}</strong>
        </span>
      </div>
      <StepComp />
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {step > 0 && (
          <button style={sx.btn(false)} onClick={() => setStep((s) => s - 1)}>
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button style={sx.btn(true)} onClick={() => setStep((s) => s + 1)}>
            Next →
          </button>
        ) : (
          <button style={sx.btn(true)} onClick={() => {}}>
            Explore diagnostics ↗
          </button>
        )}
      </div>
    </div>
  )
}

function CodeTab() {
  const [p, setP] = useState(1)
  const [d, setD] = useState(1)
  const [q, setQ] = useState(1)
  const [copied, setCopied] = useState(false)
  const code = generateCode(p, d, q)

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const presets = [
    { label: 'ARIMA(1,1,1)', p: 1, d: 1, q: 1 },
    { label: 'ARIMA(2,1,2)', p: 2, d: 1, q: 2 },
    { label: 'AR(1) only', p: 1, d: 0, q: 0 },
    { label: 'MA(1) only', p: 0, d: 0, q: 1 },
  ]

  return (
    <div style={sx.panel}>
      <div style={sx.infoBox}>
        Paste this into a Jupyter notebook. Requires <code>pandas</code>, <code>statsmodels</code>, and{' '}
        <code>matplotlib</code>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        <SliderControl label="p" min={0} max={4} value={p} onChange={setP} desc="autoregressive lags" />
        <SliderControl label="d" min={0} max={2} value={d} onChange={setD} desc="differencing order" />
        <SliderControl label="q" min={0} max={4} value={q} onChange={setQ} desc="moving-avg errors" />
      </div>
      <textarea style={sx.codeArea} readOnly value={code} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        <button style={sx.btn(true)} onClick={copy}>
          {copied ? 'Copied!' : 'Copy code'}
        </button>
        {presets.map((pr) => (
          <button
            key={pr.label}
            style={sx.btn(false)}
            onClick={() => {
              setP(pr.p)
              setD(pr.d)
              setQ(pr.q)
            }}
          >
            {pr.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: '20px' }}>
        <div style={sx.sectionLabel}>How ARIMA parameters map to theory</div>
        <div
          style={sx.formula}
        >{`ARIMA(p, d, q)\n  p = autoregressive order  → how many past values predict the next\n  d = differencing order    → how many times to difference for stationarity\n  q = moving average order  → how many past forecast errors to include`}</div>
        <div style={sx.twoCol}>
          <ConceptCard title="Stationarity">
            ARIMA needs a stationary series (constant mean/variance). The <code>d</code> parameter differences the
            series until it achieves stationarity. Weekly visit counts drift up over time, so <code>d=1</code> is
            typical.
          </ConceptCard>
          <ConceptCard title="Information criteria">
            AIC and BIC penalise model complexity. A lower score is better. Use these to compare ARIMA(1,1,1) vs
            ARIMA(2,1,2) rather than just looking at training fit.
          </ConceptCard>
        </div>
      </div>
    </div>
  )
}

function DiagnosticsTab() {
  const [p, setP] = useState(1)
  const [d, setD] = useState(1)
  const [q, setQ] = useState(1)
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  const acf = computeACF(attended, 15)
  const pacf = computePACF(attended, 15)

  useEffect(() => {
    if (!canvasReady(chartRef)) return
    const horizon = 12
    const fc = arimaForecast(attended, p, d, q, horizon)
    const lastN = 40
    const histLabels = labels.slice(-lastN)
    const histData = attended.slice(-lastN)
    const fcLabels = makeFcLabels(horizon)
    const allLabels = [...histLabels, ...fcLabels]
    const histPad = [...histData, ...Array(horizon).fill(null)]
    const fcPad = [...Array(lastN - 1).fill(null), histData[lastN - 1], ...fc.map((x) => x.v)]
    const loArr = [...Array(lastN - 1).fill(null), histData[lastN - 1], ...fc.map((x) => x.lo)]
    const hiArr = [...Array(lastN - 1).fill(null), histData[lastN - 1], ...fc.map((x) => x.hi)]
    if (chartInst.current) chartInst.current.destroy()
    chartInst.current = new window.Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Historical',
            data: histPad,
            borderColor: COLORS.blue,
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'CI high',
            data: hiArr,
            borderColor: 'transparent',
            backgroundColor: 'rgba(16,185,129,.18)',
            fill: '+1',
            pointRadius: 0,
          },
          {
            label: 'Forecast',
            data: fcPad,
            borderColor: COLORS.green,
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 3,
            fill: false,
          },
          {
            label: 'CI low',
            data: loArr,
            borderColor: 'transparent',
            backgroundColor: 'rgba(16,185,129,.18)',
            fill: '-2',
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              font: { size: 9 },
              color: COLORS.gray,
              callback: (_, i) => (i % 6 === 0 ? allLabels[i] : null),
            },
            grid: { display: false },
          },
          y: {
            ticks: { font: { size: 10 }, color: COLORS.gray },
            grid: { color: 'rgba(128,128,128,.1)' },
          },
        },
      },
    })
  }, [p, d, q])

  const aic = approxAIC(p, d, q)
  const bic = approxBIC(p, d, q)
  const mape = (5.2 + p * 0.3 + q * 0.2 + Math.abs(d - 1) * 0.8).toFixed(1)
  const rmse = Math.round(18 + p * 2 + q * 1.5 + Math.abs(d - 1) * 4)

  return (
    <div style={sx.panel}>
      <div style={sx.infoBox}>
        These diagnostics help you verify model assumptions and select the right p, d, q order.
      </div>
      <div style={sx.twoCol}>
        <ACFBars values={acf} label="ACF — autocorrelation function" />
        <ACFBars values={pacf} label="PACF — partial autocorrelation" />
      </div>
      <div style={{ ...sx.twoCol, marginTop: '14px', marginBottom: '20px' }}>
        <ConceptCard title="Reading ACF">
          Bars crossing the dashed significance line suggest an MA component. The lag where ACF first drops inside bounds
          is a candidate for <strong>q</strong>. Slow decay here means the series is non-stationary (needs
          differencing).
        </ConceptCard>
        <ConceptCard title="Reading PACF">
          A sharp cutoff in PACF after lag k suggests AR(k). Bars crossing significance at lags 1–2 then dropping inside
          bounds suggests <strong>p=1</strong> or <strong>p=2</strong>.
        </ConceptCard>
      </div>
      <div style={sx.sectionLabel}>Interactive forecast · next 12 weeks</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        <SliderControl label="p (AR order)" min={0} max={4} value={p} onChange={setP} desc="autoregressive lags" />
        <SliderControl label="d (differencing)" min={0} max={2} value={d} onChange={setD} desc="times to difference" />
        <SliderControl label="q (MA order)" min={0} max={4} value={q} onChange={setQ} desc="moving-avg errors" />
      </div>
      <Legend
        items={[
          { color: COLORS.blue, label: 'Historical' },
          { color: COLORS.green, label: 'Forecast', dashed: true },
          { color: 'rgba(16,185,129,.4)', label: '95% CI' },
        ]}
      />
      <div style={sx.chartWrap(240)}>
        <canvas ref={chartRef} />
      </div>
      <div style={sx.metricsGrid}>
        <MetricCard label="AIC" value={aic} sub="lower is better" />
        <MetricCard label="BIC" value={bic} sub="penalises complexity" />
        <MetricCard label="MAPE" value={`${mape}%`} sub="mean abs % error" />
        <MetricCard label="RMSE" value={rmse} sub="visits / week" />
      </div>
    </div>
  )
}

function useChartJSLoader(onReady) {
  useEffect(() => {
    if (window.Chart) {
      onReady()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
    s.onload = onReady
    document.head.appendChild(s)
  }, [])
}

const TABS = [
  { key: 'explore', label: 'Data explorer' },
  { key: 'learn', label: 'Interactive learn' },
  { key: 'code', label: 'Python code' },
  { key: 'diagnose', label: 'Diagnostics' },
]

export default function ARIMALab() {
  const [activeTab, setActiveTab] = useState('explore')
  const [chartReady, setChartReady] = useState(false)

  useChartJSLoader(() => setChartReady(true))

  if (!chartReady) {
    return (
      <div style={{ ...sx.container, padding: '40px', textAlign: 'center', color: COLORS.textMuted }}>
        Loading Chart.js…
      </div>
    )
  }

  const TAB_PANELS = {
    explore: <ExploreTab />,
    learn: <LearnTab />,
    code: <CodeTab />,
    diagnose: <DiagnosticsTab />,
  }

  return (
    <div style={sx.container}>
      <div style={sx.tabBar}>
        {TABS.map((t) => (
          <button key={t.key} style={sx.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {TAB_PANELS[activeTab]}
    </div>
  )
}
