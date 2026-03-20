import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/dashboard/status-badge'
import type { CallHistoryRecord } from '@/lib/types'

interface CallHistoryTableProps {
  calls: CallHistoryRecord[]
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function CallHistoryTable({ calls }: CallHistoryTableProps) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base font-bold text-foreground">No calls yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your call history will appear here after your first call to Murphy.
        </p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Service Type</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Providers</TableHead>
          <TableHead>Connected To</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls.map((call) => (
          <TableRow key={call.id}>
            <TableCell className="text-muted-foreground">
              {formatDate(call.started_at)}
            </TableCell>
            <TableCell>
              {call.service_type ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {call.location ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {call.providers_contacted?.length ?? 0}
            </TableCell>
            <TableCell>
              {call.connected_provider ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={call.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
