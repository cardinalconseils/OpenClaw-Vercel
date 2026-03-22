import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CallHistoryRecord } from '@/lib/types'

const BASE_RECORD: CallHistoryRecord = {
  id: 'rec-1',
  user_id: 'user-1',
  caller_phone: '+15551234567',
  service_type: 'Plumber',
  location: 'Toronto, ON',
  urgency: null,
  providers_contacted: [
    { name: 'Joe Plumbing', phone: '+15559990000', outcome: 'no_answer' },
    { name: 'FastFix Co', phone: '+15558880000', outcome: 'available' },
  ],
  connected_provider: 'FastFix Co',
  status: 'completed',
  started_at: '2026-03-20T10:00:00Z',
  ended_at: '2026-03-20T10:15:00Z',
  created_at: '2026-03-20T10:00:00Z',
}

describe('CallHistoryCard', () => {
  it('renders service_type and location in the summary', async () => {
    const { CallHistoryCard } = await import(
      '@/components/history/call-history-card'
    )
    render(<CallHistoryCard record={BASE_RECORD} />)
    expect(screen.getByText(/plumber/i)).toBeTruthy()
    expect(screen.getByText(/toronto/i)).toBeTruthy()
  })

  it('renders "Connected" badge for completed status', async () => {
    const { CallHistoryCard } = await import(
      '@/components/history/call-history-card'
    )
    render(<CallHistoryCard record={BASE_RECORD} />)
    expect(screen.getByText('Connected')).toBeTruthy()
  })

  it('renders "No Match" badge for no_match status', async () => {
    const { CallHistoryCard } = await import(
      '@/components/history/call-history-card'
    )
    render(<CallHistoryCard record={{ ...BASE_RECORD, status: 'no_match', connected_provider: null }} />)
    expect(screen.getByText('No Match')).toBeTruthy()
  })

  it('renders "Abandoned" badge for abandoned status', async () => {
    const { CallHistoryCard } = await import(
      '@/components/history/call-history-card'
    )
    render(<CallHistoryCard record={{ ...BASE_RECORD, status: 'abandoned', connected_provider: null }} />)
    expect(screen.getByText('Abandoned')).toBeTruthy()
  })

  it('renders provider names in expanded details', async () => {
    const { CallHistoryCard } = await import(
      '@/components/history/call-history-card'
    )
    const { container } = render(<CallHistoryCard record={BASE_RECORD} />)
    // Force open the details element
    const details = container.querySelector('details')
    if (details) details.setAttribute('open', '')
    render(<CallHistoryCard record={BASE_RECORD} />)
    // Provider names should be present in DOM
    const allJoe = screen.getAllByText(/joe plumbing/i)
    expect(allJoe.length).toBeGreaterThan(0)
    const allFast = screen.getAllByText(/fastfix co/i)
    expect(allFast.length).toBeGreaterThan(0)
  })

  it('does NOT render provider phone numbers in card content', async () => {
    const { CallHistoryCard } = await import(
      '@/components/history/call-history-card'
    )
    const { container } = render(<CallHistoryCard record={BASE_RECORD} />)
    // Provider phones should not appear anywhere in the rendered HTML
    expect(container.innerHTML).not.toContain('+15559990000')
    expect(container.innerHTML).not.toContain('+15558880000')
  })

  it('renders "Connected to:" line when connected_provider is set', async () => {
    const { CallHistoryCard } = await import(
      '@/components/history/call-history-card'
    )
    render(<CallHistoryCard record={BASE_RECORD} />)
    expect(screen.getByText(/connected to: fastfix co/i)).toBeTruthy()
  })
})
