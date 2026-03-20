import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MissionsTable } from '@/components/dashboard/missions-table'
import type { Mission } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Missions | Murphy',
}

export default async function MissionsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: missions } = await supabase
    .from('missions')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold font-sans">Missions</h1>
      <MissionsTable
        initialMissions={(missions as Mission[]) ?? []}
        userId={user!.id}
      />
    </div>
  )
}
