'use client'

import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CallHistoryRecord } from '@/lib/types'

interface CallHistoryCardProps {
  record: CallHistoryRecord
}

const STATUS_LABELS: Record<CallHistoryRecord['status'], string> = {
  completed: 'Connected',
  no_match: 'No Match',
  abandoned: 'Abandoned',
}

const STATUS_VARIANTS: Record<
  CallHistoryRecord['status'],
  'default' | 'destructive' | 'secondary'
> = {
  completed: 'default',
  no_match: 'destructive',
  abandoned: 'secondary',
}

export function CallHistoryCard({ record }: CallHistoryCardProps) {
  const statusLabel = STATUS_LABELS[record.status]
  const statusVariant = STATUS_VARIANTS[record.status]
  const formattedDate = new Date(record.started_at).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4">
        <details>
          <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="flex flex-col gap-0.5">
              <span className="font-sans font-bold text-sm text-foreground">
                {record.service_type ?? 'Unknown service'}
                {record.location ? (
                  <span className="font-normal text-xs text-muted-foreground">
                    {' — '}
                    {record.location}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <span className="font-sans text-xs text-muted-foreground">{formattedDate}</span>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
          </summary>

          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {record.providers_contacted.length === 0 ? (
              <p className="font-sans text-xs text-muted-foreground">No providers contacted.</p>
            ) : (
              record.providers_contacted.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-sans text-xs text-foreground">{p.name}</span>
                  <span className="font-sans text-xs text-muted-foreground capitalize">
                    {p.outcome ?? (p as unknown as { status?: string }).status ?? 'unknown'}
                  </span>
                </div>
              ))
            )}
            {record.connected_provider ? (
              <div className="flex items-center gap-1 pt-1">
                <CheckCircle2 className="size-3 text-green-500" />
                <span className="font-sans text-xs text-foreground">
                  Connected to: {record.connected_provider}
                </span>
              </div>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
