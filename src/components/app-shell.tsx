"use client"

import Link from "next/link"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { ErrorBoundary } from "@/components/error-boundary"
import { LoginForm } from "@/components/login-form"
import { ModeToggle } from "@/components/mode-toggle"
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset
} from "@/components/ui/sidebar"

function Workspace({
  children,
  title
}: {
  children: React.ReactNode
  title: string
}) {
  const { user, signOut } = useAuth()
  if (!user) return <LoginForm />

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "4.5rem"
        } as React.CSSProperties
      }
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <AppSidebar userEmail={user.email} onSignOut={signOut} />
      <SidebarInset className="min-w-0 bg-background">
        <header className="workspace-header">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="text-muted-foreground" />
            <span className="hidden h-4 w-px bg-border sm:block" />
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs"
            >
              <Link
                href="/"
                className="hidden text-muted-foreground hover:text-foreground sm:inline"
              >
                Workspace
              </Link>
              <ChevronRight className="hidden size-3 text-muted-foreground sm:block" />
              <span aria-current="page" className="font-medium">
                {title}
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex">
              <ShieldCheck className="size-3.5" /> Cheverly Police Department
            </span>
            <ModeToggle />
            <Link
              href="/profile"
              aria-label="View your profile"
              className="avatar border border-border"
            >
              {user.email?.slice(0, 2).toUpperCase() || "CP"}
            </Link>
          </div>
        </header>
        <main id="main-content" className="workspace-main">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <footer className="mx-5 flex items-center justify-between gap-4 border-t py-5 text-[10px] text-muted-foreground md:mx-8 lg:mx-9">
          <span>
            Device Manager <span className="mx-1.5 text-border">/</span>{" "}
            Cheverly PD
          </span>
          <span>Equipped for every day.</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function AppShell({
  children,
  title
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Workspace title={title}>{children}</Workspace>
      </AuthProvider>
    </ErrorBoundary>
  )
}
