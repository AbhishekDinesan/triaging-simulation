import { createContext, useContext, useState, useEffect } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { firebaseAuth, firestoreDatabase } from '../firebase/firebaseConfig'

const AuthContext = createContext(null)

const DEMO_USERS = {
  student: { uid: 'demo-student', email: 'demo-student@example.com' },
  instructor: { uid: 'demo-instructor', email: 'demo-instructor@example.com' },
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  async function registerUser(email, password, role) {
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
    await setDoc(doc(firestoreDatabase, 'users', userCredential.user.uid), {
      email: email,
      role: role,
      createdAt: new Date().toISOString(),
    })
    setUserRole(role)
    return userCredential
  }

  async function loginUser(email, password) {
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password)
    const userDocRef = doc(firestoreDatabase, 'users', userCredential.user.uid)
    const userDocSnap = await getDoc(userDocRef)
    if (userDocSnap.exists()) {
      setUserRole(userDocSnap.data().role)
    }
    return userCredential
  }

  function logoutUser() {
    if (isDemoMode) {
      setCurrentUser(null)
      setUserRole(null)
      setIsDemoMode(false)
      return Promise.resolve()
    }
    setUserRole(null)
    return signOut(firebaseAuth)
  }

  function enterDemoMode(role) {
    setIsDemoMode(true)
    setCurrentUser(DEMO_USERS[role])
    setUserRole(role)
    setAuthLoading(false)
  }

  function switchDemoRole(role) {
    if (isDemoMode) {
      setCurrentUser(DEMO_USERS[role])
      setUserRole(role)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setCurrentUser(user)
      if (user) {
        const userDocRef = doc(firestoreDatabase, 'users', user.uid)
        const userDocSnap = await getDoc(userDocRef)
        if (userDocSnap.exists()) {
          setUserRole(userDocSnap.data().role)
        }
      } else {
        setUserRole(null)
      }
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  const authContextValue = {
    currentUser,
    userRole,
    authLoading,
    isDemoMode,
    registerUser,
    loginUser,
    logoutUser,
    setUserRole,
    enterDemoMode,
    switchDemoRole,
  }

  return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>
}
