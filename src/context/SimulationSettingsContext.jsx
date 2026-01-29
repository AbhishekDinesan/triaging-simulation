import { createContext, useContext, useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { firestoreDatabase } from '../firebase/firebaseConfig'

const SimulationSettingsContext = createContext(null)

const DEFAULT_SIMULATION_SETTINGS = {
  simulationEnabled: true,
  maxPatientsPerDay: 10,
  minimumBookingNoticeDays: 0,
  patientDisplayMode: 'queue',
  urgencyLevelsEnabled: {
    high: true,
    medium: true,
    low: true,
  },
  availableConditions: [
    'Cardiac Evaluation',
    'Follow-up: Fracture',
    'Routine Checkup',
    'Diabetes Management',
    'Prenatal Care',
    'Post-Surgery Review',
  ],
  schedulingWindowDays: 30,
  patientQueue: [
    {
      id: 1,
      name: 'Eleanor Vance',
      age: 67,
      condition: 'Cardiac Evaluation',
      urgency: 'high',
      symptoms: 'Chest pain, shortness of breath',
    },
    {
      id: 2,
      name: 'Marcus Chen',
      age: 34,
      condition: 'Follow-up: Fracture',
      urgency: 'medium',
      symptoms: 'Wrist pain after cast removal',
    },
    {
      id: 3,
      name: 'Sarah Mitchell',
      age: 45,
      condition: 'Routine Checkup',
      urgency: 'low',
      symptoms: 'Annual physical examination',
    },
    {
      id: 4,
      name: 'James Okonkwo',
      age: 52,
      condition: 'Diabetes Management',
      urgency: 'medium',
      symptoms: 'Blood sugar fluctuations',
    },
    {
      id: 5,
      name: 'Maria Rodriguez',
      age: 29,
      condition: 'Prenatal Care',
      urgency: 'high',
      symptoms: '28 weeks pregnant, routine monitoring',
    },
    {
      id: 6,
      name: 'David Kim',
      age: 71,
      condition: 'Post-Surgery Review',
      urgency: 'high',
      symptoms: 'Hip replacement follow-up',
    },
  ],
}

const SETTINGS_DOCUMENT_PATH = 'settings/simulation'

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
    const settingsDocRef = doc(firestoreDatabase, SETTINGS_DOCUMENT_PATH)
    const unsubscribe = onSnapshot(
      settingsDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setSimulationSettings(docSnapshot.data())
        } else {
          setSimulationSettings(DEFAULT_SIMULATION_SETTINGS)
        }
        setSettingsLoading(false)
      },
      () => {
        setSimulationSettings(DEFAULT_SIMULATION_SETTINGS)
        setSettingsLoading(false)
      }
    )
    return unsubscribe
  }, [])

  async function updateSimulationSettings(newSettings) {
    const settingsDocRef = doc(firestoreDatabase, SETTINGS_DOCUMENT_PATH)
    const mergedSettings = { ...simulationSettings, ...newSettings }
    await setDoc(settingsDocRef, mergedSettings)
    setSimulationSettings(mergedSettings)
  }

  async function resetSimulationSettings() {
    const settingsDocRef = doc(firestoreDatabase, SETTINGS_DOCUMENT_PATH)
    await setDoc(settingsDocRef, DEFAULT_SIMULATION_SETTINGS)
    setSimulationSettings(DEFAULT_SIMULATION_SETTINGS)
  }

  const settingsContextValue = {
    simulationSettings,
    settingsLoading,
    updateSimulationSettings,
    resetSimulationSettings,
    DEFAULT_SIMULATION_SETTINGS,
  }

  return (
    <SimulationSettingsContext.Provider value={settingsContextValue}>{children}</SimulationSettingsContext.Provider>
  )
}
