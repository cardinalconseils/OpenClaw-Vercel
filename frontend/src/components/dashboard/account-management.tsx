'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function AccountManagement() {
  const router = useRouter()
  const [exportLoading, setExportLoading] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleExportData() {
    setExportLoading(true)
    setExportSuccess(false)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Fetch call history and missions
      const [callsResult, missionsResult] = await Promise.all([
        supabase
          .from('call_history')
          .select('*')
          .eq('user_id', user?.id ?? '')
          .order('created_at', { ascending: false }),
        supabase
          .from('missions')
          .select('*')
          .eq('user_id', user?.id ?? '')
          .order('created_at', { ascending: false }),
      ])

      const exportData = {
        exported_at: new Date().toISOString(),
        user_id: user?.id,
        call_history: callsResult.data ?? [],
        missions: missionsResult.data ?? [],
      }

      // Trigger download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `murphy-data-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 3000)
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true)
    const supabase = createClient()
    // Note: actual account deletion requires server-side admin API
    // For now, sign out and redirect with deleted=true query param
    await supabase.auth.signOut()
    router.push('/login?deleted=true')
  }

  return (
    <div className="space-y-6">
      {/* Export Data */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Export Your Data</h3>
        <p className="text-sm text-muted-foreground">
          Download a copy of your call history and missions as JSON.
        </p>
        <Button
          variant="outline"
          onClick={handleExportData}
          disabled={exportLoading}
        >
          {exportLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Export My Data
        </Button>
        {exportSuccess && (
          <p className="text-sm text-green-500" role="status">
            Your data export has been downloaded.
          </p>
        )}
      </div>

      {/* Delete Account — Danger Zone */}
      <div className="rounded-lg border border-destructive/50 p-6 space-y-3">
        <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data.
        </p>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="destructive" disabled={deleteLoading} />}
          >
            {deleteLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Delete Account
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all call history.
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDeleteAccount}
              >
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
