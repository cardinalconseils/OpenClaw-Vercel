import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('NavBar', () => {
  it('renders Sign In link pointing to /login', async () => {
    const { NavBar } = await import('@/components/landing/navbar')
    render(<NavBar />)
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i })
    const hasLoginLink = signInLinks.some(
      (link) => link.getAttribute('href') === '/login'
    )
    expect(hasLoginLink).toBe(true)
  })

  it('renders History link pointing to /history', async () => {
    const { NavBar } = await import('@/components/landing/navbar')
    render(<NavBar />)
    const historyLinks = screen.getAllByRole('link', { name: /history/i })
    const hasHistoryLink = historyLinks.some(
      (link) => link.getAttribute('href') === '/history'
    )
    expect(hasHistoryLink).toBe(true)
  })

  it('renders Murphy logo link', async () => {
    const { NavBar } = await import('@/components/landing/navbar')
    render(<NavBar />)
    const murphyLink = screen.getByRole('link', { name: /murphy/i })
    expect(murphyLink).toBeTruthy()
    expect(murphyLink.getAttribute('href')).toBe('/')
  })
})
