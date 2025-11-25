"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SignupForm } from "@/components/signup-form"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { db } from "@/lib/firebase"
import { doc, getDoc, onSnapshot } from "firebase/firestore"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import Link from "next/link"

function SignupPageContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [signupEnabled, setSignupEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      router.push("/")
      return
    }

    if (!db) {
      setLoading(false)
      return
    }

    // Listen to signup enabled state
    const unsubscribe = onSnapshot(doc(db, "settings", "signup"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSignupEnabled(docSnapshot.data().enabled || false)
      } else {
        // Initialize settings document if it doesn't exist
        setSignupEnabled(false)
      }
      setLoading(false)
    }, (error) => {
      console.error("Error listening to signup state:", error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!signupEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="w-full max-w-md">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Sign up is currently disabled. Please contact an administrator to enable account creation.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <SignupForm onBackToLogin={() => router.push("/")} />
}

export default function SignupPage() {
  return (
    <AuthProvider>
      <SignupPageContent />
    </AuthProvider>
  )
}





