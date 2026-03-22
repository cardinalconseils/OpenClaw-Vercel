import { createServer } from 'http'
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
const adminProxy = createProxyMiddleware({
  target: OPENCLAW_INTERNAL_URL,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/admin': '' },
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
    const parsedUrl = new URL(req.url ?? '/', `http://${hostname}:${port}`)

    if (parsedUrl.pathname.startsWith('/admin')) {
      return adminProxy(req, res, () => {
        handle(req, res)
      })
    }

    handle(req, res)
  })

  // Forward WebSocket upgrade events for /admin paths
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/admin')) {
      try {
        if (adminProxy.upgrade) {
          adminProxy.upgrade(req, socket as any, head)
        } else {
          console.error('[server] adminProxy.upgrade is not available')
          socket.destroy()
        }
      } catch (err) {
        console.error(`[server] WebSocket upgrade failed: ${(err as Error).message}`)
        socket.destroy()
      }
    }
  })

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> OpenClaw proxy target: ${OPENCLAW_INTERNAL_URL}`)
  })
}).catch((err) => {
  console.error('Failed to start Next.js application:', err)
  process.exit(1)
})
