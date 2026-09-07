import { AppShell } from "@/components/app-shell"
import { StaffDashboard } from "@/components/staff-dashboard"

export default function Staff() {
  return (
    <AppShell title="Staff directory">
      <StaffDashboard />
    </AppShell>
  )
}
