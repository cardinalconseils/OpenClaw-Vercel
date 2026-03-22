import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock child components to avoid full render tree
vi.mock('@/components/landing/navbar', () => ({
  NavBar: () => <nav data-testid="navbar" />,
}))
vi.mock('@/components/landing/footer', () => ({
  Footer: () => <footer data-testid="footer" />,
}))
vi.mock('@/components/history/history-lookup-form', () => ({
  HistoryLookupForm: () => <form data-testid="history-lookup-form" />,
}))

describe('HistoryPage', () => {
  it('renders "Your Call History" heading', async () => {
    const { default: HistoryPage } = await import('@/app/history/page')
    render(<HistoryPage />)
    expect(screen.getByRole('heading', { name: /your call history/i })).toBeTruthy()
  })

  it('renders the HistoryLookupForm component', async () => {
    const { default: HistoryPage } = await import('@/app/history/page')
    render(<HistoryPage />)
    expect(screen.getByTestId('history-lookup-form')).toBeTruthy()
  })

  it('renders the navbar and footer', async () => {
    const { default: HistoryPage } = await import('@/app/history/page')
    render(<HistoryPage />)
    expect(screen.getByTestId('navbar')).toBeTruthy()
    expect(screen.getByTestId('footer')).toBeTruthy()
  })
})
