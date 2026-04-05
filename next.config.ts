import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  typescript: {
    // Server-side files (src/lib/ai, src/lib/voice, etc.) are excluded from
    // tsconfig.json but Next.js still picks them up. These have external deps
    // (openai, telnyx) not in the frontend package.json. Type checking for
    // frontend code is enforced by `npx tsc --noEmit` in CI.
    ignoreBuildErrors: true,
  },
}

export default config
