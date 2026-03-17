import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { Mission } from '@/lib/types'

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/client before importing the component under test
// ---------------------------------------------------------------------------

type PostgresChangesCallback = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: unknown
  old: unknown
}) => void

let capturedCallback: PostgresChangesCallback | null = null
let capturedFilter: string | null = null
const mockRemoveChannel = vi.fn()
const mockSubscribe = vi.fn()

// Declare mockChannel first, then assign — avoids circular initialization
// eslint-disable-next-line prefer-const
let mockChannel: {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}

mockChannel = {
  on: vi.fn((event: string, opts: { filter?: string }, cb: PostgresChangesCallback) => {
    capturedFilter = opts.filter ?? null
    capturedCallback = cb
    return mockChannel
  }),
  subscribe: mockSubscribe,
}

mockSubscribe.mockReturnValue(mockChannel)

const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: mockRemoveChannel,
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

// Import component after mock is set up
const { MissionsTable } = await import('@/components/dashboard/missions-table')

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const makeM = (overrides: Partial<Mission> = {}): Mission => ({
  id: 'mission-1',
  userId: 'user-1',
  channel: 'voice',
  description: 'Find a plumber in Montreal',
  status: 'completed',
  steps: [],
  results: [],
  createdAt: '2026-03-16T10:00:00.000Z',
  updatedAt: '2026-03-16T10:15:00.000Z',
  ...overrides,
})

const mission1 = makeM({ id: 'mission-1', description: 'Find a plumber' })
const mission2 = makeM({ id: 'mission-2', description: 'Find an electrician', status: 'executing' })

beforeEach(() => {
  vi.clearAllMocks()
  capturedCallback = null
  capturedFilter = null
  mockChannel.on.mockImplementation(
    (event: string, opts: { filter?: string }, cb: PostgresChangesCallback) => {
      capturedFilter = opts.filter ?? null
      capturedCallback = cb
      return mockChannel
    }
  )
  mockChannel.subscribe.mockReturnValue(mockChannel)
  mockSupabase.channel.mockReturnValue(mockChannel)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Missions Realtime (WEB-04)', () => {
  it('subscribes to postgres_changes on missions table filtered by user_id', () => {
    render(<MissionsTable initialMissions={[mission1]} userId="user-1" />)

    expect(mockSupabase.channel).toHaveBeenCalledWith('missions-realtime')
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'missions',
        filter: 'user_id=eq.user-1',
      }),
      expect.any(Function)
    )
    expect(capturedFilter).toBe('user_id=eq.user-1')
    expect(mockSubscribe).toHaveBeenCalled()
  })

  it('updates local state on INSERT event', async () => {
    render(<MissionsTable initialMissions={[mission1]} userId="user-1" />)

    expect(screen.getByText('Find a plumber')).toBeInTheDocument()
    expect(screen.queryByText('Find an electrician')).not.toBeInTheDocument()

    await act(async () => {
      capturedCallback!({
        eventType: 'INSERT',
        new: mission2,
        old: {},
      })
    })

    // New mission prepended — both should be visible
    expect(screen.getByText('Find a plumber')).toBeInTheDocument()
    expect(screen.getByText('Find an electrician')).toBeInTheDocument()
  })

  it('updates local state on UPDATE event', async () => {
    render(<MissionsTable initialMissions={[mission1]} userId="user-1" />)

    const updatedMission1 = makeM({ id: 'mission-1', description: 'Find a plumber — updated' })

    await act(async () => {
      capturedCallback!({
        eventType: 'UPDATE',
        new: updatedMission1,
        old: mission1,
      })
    })

    expect(screen.getByText('Find a plumber — updated')).toBeInTheDocument()
    expect(screen.queryByText('Find a plumber')).not.toBeInTheDocument()
  })

  it('removes mission from local state on DELETE event', async () => {
    render(<MissionsTable initialMissions={[mission1, mission2]} userId="user-1" />)

    expect(screen.getByText('Find a plumber')).toBeInTheDocument()
    expect(screen.getByText('Find an electrician')).toBeInTheDocument()

    await act(async () => {
      capturedCallback!({
        eventType: 'DELETE',
        new: {},
        old: { id: 'mission-1' },
      })
    })

    expect(screen.queryByText('Find a plumber')).not.toBeInTheDocument()
    expect(screen.getByText('Find an electrician')).toBeInTheDocument()
  })

  it('calls removeChannel on component unmount (cleanup)', () => {
    const { unmount } = render(
      <MissionsTable initialMissions={[mission1]} userId="user-1" />
    )

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('renders empty state "No missions yet." when no data', () => {
    render(<MissionsTable initialMissions={[]} userId="user-1" />)

    expect(screen.getByText('No missions yet.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ask Murphy to run a mission the next time you call or send a message.'
      )
    ).toBeInTheDocument()
  })
})
