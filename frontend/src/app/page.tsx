import { NavBar } from '@/components/landing/navbar'
import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { SocialProofSection } from '@/components/landing/social-proof-section'
import { Footer } from '@/components/landing/footer'

export default function LandingPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-background">
        <HeroSection />
        <FeaturesSection />
        <SocialProofSection />
      </main>
      <Footer />
    </>
  )
}
