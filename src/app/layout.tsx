import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import './globals.css'

/**
 * Font CSS variables are set via globals.css using @font-face with Google Fonts
 * CDN URLs. This avoids next/font/google build-time fetches that fail in
 * restricted network environments (Vercel Sandbox, some CI).
 */

export const metadata: Metadata = {
  title: 'Murphy — One call replaces five',
  description:
    'AI-powered phone concierge that finds and connects you with local service providers',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className="font-sans"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
