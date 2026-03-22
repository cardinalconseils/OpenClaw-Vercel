import type { Metadata } from 'next'
import { NavBar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import { HistoryLookupForm } from '@/components/history/history-lookup-form'

export const metadata: Metadata = {
  title: 'Call History — Murphy',
  description: 'Look up your Murphy call history by phone number',
}

export default function HistoryPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-foreground mb-2">
            Your Call History
          </h1>
          <p className="font-sans text-sm text-muted-foreground mb-8">
            Enter the phone number you called from to see your past service requests.
          </p>
          <HistoryLookupForm />
        </div>
      </main>
      <Footer />
    </>
  )
}
