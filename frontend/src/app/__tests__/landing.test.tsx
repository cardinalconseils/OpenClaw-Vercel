import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Landing page component tests (WEB-01)
describe('Landing Page (WEB-01)', () => {
  describe('HeroSection', () => {
    it('renders hero headline "One call replaces five."', async () => {
      const { HeroSection } = await import('@/components/landing/hero-section')
      render(<HeroSection />)
      expect(
        screen.getByRole('heading', { name: /one call replaces five\./i })
      ).toBeTruthy()
    })

    it('displays phone number +1-888-830-6873 as clickable tel: link', async () => {
      const { HeroSection } = await import('@/components/landing/hero-section')
      render(<HeroSection />)
      const telLink = screen.getByRole('link', { name: /call murphy now/i })
      expect(telLink.getAttribute('href')).toBe('tel:+18888306873')
      // Phone number text also visible below CTA
      expect(screen.getByText('+1-888-830-6873')).toBeTruthy()
    })
  })

  describe('FeaturesSection', () => {
    it('renders "How It Works" features section with 3 cards', async () => {
      const { FeaturesSection } = await import(
        '@/components/landing/features-section'
      )
      render(<FeaturesSection />)
      expect(
        screen.getByRole('heading', { name: /how it works/i })
      ).toBeTruthy()
      // Verify 3 feature card titles
      expect(screen.getByText('Call Murphy')).toBeTruthy()
      expect(screen.getByText('AI Finds Providers')).toBeTruthy()
      expect(screen.getByText('Live Connection')).toBeTruthy()
    })
  })

  describe('SocialProofSection', () => {
    it('renders "What People Are Saying" social proof section', async () => {
      const { SocialProofSection } = await import(
        '@/components/landing/social-proof-section'
      )
      render(<SocialProofSection />)
      expect(
        screen.getByRole('heading', { name: /what people are saying/i })
      ).toBeTruthy()
      // Verify testimonials
      expect(screen.getByText(/Sarah K\./)).toBeTruthy()
      expect(screen.getByText(/James R\./)).toBeTruthy()
      expect(screen.getByText(/Maria L\./)).toBeTruthy()
    })
  })

  describe('NavBar', () => {
    it('renders navbar with "Sign In" link to /login', async () => {
      const { NavBar } = await import('@/components/landing/navbar')
      render(<NavBar />)
      const signInLinks = screen.getAllByRole('link', { name: /sign in/i })
      // At least one Sign In link points to /login
      const hasLoginLink = signInLinks.some(
        (link) => link.getAttribute('href') === '/login'
      )
      expect(hasLoginLink).toBe(true)
    })
  })

  describe('VoiceWave', () => {
    it('VoiceWave includes prefers-reduced-motion media query', async () => {
      const { VoiceWave } = await import('@/components/landing/voice-wave')
      const { container } = render(<VoiceWave />)
      // Check the inline style tag contains prefers-reduced-motion
      const styleEl = container.querySelector('style')
      expect(styleEl).toBeTruthy()
      expect(styleEl!.textContent).toContain('prefers-reduced-motion')
    })
  })
})
