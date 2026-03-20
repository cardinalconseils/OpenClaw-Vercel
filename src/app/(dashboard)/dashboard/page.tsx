import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CallHistoryTable } from '@/components/dashboard/call-history-table'
import type { CallHistoryRecord } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Your Calls | Murphy',
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: calls } = await supabase
    .from('call_history')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold font-sans">Your Calls</h1>
      <CallHistoryTable calls={(calls as CallHistoryRecord[]) ?? []} />
    </div>
  )
}
