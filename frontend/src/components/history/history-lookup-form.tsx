'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CallHistoryList } from '@/components/history/call-history-list'
import type { CallHistoryRecord } from '@/lib/types'

export function HistoryLookupForm() {
  const [phone, setPhone] = useState('')
  const [records, setRecords] = useState<CallHistoryRecord[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/call-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })

      if (response.status === 429) {
        setError('Too many requests. Please wait a minute.')
        return
      }

      if (response.status === 400) {
        setError('Please enter a valid phone number.')
        return
      }

      if (!response.ok) {
        setError('Something went wrong. Please try again.')
        return
      }

      const data = await response.json()
      setRecords(data.records)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="tel"
          placeholder="(555) 123-4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          <Search className="size-4 mr-2" />
          Look Up
        </Button>
      </form>
      {error ? (
        <p className="text-sm text-destructive mt-2">{error}</p>
      ) : null}
      <CallHistoryList records={records} loading={loading} searched={searched} />
    </div>
  )
}
