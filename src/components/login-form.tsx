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
  FormMessage
} from "@/components/ui/form"
import { AuthLayout } from "@/components/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  AlertTriangle,
  Shield
} from "lucide-react"
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
    .max(128, "Password is too long")
})

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000 // 30 minutes block
}

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
      password: ""
    }
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

    const unsubscribe = onSnapshot(
      doc(db, "settings", "signup"),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setSignupEnabled(docSnapshot.data().enabled || false)
        } else {
          setSignupEnabled(false)
        }
      },
      (error) => {
        secureLog("error", "Error listening to signup state", {
          error: String(error)
        })
        setSignupEnabled(false)
      }
    )

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
      setRateLimitInfo({
        blocked: false,
        remainingAttempts: RATE_LIMIT_CONFIG.maxAttempts
      })

      toast.success("Signed in successfully")
      secureLog("info", "User signed in successfully")
    } catch (error: unknown) {
      // Record failed attempt
      const attemptResult = recordAttempt(rateLimitKey, RATE_LIMIT_CONFIG)
      setRateLimitInfo(attemptResult)

      // Get user-friendly error message
      const errorMessage = getFirebaseErrorMessage(
        error as { code?: string; message?: string }
      )

      secureLog("warn", "Login attempt failed", {
        remainingAttempts: attemptResult.remainingAttempts
      })

      if (attemptResult.blocked) {
        toast.error(
          "Too many failed attempts. Account temporarily locked for security."
        )
        setRetryCountdown(Math.ceil(RATE_LIMIT_CONFIG.blockDurationMs / 1000))
      } else if (attemptResult.remainingAttempts <= 2) {
        toast.error(
          `${errorMessage} (${attemptResult.remainingAttempts} attempts remaining)`
        )
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const isBlocked = rateLimitInfo.blocked

  return (
    <AuthLayout>
      <div className="mb-8">
        <p className="eyebrow">Your department workspace</p>
        <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.045em]">
          Welcome back.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in to manage your devices and keep your team moving.
        </p>
      </div>
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

      {!isBlocked &&
        rateLimitInfo.remainingAttempts < RATE_LIMIT_CONFIG.maxAttempts && (
          <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
            <Shield className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {rateLimitInfo.remainingAttempts} login attempt
              {rateLimitInfo.remainingAttempts !== 1 ? "s" : ""} remaining
            </AlertDescription>
          </Alert>
        )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@cpd.md.gov"
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
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      {...field}
                      className="h-11 pr-11"
                      autoComplete="current-password"
                      disabled={isBlocked || loading}
                    />
                  </FormControl>
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-md text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <FormMessage id="password-error" />
              </FormItem>
            )}
          />
          <Button
            className="w-full h-11 mt-2 text-sm"
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
                Sign in to workspace
                <ArrowRight className="ml-auto h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </Form>

      {signupEnabled && (
        <div className="text-center text-sm text-muted-foreground mt-4">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-primary hover:underline font-medium"
          >
            Sign up
          </Link>
        </div>
      )}
      <p className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Shield className="size-3.5" />
        Secure access for your department
      </p>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        Need access? Contact your department administrator.
      </p>
    </AuthLayout>
  )
}
