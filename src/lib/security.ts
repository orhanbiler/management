/**
 * Security utilities for the application
 * Provides input sanitization, rate limiting, and security helpers
 */

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes or escapes potentially dangerous characters and HTML
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") return ""
  
  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "")
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    // Remove javascript: protocol
    .replace(/javascript:/gi, "")
    // Remove data: URLs that could contain scripts
    .replace(/data:text\/html/gi, "")
    .trim()
}

/**
 * Sanitizes input for display (allows some safe formatting)
 */
export function sanitizeForDisplay(input: string): string {
  if (!input || typeof input !== "string") return ""
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .trim()
}

/**
 * Validates and sanitizes email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") return ""
  
  // Remove any HTML/script content first
  const cleaned = email.replace(/<[^>]*>/g, "").trim().toLowerCase()
  
  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  
  if (!emailRegex.test(cleaned)) {
    return ""
  }
  
  return cleaned
}

/**
 * Sanitizes serial numbers and PIDs (alphanumeric only)
 */
export function sanitizeAlphanumeric(input: string): string {
  if (!input || typeof input !== "string") return ""
  return input.replace(/[^a-zA-Z0-9-_]/g, "").toUpperCase()
}

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitEntry {
  count: number
  firstAttempt: number
  blockedUntil?: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  blockDurationMs: number
}

const defaultConfig: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  blockDurationMs: 30 * 60 * 1000, // 30 minutes block
}

/**
 * Client-side rate limiting for sensitive operations
 * Returns true if the action should be blocked
 */
export function checkRateLimit(
  key: string, 
  config: Partial<RateLimitConfig> = {}
): { blocked: boolean; remainingAttempts: number; retryAfterMs?: number } {
  const { maxAttempts, windowMs, blockDurationMs } = { ...defaultConfig, ...config }
  const now = Date.now()
  
  const entry = rateLimitStore.get(key)
  
  // Check if currently blocked
  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return { 
      blocked: true, 
      remainingAttempts: 0,
      retryAfterMs: entry.blockedUntil - now 
    }
  }
  
  // Clean up expired entries
  if (entry && now - entry.firstAttempt > windowMs) {
    rateLimitStore.delete(key)
  }
  
  return { 
    blocked: false, 
    remainingAttempts: maxAttempts - (entry?.count || 0) 
  }
}

/**
 * Record an attempt for rate limiting
 */
export function recordAttempt(
  key: string, 
  config: Partial<RateLimitConfig> = {}
): { blocked: boolean; remainingAttempts: number } {
  const { maxAttempts, windowMs, blockDurationMs } = { ...defaultConfig, ...config }
  const now = Date.now()
  
  let entry = rateLimitStore.get(key)
  
  // If no entry or expired, create new
  if (!entry || now - entry.firstAttempt > windowMs) {
    entry = { count: 1, firstAttempt: now }
    rateLimitStore.set(key, entry)
    return { blocked: false, remainingAttempts: maxAttempts - 1 }
  }
  
  // Increment count
  entry.count++
  
  // Check if should be blocked
  if (entry.count >= maxAttempts) {
    entry.blockedUntil = now + blockDurationMs
    rateLimitStore.set(key, entry)
    return { blocked: true, remainingAttempts: 0 }
  }
  
  rateLimitStore.set(key, entry)
  return { blocked: false, remainingAttempts: maxAttempts - entry.count }
}

/**
 * Clear rate limit for a key (e.g., after successful login)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

// ============================================================================
// SESSION SECURITY
// ============================================================================

const SESSION_TIMEOUT_KEY = "lastActivity"
const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

/**
 * Update last activity timestamp
 */
export function updateLastActivity(): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_TIMEOUT_KEY, Date.now().toString())
  }
}

/**
 * Check if session has timed out
 */
export function isSessionExpired(timeoutMs: number = DEFAULT_SESSION_TIMEOUT): boolean {
  if (typeof window === "undefined") return false
  
  const lastActivity = sessionStorage.getItem(SESSION_TIMEOUT_KEY)
  if (!lastActivity) return false
  
  const elapsed = Date.now() - parseInt(lastActivity, 10)
  return elapsed > timeoutMs
}

/**
 * Clear session data
 */
export function clearSession(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_TIMEOUT_KEY)
  }
}

// ============================================================================
// FIREBASE ERROR HANDLING
// ============================================================================

interface FirebaseError {
  code?: string
  message?: string
}

/**
 * Map Firebase error codes to user-friendly messages
 * Does not expose internal error details for security
 */
export function getFirebaseErrorMessage(error: FirebaseError): string {
  const errorCode = error?.code || ""
  
  const errorMessages: Record<string, string> = {
    // Authentication errors
    "auth/invalid-credential": "Invalid email or password. Please try again.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled. Please contact support.",
    "auth/user-not-found": "Invalid email or password. Please try again.", // Don't reveal user doesn't exist
    "auth/wrong-password": "Invalid email or password. Please try again.", // Don't reveal password is wrong
    "auth/email-already-in-use": "This email is already registered.",
    "auth/weak-password": "Password is too weak. Please use a stronger password.",
    "auth/too-many-requests": "Too many failed attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/requires-recent-login": "Please sign in again to continue.",
    
    // Firestore errors
    "permission-denied": "You don't have permission to perform this action.",
    "unavailable": "Service temporarily unavailable. Please try again.",
    "failed-precondition": "Operation failed. Please refresh and try again.",
    "not-found": "The requested resource was not found.",
    "already-exists": "This record already exists.",
    "resource-exhausted": "Too many requests. Please wait before trying again.",
    "cancelled": "Operation was cancelled.",
    "data-loss": "Data error occurred. Please try again.",
    "deadline-exceeded": "Request timed out. Please try again.",
    "internal": "An internal error occurred. Please try again.",
    "invalid-argument": "Invalid data provided. Please check your input.",
    "unauthenticated": "Please sign in to continue.",
  }
  
  return errorMessages[errorCode] || "An unexpected error occurred. Please try again."
}

// ============================================================================
// SECURE LOGGING
// ============================================================================

type LogLevel = "info" | "warn" | "error" | "debug"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
}

/**
 * Secure logger that sanitizes sensitive data
 * Only logs to console in development
 */
export function secureLog(
  level: LogLevel, 
  message: string, 
  context?: Record<string, unknown>
): void {
  // Only log in development
  if (process.env.NODE_ENV !== "development") {
    return
  }
  
  // Sanitize context to remove sensitive fields
  const sensitiveFields = ["password", "token", "secret", "key", "auth", "credential"]
  const sanitizedContext = context ? { ...context } : undefined
  
  if (sanitizedContext) {
    for (const key of Object.keys(sanitizedContext)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitizedContext[key] = "[REDACTED]"
      }
    }
  }
  
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: sanitizedContext
  }
  
  switch (level) {
    case "debug":
      console.debug(entry)
      break
    case "info":
      console.info(entry)
      break
    case "warn":
      console.warn(entry)
      break
    case "error":
      console.error(entry)
      break
  }
}

// ============================================================================
// DATA VALIDATION
// ============================================================================

/**
 * Validate device data before submission
 */
export function validateDeviceData(data: {
  serial_number?: string
  pid_number?: string
  asset_id?: string
  officer?: string
  notes?: string
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // At least one identifier required
  const hasSerial = data.serial_number && data.serial_number.trim().length > 0
  const hasPid = data.pid_number && data.pid_number.trim().length > 0
  
  if (!hasSerial && !hasPid) {
    errors.push("Either Serial Number or PID Number is required")
  }
  
  // Validate serial number format if provided
  if (hasSerial && !/^[A-Z0-9-_]{3,50}$/i.test(data.serial_number!)) {
    errors.push("Serial number contains invalid characters")
  }
  
  // Validate PID format if provided
  if (hasPid && !/^[A-Z0-9-_]{3,50}$/i.test(data.pid_number!)) {
    errors.push("PID number contains invalid characters")
  }
  
  // Validate notes length
  if (data.notes && data.notes.length > 1000) {
    errors.push("Notes cannot exceed 1000 characters")
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}









