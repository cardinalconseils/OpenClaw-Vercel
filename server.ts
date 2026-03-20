import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { createProxyMiddleware } from 'http-proxy-middleware'

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT ?? '3000', 10)

const OPENCLAW_INTERNAL_URL =
  process.env.OPENCLAW_INTERNAL_URL ?? 'http://localhost:18789'

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Proxy /admin/* to OpenClaw Control UI
// pathRewrite strips /admin prefix — Control UI is served at root on port 18789
// If Control UI is at /openclaw on 18789, change '' to '/openclaw'
const adminProxy = createProxyMiddleware({
  target: OPENCLAW_INTERNAL_URL,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/admin': '' },
  // Suppress proxy errors when OpenClaw gateway is not running (dev mode)
  on: {
    error: (err, _req, res) => {
      console.error('[proxy] OpenClaw gateway error:', err.message)
      if ('writeHead' in res && typeof res.writeHead === 'function') {
        ;(res as any).writeHead(502, { 'Content-Type': 'text/plain' })
        ;(res as any).end('OpenClaw gateway unavailable')
      }
    },
  },
})

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)

    // Proxy /admin requests to OpenClaw Control UI
    if (parsedUrl.pathname?.startsWith('/admin')) {
      return adminProxy(req, res, () => {
        // Fallback: if proxy doesn't handle, pass to Next.js
        handle(req, res, parsedUrl)
      })
    }

    // All other requests handled by Next.js
    handle(req, res, parsedUrl)
  })

  // Forward WebSocket upgrade events for /admin paths
  // Cast socket to any: http.Server 'upgrade' provides Duplex but http-proxy-middleware expects net.Socket
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/admin')) {
      adminProxy.upgrade!(req, socket as any, head)
    }
  })

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> OpenClaw proxy target: ${OPENCLAW_INTERNAL_URL}`)
  })
})
