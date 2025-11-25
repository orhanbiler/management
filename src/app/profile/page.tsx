"use client"

import { ProfilePage } from "@/components/profile-page"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ModeToggle } from "@/components/mode-toggle"
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
import { LoginForm } from "@/components/login-form"

function ProfileApp() {
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
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b px-4 bg-background transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
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
                  <BreadcrumbPage>Profile</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min pt-6">
            <ProfilePage />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Profile() {
  return (
    <AuthProvider>
      <ProfileApp />
    </AuthProvider>
  )
}




