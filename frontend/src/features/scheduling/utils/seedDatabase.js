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

export async function seedDatabaseFromCSV(csvString, onProgress = console.log) {
  onProgress('Parsing CSV...')
  const records = parseCSV(csvString)
  onProgress(`Parsed ${records.length} visit records`)

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
      const visitId = `${record.client_id}_${record.scheduled_start.replace(/[^0-9]/g, '')}`
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

if (typeof window !== 'undefined') {
  window.seedDatabaseFromCSV = seedDatabaseFromCSV
  window.clearDatabase = clearDatabase
}
