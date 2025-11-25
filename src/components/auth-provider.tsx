"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react"
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { 
  updateLastActivity, 
  isSessionExpired, 
  clearSession,
  secureLog 
} from "@/lib/security"
import { toast } from "sonner"

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000
// Activity check interval (1 minute)
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000
// Warning before timeout (5 minutes)
const TIMEOUT_WARNING_MS = 5 * 60 * 1000

interface UserRole {
  role: "user" | "admin"
}

interface AuthContextType {
  user: User | null
  userRole: "user" | "admin" | null
  loading: boolean
  signOut: () => Promise<void>
  extendSession: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  loading: true,
  signOut: async () => {},
  extendSession: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<"user" | "admin" | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const activityCheckRef = useRef<NodeJS.Timeout | null>(null)
  const warningShownRef = useRef(false)

  // Sign out handler
  const handleSignOut = useCallback(async (showMessage = true) => {
    try {
      if (auth) {
        await firebaseSignOut(auth)
      }
      clearSession()
      if (showMessage) {
        toast.info("You have been signed out")
      }
    } catch (error) {
      secureLog("error", "Sign out failed", { error: String(error) })
    }
  }, [])

  // Extend session
  const extendSession = useCallback(() => {
    updateLastActivity()
    setShowTimeoutWarning(false)
    warningShownRef.current = false
  }, [])

  // Check session timeout
  const checkSessionTimeout = useCallback(() => {
    if (!user) return

    const lastActivity = sessionStorage.getItem("lastActivity")
    if (!lastActivity) {
      updateLastActivity()
      return
    }

    const elapsed = Date.now() - parseInt(lastActivity, 10)
    const timeRemaining = SESSION_TIMEOUT_MS - elapsed

    // Session expired
    if (timeRemaining <= 0) {
      secureLog("info", "Session expired due to inactivity")
      toast.warning("Session expired due to inactivity")
      handleSignOut(false)
      return
    }

    // Show warning 5 minutes before timeout
    if (timeRemaining <= TIMEOUT_WARNING_MS && !warningShownRef.current) {
      warningShownRef.current = true
      setShowTimeoutWarning(true)
      const minutesRemaining = Math.ceil(timeRemaining / 60000)
      toast.warning(
        `Your session will expire in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}. Click anywhere to stay signed in.`,
        { duration: 10000 }
      )
    }
  }, [user, handleSignOut])

  // Set up activity tracking
  useEffect(() => {
    if (!user) return

    // Initialize last activity
    updateLastActivity()

    // Track user activity
    const handleActivity = () => {
      updateLastActivity()
      if (showTimeoutWarning) {
        setShowTimeoutWarning(false)
        warningShownRef.current = false
      }
    }

    // Activity events
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"]
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Start periodic session check
    activityCheckRef.current = setInterval(checkSessionTimeout, ACTIVITY_CHECK_INTERVAL_MS)

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current)
      }
    }
  }, [user, showTimeoutWarning, checkSessionTimeout])

  // Auth state listener
  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      
      if (currentUser) {
        updateLastActivity()
        secureLog("info", "User authenticated", { uid: currentUser.uid })
        
        // Fetch user role from Firestore
        if (db) {
          try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid))
            if (userDoc.exists()) {
              const userData = userDoc.data() as UserRole
              setUserRole(userData.role || "user")
            } else {
              // If user document doesn't exist, create it with default role "user"
              try {
                await setDoc(doc(db, "users", currentUser.uid), {
                  email: currentUser.email || "",
                  role: "user",
                  createdAt: new Date().toISOString(),
                })
                setUserRole("user")
              } catch (createError) {
                console.error("Error creating user document:", createError)
                setUserRole("user") // Default to user on error
              }
            }
          } catch (error) {
            console.error("Error fetching user role:", error)
            setUserRole("user") // Default to user on error
          }
        } else {
          setUserRole("user")
        }
      } else {
        setUserRole(null)
        clearSession()
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Handle page visibility change (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        // Check session when user returns to tab
        checkSessionTimeout()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [user, checkSessionTimeout])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signOut: handleSignOut, extendSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
