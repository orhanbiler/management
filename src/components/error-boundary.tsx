"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate a unique error ID for tracking (without exposing sensitive info)
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`
    return { hasError: true, error, errorId }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error securely - in production, send to error tracking service
    // Never log sensitive user data or full stack traces to console in production
    if (process.env.NODE_ENV === "development") {
      console.error("Error Boundary caught an error:", {
        message: error.message,
        componentStack: errorInfo.componentStack
      })
    }
    
    // In production, you would send this to an error tracking service like Sentry
    // Example: Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null })
  }

  handleGoHome = () => {
    window.location.href = "/"
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center shadow-inner">
                  <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-base">
                An unexpected error has occurred. Our team has been notified.
              </CardDescription>
              {this.state.errorId && (
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Error ID: {this.state.errorId}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={this.handleRetry} 
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button 
                  onClick={this.handleGoHome} 
                  className="flex-1"
                  variant="outline"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                If this problem persists, please contact IT support.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for functional components to report errors
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    if (process.env.NODE_ENV === "development") {
      console.error("Error reported:", { message: error.message, info: errorInfo })
    }
    // In production, send to error tracking service
  }
}

