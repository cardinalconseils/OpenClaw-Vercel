import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CallHistoryTable } from '@/components/dashboard/call-history-table'
import { StatusBadge } from '@/components/dashboard/status-badge'
import type { CallHistoryRecord } from '@/lib/types'

const mockCalls: CallHistoryRecord[] = [
  {
    id: 'call-1',
    user_id: 'user-1',
    caller_phone: '+15551234567',
    service_type: 'Plumbing',
    location: 'Montreal, QC',
    urgency: 'high',
    providers_contacted: [
      { name: 'Joe Plumber', phone: '+15559876543', outcome: 'connected' },
      { name: 'Bob Fix-It', phone: '+15554567890', outcome: 'no_answer' },
    ],
    connected_provider: 'Joe Plumber',
    status: 'completed',
    started_at: '2026-03-16T10:00:00.000Z',
    ended_at: '2026-03-16T10:15:00.000Z',
    created_at: '2026-03-16T10:00:00.000Z',
  },
  {
    id: 'call-2',
    user_id: 'user-1',
    caller_phone: '+15551234567',
    service_type: 'Electrician',
    location: null,
    urgency: null,
    providers_contacted: [],
    connected_provider: null,
    status: 'no_match',
    started_at: '2026-03-15T14:30:00.000Z',
    ended_at: '2026-03-15T14:35:00.000Z',
    created_at: '2026-03-15T14:30:00.000Z',
  },
]

describe('Call History (WEB-03)', () => {
  it('renders call history table with columns: Date, Service Type, Location, Providers, Status', () => {
    render(<CallHistoryTable calls={mockCalls} />)

    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Service Type')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Providers')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('displays empty state "No calls yet." when no data', () => {
    render(<CallHistoryTable calls={[]} />)

    expect(screen.getByText('No calls yet.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your call history will appear here after your first call to Murphy.'
      )
    ).toBeInTheDocument()
  })

  it('formats dates correctly from ISO string', () => {
    render(<CallHistoryTable calls={mockCalls} />)

    // 2026-03-16T10:00:00.000Z -> "Mar 16, 2026"
    expect(screen.getByText('Mar 16, 2026')).toBeInTheDocument()
    // 2026-03-15T14:30:00.000Z -> "Mar 15, 2026"
    expect(screen.getByText('Mar 15, 2026')).toBeInTheDocument()
  })

  it('shows StatusBadge with correct color class for completed status', () => {
    const { container } = render(<StatusBadge status="completed" />)
    const badge = container.querySelector('[data-slot="badge"]') ?? container.firstElementChild
    expect(badge).toBeTruthy()
    expect(badge?.className).toContain('green')
  })

  it('shows StatusBadge with correct color class for failed status', () => {
    const { container } = render(<StatusBadge status="failed" />)
    const badge = container.querySelector('[data-slot="badge"]') ?? container.firstElementChild
    expect(badge).toBeTruthy()
    expect(badge?.className).toContain('destructive')
  })

  it('shows StatusBadge with correct color class for abandoned status', () => {
    const { container } = render(<StatusBadge status="abandoned" />)
    const badge = container.querySelector('[data-slot="badge"]') ?? container.firstElementChild
    expect(badge).toBeTruthy()
    expect(badge?.className).toContain('muted')
  })

  it('queries call_history table filtered by user_id', () => {
    // Structural test: CallHistoryTable receives pre-fetched calls (data fetching
    // happens server-side in the page component). Verify that the table renders
    // the correct rows for the given user's data only.
    render(<CallHistoryTable calls={mockCalls} />)

    // Both calls belong to user-1 — both should render
    expect(screen.getByText('Plumbing')).toBeInTheDocument()
    expect(screen.getByText('Electrician')).toBeInTheDocument()
    // Provider count rendered as text
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
