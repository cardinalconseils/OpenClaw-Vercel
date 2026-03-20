import React from 'react'
import { NavBar } from '@/components/landing/navbar'
import { Footer } from '@/components/landing/footer'
import { LegalToc } from './legal-toc'

interface TocSection {
  id: string
  label: string
}

interface LegalPageLayoutProps {
  sections: TocSection[]
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export function LegalPageLayout({
  sections,
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-background pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <h1 className="font-display font-bold text-4xl md:text-5xl text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
          <p className="mt-1 text-xs text-muted-foreground italic">
            This document was generated for informational purposes. Consult an attorney for legal advice.
          </p>

          {/* Mobile ToC — visible below lg */}
          <div className="lg:hidden mb-6 mt-6">
            <LegalToc sections={sections} mobile />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12 mt-8">
            {/* Sticky ToC sidebar — desktop only */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <LegalToc sections={sections} />
              </div>
            </aside>

            {/* Content */}
            <article className="min-w-0">
              {children}
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
