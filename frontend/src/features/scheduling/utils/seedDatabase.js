import { collection, doc, setDoc, writeBatch, getDocs } from 'firebase/firestore'
import { firestoreDatabase } from '../../../shared/firebase/firebaseConfig'

const COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#22c55e',
  '#eab308',
  '#3b82f6',
  '#e11d48',
  '#0ea5e9',
  '#d946ef',
  '#65a30d',
  '#fb923c',
  '#2dd4bf',
]

const DIFFICULTY_PROFILES = {
  easy: {
    clientCount: 40,
    clinicianCount: 5,
    followupTxRate: 0.82,
    extraDischargedRate: 0.22,
    dischargedTwoBlockRate: 0.7,
    midblockStartRate: 0.15,
    completedRate: 0.9,
    noShowRate: 0.05,
    cancelOver24hRate: 0.04,
    cancelUnder24hRate: 0.01,
    bookingLeadMinDays: 7,
    bookingLeadMaxDays: 45,
    referralToAxMinDays: 14,
    referralToAxMaxDays: 90,
    breakMinMonths: 2,
    breakMaxMonths: 3,
    partialSecondBlockMinTx: 3,
    partialSecondBlockMaxTx: 5,
  },
  medium: {
    clientCount: 70,
    clinicianCount: 7,
    followupTxRate: 0.7,
    extraDischargedRate: 0.45,
    dischargedTwoBlockRate: 0.55,
    midblockStartRate: 0.3,
    completedRate: 0.82,
    noShowRate: 0.08,
    cancelOver24hRate: 0.06,
    cancelUnder24hRate: 0.04,
    bookingLeadMinDays: 3,
    bookingLeadMaxDays: 35,
    referralToAxMinDays: 21,
    referralToAxMaxDays: 120,
    breakMinMonths: 2,
    breakMaxMonths: 4,
    partialSecondBlockMinTx: 1,
    partialSecondBlockMaxTx: 5,
  },
  hard: {
    clientCount: 110,
    clinicianCount: 9,
    followupTxRate: 0.52,
    extraDischargedRate: 0.62,
    dischargedTwoBlockRate: 0.4,
    midblockStartRate: 0.48,
    completedRate: 0.68,
    noShowRate: 0.14,
    cancelOver24hRate: 0.1,
    cancelUnder24hRate: 0.08,
    bookingLeadMinDays: 1,
    bookingLeadMaxDays: 21,
    referralToAxMinDays: 35,
    referralToAxMaxDays: 160,
    breakMinMonths: 2,
    breakMaxMonths: 5,
    partialSecondBlockMinTx: 1,
    partialSecondBlockMaxTx: 3,
  },
}

const JOURNEY_PLAN = {
  DISCHARGED_ONE_BLOCK_DONE: 'discharged_one_block_done',
  DISCHARGED_TWO_BLOCKS_DONE: 'discharged_two_blocks_done',
  ACTIVE_ONE_BLOCK_PLUS_RAX: 'active_one_block_plus_rax',
  ACTIVE_SECOND_BLOCK_IN_PROGRESS: 'active_second_block_in_progress',
}

function mapVisitTypeToAppointmentType(visitType) {
  const type = visitType?.toLowerCase() || ''
  if (type.includes('assessment') || type.includes('re-assessment')) return 'AX'
  if (type.includes('service planning')) return 'SP'
  if (type.includes('block')) return 'BLOCK'
  return 'BLOCK'
}

function parseCSV(csvString) {
  const lines = csvString.trim().split('\n')
  const headers = lines[0].split(',')

  return lines.slice(1).map((line) => {
    const values = []
    let current = ''
    let inQuotes = false

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    const record = {}
    headers.forEach((header, index) => {
      record[header.trim()] = values[index] || ''
    })
    return record
  })
}

async function seedRecords(records, onProgress = console.log) {
  const clientIds = [...new Set(records.map((r) => r.client_id))]
  const clinicianIds = [...new Set(records.map((r) => r.clinician_id))]

  onProgress(`Found ${clientIds.length} unique clients`)
  onProgress(`Found ${clinicianIds.length} unique clinicians`)

  onProgress('Seeding clinicians...')
  for (let i = 0; i < clinicianIds.length; i++) {
    const clinicianId = clinicianIds[i]
    const clinicianNum = parseInt(clinicianId.replace(/\D/g, '')) || i + 1

    await setDoc(doc(firestoreDatabase, 'clinicians', clinicianId), {
      id: clinicianId,
      name: clinicianId,
      color: COLORS[(clinicianNum - 1) % COLORS.length],
      createdAt: new Date().toISOString(),
    })
  }
  onProgress(`✓ Seeded ${clinicianIds.length} clinicians`)

  onProgress('Seeding clients...')
  for (let i = 0; i < clientIds.length; i++) {
    const clientId = clientIds[i]

    const clientVisits = records.filter((r) => r.client_id === clientId)
    const hasBookedVisits = clientVisits.some((v) => v.status === 'Booked')
    const allCompleted = clientVisits.every(
      (v) => v.status === 'Completed' || v.status.includes('Cancelled') || v.status === 'No-show'
    )

    await setDoc(doc(firestoreDatabase, 'clients', clientId), {
      id: clientId,
      name: `Client ${clientId}`,
      age: null,
      diagnosis: 'See referral',
      priority: 'medium',
      referralNotes: '',
      status: hasBookedVisits ? 'active' : allCompleted ? 'completed' : 'pending',
      createdAt: new Date().toISOString(),
    })

    if ((i + 1) % 50 === 0) {
      onProgress(`  Processed ${i + 1}/${clientIds.length} clients...`)
    }
  }
  onProgress(`✓ Seeded ${clientIds.length} clients`)

  onProgress('Seeding visits (appointments)...')
  const BATCH_SIZE = 450

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestoreDatabase)
    const batchRecords = records.slice(i, i + BATCH_SIZE)

    for (let j = 0; j < batchRecords.length; j++) {
      const record = batchRecords[j]
      const visitId = `${record.client_id}_${record.scheduled_start.replace(/[^0-9]/g, '')}_${i + j}`
      const appointmentType = mapVisitTypeToAppointmentType(record.visit_type)

      batch.set(doc(firestoreDatabase, 'visits', visitId), {
        id: visitId,
        clientId: record.client_id,
        clinicianId: record.clinician_id,
        appointmentType: appointmentType,
        visitType: record.visit_type,
        bookingDatetime: record.booking_datetime,
        scheduledDate: record.scheduled_start,
        scheduledStart: record.scheduled_start,
        scheduledEnd: record.scheduled_end,
        status: record.status,
        cancelDatetime: record.cancel_datetime || null,
      })
    }

    await batch.commit()
    onProgress(`  Committed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)}`)
  }
  onProgress(`Seeded ${records.length} visits`)

  onProgress('Seeding complete!')
  return { clients: clientIds.length, clinicians: clinicianIds.length, visits: records.length }
}

function createRng(seed = 42) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)]
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function addMonths(dateObj, months) {
  const next = new Date(dateObj)
  next.setMonth(next.getMonth() + months)
  return next
}

function chooseStatus(rng, profile) {
  const roll = rng()
  if (roll < profile.completedRate) return 'Completed'
  if (roll < profile.completedRate + profile.noShowRate) return 'No-show'
  if (roll < profile.completedRate + profile.noShowRate + profile.cancelOver24hRate) return 'Cancelled (>24h)'
  return 'Cancelled (<24h)'
}

function buildVisitRecord({ rng, profile, clientId, clinicianId, visitType, scheduledStart, forceBooked = false }) {
  const durationMinutes =
    visitType === 'AX' || visitType === 'RAX' ? Math.max(30, 75 + randomInt(rng, -10, 10)) : Math.max(30, 45 + randomInt(rng, -5, 5))
  const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000)
  const bookingLeadDays = randomInt(rng, profile.bookingLeadMinDays, profile.bookingLeadMaxDays)
  const bookingDatetime = new Date(
    scheduledStart.getTime() -
      (bookingLeadDays * 24 * 60 + randomInt(rng, 0, 23) * 60 + randomInt(rng, 0, 59)) * 60 * 1000
  )

  const status = forceBooked ? 'Booked' : chooseStatus(rng, profile)
  let cancelDatetime = ''
  if (status.startsWith('Cancelled')) {
    const hoursBefore = status.includes('>24h') ? randomInt(rng, 25, 120) : randomInt(rng, 1, 23)
    const cancelledAt = new Date(scheduledStart.getTime() - (hoursBefore * 60 + randomInt(rng, 0, 59)) * 60 * 1000)
    cancelDatetime = cancelledAt > bookingDatetime ? cancelledAt.toISOString() : new Date(bookingDatetime.getTime() + 60 * 60 * 1000).toISOString()
  }

  return {
    client_id: clientId,
    clinician_id: clinicianId,
    visit_type: visitType,
    booking_datetime: bookingDatetime.toISOString(),
    scheduled_start: scheduledStart.toISOString(),
    scheduled_end: scheduledEnd.toISOString(),
    status,
    cancel_datetime: cancelDatetime,
  }
}

function generateMockRecords(difficulty = 'medium', seed = 42) {
  const profile = DIFFICULTY_PROFILES[difficulty] || DIFFICULTY_PROFILES.medium
  const rng = createRng(seed)

  const clinicianIds = Array.from({ length: profile.clinicianCount }, (_, idx) => `CLIN${String(idx + 1).padStart(2, '0')}`)
  const clientIds = Array.from({ length: profile.clientCount }, (_, idx) => `C${String(idx + 1).padStart(4, '0')}`)
  const records = []
  const now = new Date()

  function nextWeeklySession(previousStart) {
    const next = new Date(previousStart)
    next.setDate(next.getDate() + randomInt(rng, 6, 9))
    next.setHours(pick(rng, [8, 9, 10, 11, 13, 14, 15, 16]), pick(rng, [0, 15, 30, 45]), 0, 0)
    return next
  }

  function withMonthBreak(previousStart) {
    const months = randomInt(rng, profile.breakMinMonths, profile.breakMaxMonths)
    const next = addMonths(previousStart, months)
    next.setDate(next.getDate() + randomInt(rng, 0, 14))
    next.setHours(pick(rng, [8, 9, 10, 11, 13, 14, 15, 16]), pick(rng, [0, 15, 30, 45]), 0, 0)
    return next
  }

  function choosePlan() {
    const discharged = rng() < profile.extraDischargedRate
    if (discharged) {
      return rng() < profile.dischargedTwoBlockRate
        ? JOURNEY_PLAN.DISCHARGED_TWO_BLOCKS_DONE
        : JOURNEY_PLAN.DISCHARGED_ONE_BLOCK_DONE
    }
    return rng() < profile.followupTxRate
      ? JOURNEY_PLAN.ACTIVE_SECOND_BLOCK_IN_PROGRESS
      : JOURNEY_PLAN.ACTIVE_ONE_BLOCK_PLUS_RAX
  }

  clientIds.forEach((clientId, idx) => {
    const clinicianId = clinicianIds[idx % clinicianIds.length]
    const firstAxDate = new Date(now)
    firstAxDate.setDate(firstAxDate.getDate() - randomInt(rng, profile.referralToAxMinDays, profile.referralToAxMaxDays))
    firstAxDate.setHours(pick(rng, [8, 9, 10, 11, 13, 14, 15, 16]), pick(rng, [0, 15, 30, 45]), 0, 0)

    const plan = choosePlan()
    const firstBlock = []
    let currentStart = firstAxDate
    firstBlock.push(buildVisitRecord({ rng, profile, clientId, clinicianId, visitType: 'AX', scheduledStart: currentStart }))
    for (let i = 0; i < 6; i++) {
      currentStart = nextWeeklySession(currentStart)
      firstBlock.push(buildVisitRecord({ rng, profile, clientId, clinicianId, visitType: 'TX', scheduledStart: currentStart }))
    }

    const visibleFirstBlock =
      (plan === JOURNEY_PLAN.ACTIVE_ONE_BLOCK_PLUS_RAX || plan === JOURNEY_PLAN.ACTIVE_SECOND_BLOCK_IN_PROGRESS) &&
      rng() < profile.midblockStartRate
        ? firstBlock.slice(randomInt(rng, 1, 6))
        : firstBlock
    records.push(...visibleFirstBlock)

    if (plan === JOURNEY_PLAN.DISCHARGED_ONE_BLOCK_DONE) return

    currentStart = withMonthBreak(currentStart)
    records.push(buildVisitRecord({ rng, profile, clientId, clinicianId, visitType: 'RAX', scheduledStart: currentStart }))

    const isActivePlan = plan === JOURNEY_PLAN.ACTIVE_SECOND_BLOCK_IN_PROGRESS || plan === JOURNEY_PLAN.ACTIVE_ONE_BLOCK_PLUS_RAX
    const txCount =
      plan === JOURNEY_PLAN.DISCHARGED_TWO_BLOCKS_DONE
        ? 6
        : plan === JOURNEY_PLAN.ACTIVE_SECOND_BLOCK_IN_PROGRESS
          ? randomInt(rng, profile.partialSecondBlockMinTx, profile.partialSecondBlockMaxTx)
          : 0

    for (let i = 0; i < txCount; i++) {
      currentStart = nextWeeklySession(currentStart)
      const forceBooked = isActivePlan && i >= Math.max(0, txCount - 2)
      records.push(
        buildVisitRecord({
          rng,
          profile,
          clientId,
          clinicianId,
          visitType: 'TX',
          scheduledStart: currentStart,
          forceBooked,
        })
      )
    }
  })

  return records.sort((a, b) => {
    if (a.client_id !== b.client_id) return a.client_id.localeCompare(b.client_id)
    return a.scheduled_start.localeCompare(b.scheduled_start)
  })
}

export async function seedDatabaseFromCSV(csvString, onProgress = console.log) {
  onProgress('Parsing CSV...')
  const records = parseCSV(csvString)
  onProgress(`Parsed ${records.length} visit records`)
  return seedRecords(records, onProgress)
}

export async function clearDatabase(onProgress = console.log) {
  const collections = ['clients', 'clinicians', 'visits']

  for (const collectionName of collections) {
    onProgress(`Clearing ${collectionName}...`)
    const snapshot = await getDocs(collection(firestoreDatabase, collectionName))

    const BATCH_SIZE = 450
    const docs = snapshot.docs

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(firestoreDatabase)
      const batchDocs = docs.slice(i, i + BATCH_SIZE)

      for (const docSnap of batchDocs) {
        batch.delete(docSnap.ref)
      }

      await batch.commit()
    }

    onProgress(`Cleared ${docs.length} documents from ${collectionName}`)
  }

  onProgress('Database cleared!')
}

export async function seedMockDataByDifficulty(difficulty = 'medium', onProgress = console.log, seed = 42) {
  const normalizedDifficulty = DIFFICULTY_PROFILES[difficulty] ? difficulty : 'medium'
  onProgress(`Generating ${normalizedDifficulty} difficulty mock dataset...`)
  const records = generateMockRecords(normalizedDifficulty, seed)
  onProgress(`Generated ${records.length} visits. Clearing database...`)
  await clearDatabase(onProgress)
  return seedRecords(records, onProgress)
}

if (typeof window !== 'undefined') {
  window.seedDatabaseFromCSV = seedDatabaseFromCSV
  window.clearDatabase = clearDatabase
  window.seedMockDataByDifficulty = seedMockDataByDifficulty
}
