const testimonials = [
  {
    quote:
      'I needed a plumber at 10pm on a Sunday. Murphy found one in 3 minutes.',
    name: 'Sarah K.',
    location: 'Austin TX',
  },
  {
    quote:
      'No more calling five different contractors. One call to Murphy and I was connected.',
    name: 'James R.',
    location: 'Denver CO',
  },
  {
    quote:
      'The AI actually called providers and checked if they were available. Incredible.',
    name: 'Maria L.',
    location: 'Portland OR',
  },
]

export function SocialProofSection() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-sans text-3xl font-bold text-foreground text-center mb-10">
          What People Are Saying
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4"
            >
              <blockquote className="font-sans text-base font-normal text-foreground leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="mt-auto">
                <p className="font-sans text-sm font-bold text-foreground">
                  {t.name}
                </p>
                <p className="font-sans text-sm font-normal text-muted-foreground">
                  {t.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
