"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { doc, setDoc, onSnapshot } from "firebase/firestore"
import { useAuth } from "@/components/auth-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { User2, Shield, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { secureLog } from "@/lib/security"

export function ProfilePage() {
  const { user, userRole } = useAuth()
  const [signupEnabled, setSignupEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!db) {
      setLoading(false)
      return
    }

    // Listen to signup enabled state in real-time
    const unsubscribe = onSnapshot(
      doc(db, "settings", "signup"),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setSignupEnabled(docSnapshot.data().enabled || false)
        } else {
          // Initialize settings document if it doesn't exist
          setDoc(doc(db, "settings", "signup"), { enabled: false }).catch(
            (error) => {
              secureLog("error", "Error initializing settings", {
                error: String(error)
              })
            }
          )
          setSignupEnabled(false)
        }
        setLoading(false)
      },
      (error) => {
        secureLog("error", "Error listening to signup state", {
          error: String(error)
        })
        toast.error("Failed to load settings")
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const handleToggleSignup = async (enabled: boolean) => {
    if (!db) {
      toast.error("Database not initialized")
      return
    }

    setSaving(true)
    try {
      await setDoc(doc(db, "settings", "signup"), { enabled }, { merge: true })
      setSignupEnabled(enabled)
      toast.success(enabled ? "Signup enabled" : "Signup disabled")
    } catch (error) {
      secureLog("error", "Error updating signup state", {
        error: String(error)
      })
      toast.error("Failed to update settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div>
        <p className="eyebrow">Your workspace</p>
        <h1 className="page-title">Account & settings</h1>
        <p className="page-description">
          Your details and department preferences, in one place.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-accent rounded-xl flex items-center justify-center">
              <User2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Account information</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {user?.email}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Role</Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={userRole === "admin" ? "default" : "secondary"}>
                  {userRole === "admin" ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </>
                  ) : (
                    "User"
                  )}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {userRole === "admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-accent rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Department settings</CardTitle>
                <CardDescription>
                  Control access to your department workspace
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 min-w-0">
                <Label htmlFor="signup-toggle" className="text-sm font-medium">
                  Allow new accounts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow new users to create accounts
                </p>
              </div>
              <Switch
                id="signup-toggle"
                checked={signupEnabled}
                onCheckedChange={handleToggleSignup}
                disabled={saving}
              />
            </div>
            {saving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
