import { createContext, useContext, useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, getDocs } from 'firebase/firestore'
import { addDays } from 'date-fns'
import { firestoreDatabase } from '../../shared/firebase/firebaseConfig'
import { NOTES_C0001, NOTES_C0004, NOTES_C0005 } from '../scheduling/data/samplePatientNotes'

const SimulationSettingsContext = createContext(null)

function generateSampleData() {
  const today = new Date()

  const sampleClinicians = [
    { id: 'CLIN01', name: 'CLIN01', color: '#6366f1' },
    { id: 'CLIN02', name: 'CLIN02', color: '#10b981' },
    { id: 'CLIN03', name: 'CLIN03', color: '#f59e0b' },
  ]

  const sampleClientQueue = [
    {
      id: 'C0001',
      name: 'Client C0001',
      priority: 'high',
      status: 'pending',
      diagnosis: 'See referral',
      referralNotes: '',
      notes: NOTES_C0001,
    },
    {
      id: 'C0002',
      name: 'Client C0002',
      priority: 'medium',
      status: 'pending',
      diagnosis: 'See referral',
      referralNotes: '',
    },
    {
      id: 'C0003',
      name: 'Client C0003',
      priority: 'low',
      status: 'pending',
      diagnosis: 'See referral',
      referralNotes: '',
    },
  ]

  const sampleCompletedClients = [
    {
      id: 'C0004',
      name: 'Client C0004',
      priority: 'high',
      status: 'completed',
      diagnosis: 'See referral',
      referralNotes: '',
      notes: NOTES_C0004,
    },
  ]

  const sampleAppointments = [
    {
      id: 'C0004-AX-1',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'AX',
      scheduledDate: addDays(today, 1).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0004-SP-1',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'SP',
      scheduledDate: addDays(today, 3).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0004-BLOCK-1',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'BLOCK',
      scheduledDate: addDays(today, 5).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0004-BLOCK-2',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'BLOCK',
      scheduledDate: addDays(today, 8).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0004-BLOCK-3',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'BLOCK',
      scheduledDate: addDays(today, 10).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0004-BLOCK-4',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'BLOCK',
      scheduledDate: addDays(today, 12).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0004-BLOCK-5',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'BLOCK',
      scheduledDate: addDays(today, 15).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0004-BLOCK-6',
      clientId: 'C0004',
      clinicianId: 'CLIN01',
      appointmentType: 'BLOCK',
      scheduledDate: addDays(today, 17).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0005-AX-1',
      clientId: 'C0005',
      clinicianId: 'CLIN02',
      appointmentType: 'AX',
      scheduledDate: addDays(today, 2).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0005-SP-1',
      clientId: 'C0005',
      clinicianId: 'CLIN02',
      appointmentType: 'SP',
      scheduledDate: addDays(today, 6).toISOString(),
      status: 'Booked',
    },
    {
      id: 'C0005-BLOCK-1',
      clientId: 'C0005',
      clinicianId: 'CLIN02',
      appointmentType: 'BLOCK',
      scheduledDate: addDays(today, 9).toISOString(),
      status: 'Booked',
    },
  ]

  return {
    clinicians: sampleClinicians,
    clientQueue: sampleClientQueue,
    completedClients: [
      ...sampleCompletedClients,
      {
        id: 'C0005',
        name: 'Client C0005',
        priority: 'medium',
        status: 'completed',
        diagnosis: 'See referral',
        referralNotes: '',
        notes: NOTES_C0005,
      },
    ],
    appointments: sampleAppointments,
  }
}

const DEFAULT_SIMULATION_SETTINGS = {
  simulationEnabled: true,
  clientDisplayMode: 'queue',
  historicalDataEnabled: false,
  priorityLevelsEnabled: {
    high: true,
    medium: true,
    low: true,
  },
  clinicians: [],
  clientQueue: [],
  appointments: [],
  completedClients: [],
}

const SETTINGS_DOCUMENT_PATH = 'settings/simulation'

function getClientBuckets(allClients) {
  return {
    clientQueue: allClients.filter((client) => client.status === 'pending' || client.status === 'active'),
    completedClients: allClients.filter((client) => client.status === 'completed'),
  }
}

async function fetchFirestoreSimulationData() {
  const [cliniciansSnapshot, clientsSnapshot, visitsSnapshot] = await Promise.all([
    getDocs(collection(firestoreDatabase, 'clinicians')),
    getDocs(collection(firestoreDatabase, 'clients')),
    getDocs(collection(firestoreDatabase, 'visits')),
  ])

  const clinicians = cliniciansSnapshot.docs.map((docSnapshot) => docSnapshot.data())
  const allClients = clientsSnapshot.docs.map((docSnapshot) => docSnapshot.data())
  const appointments = visitsSnapshot.docs.map((docSnapshot) => docSnapshot.data())
  const { clientQueue, completedClients } = getClientBuckets(allClients)

  const hasFirestoreData = clinicians.length > 0 || allClients.length > 0 || appointments.length > 0
  return {
    hasFirestoreData,
    data: {
      clinicians,
      clientQueue,
      completedClients,
      appointments,
    },
  }
}

function getHydratedData(firestoreResult) {
  return firestoreResult.hasFirestoreData ? firestoreResult.data : generateSampleData()
}

export function useSimulationSettings() {
  const context = useContext(SimulationSettingsContext)
  if (!context) {
    throw new Error('useSimulationSettings must be used within SimulationSettingsProvider')
  }
  return context
}

export function SimulationSettingsProvider({ children }) {
  const [simulationSettings, setSimulationSettings] = useState(DEFAULT_SIMULATION_SETTINGS)
  const [settingsLoading, setSettingsLoading] = useState(true)

  useEffect(() => {
    async function loadInitialData() {
      try {
        const firestoreResult = await fetchFirestoreSimulationData()
        const hydratedData = getHydratedData(firestoreResult)

        const settingsDocRef = doc(firestoreDatabase, SETTINGS_DOCUMENT_PATH)

        const unsubscribe = onSnapshot(
          settingsDocRef,
          (docSnapshot) => {
            const settingsData = docSnapshot.exists() ? docSnapshot.data() : {}
            setSimulationSettings({
              ...DEFAULT_SIMULATION_SETTINGS,
              ...settingsData,
              ...hydratedData,
            })
            setSettingsLoading(false)
          },
          () => {
            setSimulationSettings({
              ...DEFAULT_SIMULATION_SETTINGS,
              ...hydratedData,
            })
            setSettingsLoading(false)
          }
        )

        return unsubscribe
      } catch (error) {
        console.error('Error loading data from Firestore:', error)
        const sampleData = generateSampleData()
        setSimulationSettings({
          ...DEFAULT_SIMULATION_SETTINGS,
          ...sampleData,
        })
        setSettingsLoading(false)
      }
    }

    const cleanupPromise = loadInitialData()
    return () => {
      cleanupPromise.then((unsubscribe) => unsubscribe?.())
    }
  }, [])

  async function updateSimulationSettings(newSettings) {
    const settingsDocRef = doc(firestoreDatabase, SETTINGS_DOCUMENT_PATH)
    const { clinicians: _, clientQueue: _cq, completedClients: _cc, appointments: _a, ...uiSettings } = newSettings
    const currentUISettings = {
      simulationEnabled: simulationSettings.simulationEnabled,
      clientDisplayMode: simulationSettings.clientDisplayMode,
      historicalDataEnabled: simulationSettings.historicalDataEnabled,
      priorityLevelsEnabled: simulationSettings.priorityLevelsEnabled,
    }
    const mergedUISettings = { ...currentUISettings, ...uiSettings }
    await setDoc(settingsDocRef, mergedUISettings)

    setSimulationSettings((prev) => ({ ...prev, ...newSettings }))
  }

  async function refreshFromFirestore() {
    setSettingsLoading(true)
    try {
      const firestoreResult = await fetchFirestoreSimulationData()
      const refreshedData = getHydratedData(firestoreResult)
      setSimulationSettings((prev) => ({
        ...prev,
        ...refreshedData,
      }))
    } catch (error) {
      console.error('Error refreshing from Firestore:', error)
      const sampleData = generateSampleData()
      setSimulationSettings((prev) => ({
        ...prev,
        ...sampleData,
      }))
    }
    setSettingsLoading(false)
  }

  async function resetSimulationSettings() {
    const settingsDocRef = doc(firestoreDatabase, SETTINGS_DOCUMENT_PATH)
    const uiSettings = {
      simulationEnabled: true,
      clientDisplayMode: 'queue',
      historicalDataEnabled: false,
      priorityLevelsEnabled: { high: true, medium: true, low: true },
    }
    await setDoc(settingsDocRef, uiSettings)

    const sampleData = generateSampleData()
    setSimulationSettings({
      ...DEFAULT_SIMULATION_SETTINGS,
      ...uiSettings,
      ...sampleData,
    })
  }

  async function addClientAppointments(newAppointments, clientId) {
    const scheduledTimestamp = new Date().toISOString()

    for (const appointment of newAppointments) {
      const visitId = `${clientId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await setDoc(doc(firestoreDatabase, 'visits', visitId), {
        id: visitId,
        clientId,
        ...appointment,
        status: 'Booked',
        bookingDatetime: scheduledTimestamp,
      })
    }

    const queuedClient = simulationSettings.clientQueue.find((client) => client.id === clientId)

    await setDoc(
      doc(firestoreDatabase, 'clients', clientId),
      {
        ...queuedClient,
        status: 'active',
        scheduledAt: scheduledTimestamp,
      },
      { merge: true }
    )

    const updatedAppointments = [...simulationSettings.appointments, ...newAppointments]
    const updatedQueue = simulationSettings.clientQueue.filter((client) => client.id !== clientId)
    const updatedCompleted = queuedClient
      ? [...simulationSettings.completedClients, { ...queuedClient, scheduledAt: scheduledTimestamp }]
      : simulationSettings.completedClients

    setSimulationSettings((prev) => ({
      ...prev,
      appointments: updatedAppointments,
      clientQueue: updatedQueue,
      completedClients: updatedCompleted,
    }))
  }

  const settingsContextValue = {
    simulationSettings,
    settingsLoading,
    updateSimulationSettings,
    resetSimulationSettings,
    refreshFromFirestore,
    addClientAppointments,
  }

  return (
    <SimulationSettingsContext.Provider value={settingsContextValue}>{children}</SimulationSettingsContext.Provider>
  )
}
