"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { Laptop, Lock, Loader2, AlertTriangle, Shield } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { 
  checkRateLimit, 
  recordAttempt, 
  clearRateLimit,
  getFirebaseErrorMessage,
  sanitizeEmail,
  secureLog
} from "@/lib/security"

// Form validation schema
const formSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(100, "Email is too long"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
})

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block
}

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    blocked: boolean
    remainingAttempts: number
    retryAfterMs?: number
  }>({ blocked: false, remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts })
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [signupEnabled, setSignupEnabled] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // Check rate limit on mount
  useEffect(() => {
    const rateLimitKey = "login_attempts"
    const status = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG)
    setRateLimitInfo(status)

    if (status.blocked && status.retryAfterMs) {
      setRetryCountdown(Math.ceil(status.retryAfterMs / 1000))
    }
  }, [])

  // Check signup enabled status
  useEffect(() => {
    if (!db) return

    const unsubscribe = onSnapshot(doc(db, "settings", "signup"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        setSignupEnabled(docSnapshot.data().enabled || false)
      } else {
        setSignupEnabled(false)
      }
    }, (error) => {
      console.error("Error listening to signup state:", error)
      setSignupEnabled(false)
    })

    return () => unsubscribe()
  }, [])

  // Countdown timer for blocked state
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return

    const timer = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          // Re-check rate limit
          const status = checkRateLimit("login_attempts", RATE_LIMIT_CONFIG)
          setRateLimitInfo(status)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [retryCountdown])

  // Format seconds to MM:SS
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const rateLimitKey = "login_attempts"

    // Check rate limit before attempting login
    const currentStatus = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG)
    if (currentStatus.blocked) {
      toast.error("Too many login attempts. Please try again later.")
      setRateLimitInfo(currentStatus)
      if (currentStatus.retryAfterMs) {
        setRetryCountdown(Math.ceil(currentStatus.retryAfterMs / 1000))
      }
      return
    }

    if (!auth) {
      toast.error("Authentication service not available")
      return
    }

    setLoading(true)

    try {
      // Sanitize email
      const sanitizedEmail = sanitizeEmail(values.email)
      if (!sanitizedEmail) {
        toast.error("Invalid email format")
        setLoading(false)
        return
      }

      await signInWithEmailAndPassword(auth, sanitizedEmail, values.password)
      
      // Clear rate limit on successful login
      clearRateLimit(rateLimitKey)
      setRateLimitInfo({ blocked: false, remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts })
      
      toast.success("Signed in successfully")
      secureLog("info", "User signed in successfully")
    } catch (error: unknown) {
      // Record failed attempt
      const attemptResult = recordAttempt(rateLimitKey, RATE_LIMIT_CONFIG)
      setRateLimitInfo(attemptResult)

      // Get user-friendly error message
      const errorMessage = getFirebaseErrorMessage(error as { code?: string; message?: string })
      
      secureLog("warn", "Login attempt failed", { 
        remainingAttempts: attemptResult.remainingAttempts 
      })

      if (attemptResult.blocked) {
        toast.error("Too many failed attempts. Account temporarily locked for security.")
        setRetryCountdown(Math.ceil(RATE_LIMIT_CONFIG.blockDurationMs / 1000))
      } else if (attemptResult.remainingAttempts <= 2) {
        toast.error(`${errorMessage} (${attemptResult.remainingAttempts} attempts remaining)`)
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const isBlocked = rateLimitInfo.blocked

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Decorative amber glow elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" 
           style={{ background: 'oklch(0.7686 0.1647 70.0804 / 0.08)' }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" 
           style={{ background: 'oklch(0.6658 0.1574 58.3183 / 0.06)' }} />
      
      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>
      
      <Card className="w-full max-w-md shadow-2xl border border-border/50 relative z-10 backdrop-blur-sm bg-card/98">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-primary/12 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-primary/25">
              <Laptop className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Enter your credentials to access the inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isBlocked && retryCountdown !== null && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Too many failed attempts. Please wait{" "}
                <span className="font-mono font-bold">
                  {formatCountdown(retryCountdown)}
                </span>{" "}
                before trying again.
              </AlertDescription>
            </Alert>
          )}

          {!isBlocked && rateLimitInfo.remainingAttempts < RATE_LIMIT_CONFIG.maxAttempts && (
            <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                {rateLimitInfo.remainingAttempts} login attempt
                {rateLimitInfo.remainingAttempts !== 1 ? "s" : ""} remaining
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="name@cpd.md.gov" 
                        {...field} 
                        className="h-11"
                        autoComplete="email"
                        disabled={isBlocked || loading}
                        aria-describedby="email-error"
                      />
                    </FormControl>
                    <FormMessage id="email-error" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                        className="h-11"
                        autoComplete="current-password"
                        disabled={isBlocked || loading}
                        aria-describedby="password-error"
                      />
                    </FormControl>
                    <FormMessage id="password-error" />
                  </FormItem>
                )}
              />
              <Button 
                className="w-full h-11 mt-4 text-base" 
                type="submit" 
                disabled={loading || isBlocked}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : isBlocked ? (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Temporarily Locked
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </Form>

          {signupEnabled && (
            <div className="text-center text-sm text-muted-foreground mt-4">
              Don't have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </div>
          )}
          <div className="mt-6 pt-4 border-t border-border/50">
            <p className="text-xs text-center text-muted-foreground">
              Protected by secure authentication. Contact IT support if you need assistance.
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Footer branding */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50">
        Toughbook Tracker • Cheverly PD
      </div>
    </div>
  )
}
