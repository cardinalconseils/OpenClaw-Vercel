import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <DashboardShell
      user={{
        email: user.email ?? '',
        avatarUrl: user.user_metadata?.avatar_url,
      }}
    >
      {children}
    </DashboardShell>
  )
}
