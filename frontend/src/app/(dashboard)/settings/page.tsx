import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { ProfileForm } from '@/components/dashboard/profile-form'
import { NotificationPreferences } from '@/components/dashboard/notification-preferences'
import { AccountManagement } from '@/components/dashboard/account-management'

export const metadata: Metadata = {
  title: 'Settings | Murphy',
}

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const defaultPrefs = {
    emailNotifications: true,
    smsRecaps: true,
    missionUpdates: true,
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-bold font-sans">Account Settings</h1>

      <section>
        <h2 className="text-xl font-bold mb-4">Profile</h2>
        <ProfileForm
          user={{
            email: user.email ?? '',
            fullName: user.user_metadata?.full_name,
            phone: user.user_metadata?.phone,
          }}
        />
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-bold mb-4">Notifications</h2>
        <NotificationPreferences
          preferences={
            user.user_metadata?.notification_prefs ?? defaultPrefs
          }
        />
      </section>

      <Separator />

      <section>
        <AccountManagement />
      </section>
    </div>
  )
}
