'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface NotificationPrefs {
  emailNotifications: boolean
  smsRecaps: boolean
  missionUpdates: boolean
}

interface NotificationPreferencesProps {
  preferences: NotificationPrefs
}

interface ToggleItemProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleItem({ id, label, description, checked, onChange }: ToggleItemProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
        type="button"
      >
        <span
          className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export function NotificationPreferences({ preferences }: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(preferences)

  async function handleToggle(key: keyof NotificationPrefs, value: boolean) {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    const supabase = createClient()
    await supabase.auth.updateUser({
      data: { notification_prefs: updated },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose how you want to be notified about your calls and missions.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <ToggleItem
          id="emailNotifications"
          label="Email notifications"
          description="Receive email updates about calls and missions"
          checked={prefs.emailNotifications}
          onChange={(val) => handleToggle('emailNotifications', val)}
        />
        <ToggleItem
          id="smsRecaps"
          label="SMS recaps"
          description="Receive an SMS recap after each call"
          checked={prefs.smsRecaps}
          onChange={(val) => handleToggle('smsRecaps', val)}
        />
        <ToggleItem
          id="missionUpdates"
          label="Mission updates"
          description="Receive notifications when missions complete"
          checked={prefs.missionUpdates}
          onChange={(val) => handleToggle('missionUpdates', val)}
        />
      </CardContent>
    </Card>
  )
}
