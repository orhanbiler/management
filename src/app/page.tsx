"use client"

import { InventoryDashboard } from "@/components/inventory-dashboard"
import { LoginForm } from "@/components/login-form"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

function MainApp() {
  const { user } = useAuth()

  const handleSignOut = async () => {
    if (auth) await signOut(auth)
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email} onSignOut={handleSignOut} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-4 border-b px-4 bg-background transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">
                    Home
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Inventory Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min pt-6">
             <InventoryDashboard />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
