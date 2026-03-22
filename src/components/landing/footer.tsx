import Link from 'next/link'

export function Footer() {
  const year = new Date().getFullYear()
  const bmcUrl =
    process.env.NEXT_PUBLIC_BUYMEACOFFEE_URL || 'https://buymeacoffee.com'

  return (
    <footer className="border-t border-border py-12 px-4 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Brand */}
          <div className="flex flex-col gap-2">
            <span className="font-sans font-bold text-lg text-foreground">
              Murphy
            </span>
            <span className="font-sans text-sm font-normal text-muted-foreground">
              One call replaces five.
            </span>
          </div>

          {/* BuyMeACoffee */}
          <div className="flex flex-col gap-2">
            <a
              href={bmcUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-sm font-normal text-primary hover:underline transition-colors"
            >
              Buy us a coffee ☕
            </a>
            <span className="font-sans text-sm font-normal text-muted-foreground">
              Like Murphy? Show your support.
            </span>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6">
          <p className="font-sans text-sm font-normal text-muted-foreground">
            &copy; {year} Murphy. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="font-sans text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/40 text-sm">|</span>
            <Link
              href="/terms"
              className="font-sans text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
