import { Phone, Search, Zap } from 'lucide-react'

const features = [
  {
    icon: Phone,
    title: 'Call Murphy',
    description:
      'Describe what you need — a plumber, an electrician, a locksmith. Murphy listens and understands.',
  },
  {
    icon: Search,
    title: 'AI Finds Providers',
    description:
      'Murphy searches local providers, checks ratings and availability, then calls them on your behalf.',
  },
  {
    icon: Zap,
    title: 'Live Connection',
    description:
      'Once a provider is available, Murphy connects you live — no hold music, no callbacks.',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="font-sans text-3xl font-bold text-foreground text-center mb-10">
          How It Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="p-6 rounded-xl"
                style={{
                  backdropFilter: 'blur(12px)',
                  backgroundColor: 'oklch(0.13 0 0 / 0.75)',
                  border: '1px solid oklch(0.30 0 0 / 0.5)',
                  borderRadius: '12px',
                }}
              >
                <div className="mb-4 inline-flex items-center justify-center size-12 rounded-xl bg-primary/10">
                  <Icon className="size-6 text-primary" />
                </div>
                <h3 className="font-sans text-lg font-bold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="font-sans text-base font-normal text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
