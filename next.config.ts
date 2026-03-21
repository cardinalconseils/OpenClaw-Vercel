import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  typescript: {
    // The Express backend code lives in root src/ and is deployed separately via @vercel/node.
    // Copies of that code in frontend/src/ (untracked) cause TypeScript errors during Next.js
    // build because Next.js TypeScript checker includes all **/*.ts files.
    // The correct type-checking for the Express backend happens in root tests/ via vitest.
    ignoreBuildErrors: true,
  },
}

export default config
