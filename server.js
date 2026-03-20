"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT ?? '3000', 10);
const OPENCLAW_INTERNAL_URL = process.env.OPENCLAW_INTERNAL_URL ?? 'http://localhost:18789';
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
// Proxy /admin/* to OpenClaw Control UI
// pathRewrite strips /admin prefix — Control UI is served at root on port 18789
// If Control UI is at /openclaw on 18789, change '' to '/openclaw'
const adminProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: OPENCLAW_INTERNAL_URL,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/admin': '' },
    // Suppress proxy errors when OpenClaw gateway is not running (dev mode)
    on: {
        error: (err, _req, res) => {
            console.error('[proxy] OpenClaw gateway error:', err.message);
            if ('writeHead' in res && typeof res.writeHead === 'function') {
                ;
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end('OpenClaw gateway unavailable');
            }
        },
    },
});
app.prepare().then(() => {
    const server = (0, http_1.createServer)((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url ?? '/', true);
        // Proxy /admin requests to OpenClaw Control UI
        if (parsedUrl.pathname?.startsWith('/admin')) {
            return adminProxy(req, res, () => {
                // Fallback: if proxy doesn't handle, pass to Next.js
                handle(req, res, parsedUrl);
            });
        }
        // All other requests handled by Next.js
        handle(req, res, parsedUrl);
    });
    // Forward WebSocket upgrade events for /admin paths
    // Cast socket to any: http.Server 'upgrade' provides Duplex but http-proxy-middleware expects net.Socket
    server.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/admin')) {
            adminProxy.upgrade(req, socket, head);
        }
    });
    server.listen(port, hostname, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> OpenClaw proxy target: ${OPENCLAW_INTERNAL_URL}`);
    });
});
