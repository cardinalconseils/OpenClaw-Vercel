import { describe, it } from 'vitest'

describe('Missions Realtime (WEB-04)', () => {
  it.todo('subscribes to postgres_changes on missions table filtered by user_id')
  it.todo('updates local state on INSERT event')
  it.todo('updates local state on UPDATE event')
  it.todo('removes mission from local state on DELETE event')
  it.todo('calls removeChannel on component unmount (cleanup)')
  it.todo('renders empty state "No missions yet." when no data')
})
