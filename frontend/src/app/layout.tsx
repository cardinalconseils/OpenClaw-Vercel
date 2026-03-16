import type { Metadata } from 'next'
import './globals.css'

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
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
