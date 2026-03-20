import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
}

function getStatusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'complete':
      return 'bg-green-900/50 text-green-400 border-transparent'
    case 'live':
    case 'executing':
    case 'in-progress':
      return 'bg-primary/20 text-primary border-transparent'
    case 'failed':
      return 'bg-destructive/20 text-destructive border-transparent'
    case 'pending':
    case 'created':
    case 'planning':
    case 'planned':
      return 'bg-muted/20 text-muted-foreground border-transparent'
    case 'paused':
      return 'bg-yellow-900/50 text-yellow-400 border-transparent'
    case 'no_match':
      return 'bg-orange-900/50 text-orange-400 border-transparent'
    case 'abandoned':
      return 'bg-muted/20 text-muted-foreground border-transparent'
    default:
      return 'bg-muted/20 text-muted-foreground border-transparent'
  }
}

function getStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'no_match':
      return 'No Match'
    case 'in-progress':
      return 'In Progress'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge className={cn(getStatusClasses(status))}>
      {getStatusLabel(status)}
    </Badge>
  )
}
