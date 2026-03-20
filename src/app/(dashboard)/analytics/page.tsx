import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ServiceTypeChart } from '@/components/dashboard/service-type-chart'
import type { CallHistoryRecord } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Analytics | Murphy',
}

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: calls } = await supabase
    .from('call_history')
    .select('*')
    .eq('user_id', user!.id)

  const callList = (calls as CallHistoryRecord[]) ?? []

  const totalCalls = callList.length
  const successfulConnections = callList.filter(
    (c) => c.status === 'completed'
  ).length
  const successRate =
    totalCalls > 0
      ? Math.round((successfulConnections / totalCalls) * 100)
      : 0

  // Group by service type
  const serviceTypeCounts: Record<string, number> = {}
  for (const call of callList) {
    const type = call.service_type ?? 'Unknown'
    serviceTypeCounts[type] = (serviceTypeCounts[type] ?? 0) + 1
  }

  const serviceTypeData = Object.entries(serviceTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ type, count }))

  const mostCommonService =
    serviceTypeData.length > 0 ? serviceTypeData[0].type : '—'

  const isEmpty = totalCalls === 0

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold font-sans">Analytics</h1>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-base font-bold text-foreground">No analytics yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your analytics will appear here after your first call to Murphy.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Total Calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalCalls}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{successRate}%</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  Most Common Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold truncate">{mostCommonService}</p>
              </CardContent>
            </Card>
          </div>

          {/* Service type chart */}
          {serviceTypeData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Calls by Service Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ServiceTypeChart data={serviceTypeData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
