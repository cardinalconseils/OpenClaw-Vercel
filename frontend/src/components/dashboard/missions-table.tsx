'use client'

import * as React from 'react'
import { Phone, MessageSquare, MessageCircle } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { StatusBadge } from '@/components/dashboard/status-badge'
import { createClient } from '@/lib/supabase/client'
import type { Mission, MissionChannel } from '@/lib/types'

interface MissionsTableProps {
  initialMissions: Mission[]
  userId: string
}

function ChannelIcon({ channel }: { channel: MissionChannel }) {
  switch (channel) {
    case 'voice':
      return <Phone className="h-4 w-4 text-muted-foreground" />
    case 'sms':
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />
    case 'chat':
      return <MessageCircle className="h-4 w-4 text-muted-foreground" />
    default:
      return <MessageCircle className="h-4 w-4 text-muted-foreground" />
  }
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

export function MissionsTable({ initialMissions, userId }: MissionsTableProps) {
  const [missions, setMissions] = React.useState<Mission[]>(initialMissions)

  React.useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('missions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'missions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setMissions((prev) => {
            if (payload.eventType === 'INSERT') {
              return [payload.new as Mission, ...prev]
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((m) =>
                m.id === (payload.new as Mission).id
                  ? (payload.new as Mission)
                  : m
              )
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter(
                (m) => m.id !== (payload.old as { id: string }).id
              )
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base font-bold text-foreground">No missions yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask Murphy to run a mission the next time you call or send a message.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {missions.map((mission) => {
        const completedSteps = mission.steps?.filter(
          (s) => s.status === 'completed'
        ).length ?? 0
        const totalSteps = mission.steps?.length ?? 0

        return (
          <Card key={mission.id} className="hover:ring-foreground/20 transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChannelIcon channel={mission.channel} />
                  <StatusBadge status={mission.status} />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDate(mission.createdAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground mb-2">
                {truncate(mission.description, 100)}
              </p>
              {totalSteps > 0 && (
                <p className="text-xs text-muted-foreground">
                  {completedSteps}/{totalSteps} steps completed
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
