'use client'

import { useState, useEffect } from 'react'

interface TocSection {
  id: string
  label: string
}

interface LegalTocProps {
  sections: TocSection[]
  mobile?: boolean
}

export function LegalToc({ sections, mobile = false }: LegalTocProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  const linkList = (
    <ul className="space-y-1">
      {sections.map(({ id, label }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            className={
              activeId === id
                ? 'block text-sm py-1 text-primary font-medium transition-colors'
                : 'block text-sm py-1 text-muted-foreground hover:text-foreground transition-colors'
            }
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  )

  if (mobile) {
    return (
      <details className="border border-border rounded-lg p-4">
        <summary className="font-sans font-bold text-xs uppercase tracking-widest text-muted-foreground cursor-pointer select-none">
          Contents
        </summary>
        <div className="mt-3">{linkList}</div>
      </details>
    )
  }

  return (
    <nav aria-label="Table of contents">
      <p className="font-sans font-bold text-xs uppercase tracking-widest text-muted-foreground mb-3">
        Contents
      </p>
      {linkList}
    </nav>
  )
}
