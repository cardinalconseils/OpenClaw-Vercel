import { VoiceWave } from '@/components/landing/voice-wave'

export function HeroSection() {
  return (
    <section className="pt-32 pb-16 px-4">
      <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-6">
        {/* Display headline */}
        <h1 className="font-display text-6xl font-bold leading-[1.1] text-foreground">
          One call replaces five.
        </h1>

        {/* Sub-headline */}
        <p className="font-sans text-base font-normal leading-relaxed text-muted-foreground max-w-[640px]">
          Murphy finds local service providers, calls them to check availability,
          then connects you live — all while you wait on the line.
        </p>

        {/* Voice wave animation */}
        <VoiceWave />

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <a
            href="tel:+18888306873"
            className="inline-flex items-center justify-center rounded-full px-8 py-4 text-lg font-bold uppercase bg-primary text-primary-foreground min-h-[52px] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Call Murphy Now
          </a>
          <span className="font-sans text-sm font-normal text-muted-foreground">
            +1-888-830-6873
          </span>
        </div>
      </div>
    </section>
  )
}
