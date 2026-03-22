'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { CallHistoryCard } from '@/components/history/call-history-card'
import type { CallHistoryRecord } from '@/lib/types'

interface CallHistoryListProps {
  records: CallHistoryRecord[] | null
  loading: boolean
  searched: boolean
}

export function CallHistoryList({ records, loading, searched }: CallHistoryListProps) {
  if (loading) {
    return (
      <div className="space-y-3 mt-6">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  if (searched && records && records.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-sans text-sm text-muted-foreground mb-4">
          No calls found for this number yet.
        </p>
        <p className="font-sans text-sm text-muted-foreground">
          Need a service provider?{' '}
          <a href="tel:+18888306873" className="text-primary hover:underline">
            Call Murphy: +1 (888) 830-6873
          </a>
        </p>
      </div>
    )
  }

  if (records && records.length > 0) {
    return (
      <div className="space-y-3 mt-6">
        {records.map((r) => (
          <CallHistoryCard key={r.id} record={r} />
        ))}
      </div>
    )
  }

  return null
}
