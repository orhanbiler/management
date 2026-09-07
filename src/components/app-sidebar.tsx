"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Monitor,
  Users,
  Settings2,
  LogOut,
  ChevronUp,
  ArrowUpRight,
  ShieldCheck,
  Layers3
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userEmail?: string | null
  onSignOut?: () => void
}

export function AppSidebar({
  userEmail,
  onSignOut,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const navigation = [
    { href: "/", label: "Device inventory", icon: Monitor },
    { href: "/staff", label: "Staff directory", icon: Users },
    { href: "/profile", label: "Account & settings", icon: Settings2 }
  ]

  return (
    <Sidebar collapsible="icon" className="border-0" {...props}>
      <SidebarHeader className="px-5 pt-7 pb-8 group-data-[collapsible=icon]:px-4">
        <Link
          href="/"
          aria-label="Device Manager home"
          onClick={() => setOpenMobile(false)}
          className="flex items-center gap-3"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#efbc9e] text-[#20392f]">
            <Layers3 className="size-5" strokeWidth={1.8} />
          </span>
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold tracking-tight text-white">
              Device Manager<span className="text-[#efbc9e]">.</span>
            </div>
            <div className="mt-0.5 text-[9px] tracking-wide text-sidebar-foreground/70">
              CHEVERLY PD · MARYLAND
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-2 px-3 text-[9px] tracking-[0.16em] text-sidebar-foreground/60">
            WORKSPACE
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navigation.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === href}
                    tooltip={label}
                    className="h-11 gap-3 rounded-lg px-3 text-[12px] data-[active=true]:font-medium group-data-[collapsible=icon]:size-11!"
                  >
                    <Link
                      href={href}
                      aria-current={pathname === href ? "page" : undefined}
                      onClick={() => setOpenMobile(false)}
                    >
                      <Icon className="size-4!" strokeWidth={1.7} />
                      <span>{label}</span>
                      {pathname === href && (
                        <span className="ml-auto size-1.5 rounded-full bg-[#efbc9e] group-data-[collapsible=icon]:hidden" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto mb-5 rounded-xl border border-sidebar-border bg-white/[0.025] p-4 group-data-[collapsible=icon]:hidden">
          <ShieldCheck
            className="mb-3 size-5 text-[#d7ba9f]"
            strokeWidth={1.5}
          />
          <p className="text-xs font-medium text-white">
            Ready for the next shift.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-sidebar-foreground/80">
            Keep your devices accounted for and your people connected.
          </p>
          <Link
            href="/staff"
            onClick={() => setOpenMobile(false)}
            className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium text-[#efbc9e]"
          >
            View staff directory <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Your account"
                  className="gap-3 group-data-[collapsible=icon]:size-11!"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#3b5148] text-[10px] font-semibold text-[#f0d4bc]">
                    {userEmail?.slice(0, 2).toUpperCase() || "CP"}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1 text-left group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-xs font-medium text-white">
                      {userEmail?.split("@")[0] || "Your account"}
                    </span>
                    <span className="truncate text-[10px] text-sidebar-foreground/70">
                      {userEmail}
                    </span>
                  </div>
                  <ChevronUp className="size-3! group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <Settings2 />
                    Account & settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
