import { AppShell } from "@/components/app-shell"
import { ProfilePage } from "@/components/profile-page"

export default function Profile() {
  return (
    <AppShell title="Account & settings">
      <ProfilePage />
    </AppShell>
  )
}
