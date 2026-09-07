import { AppShell } from "@/components/app-shell"
import { InventoryDashboard } from "@/components/inventory-dashboard"

export default function Home() {
  return (
    <AppShell title="Device inventory">
      <InventoryDashboard />
    </AppShell>
  )
}
