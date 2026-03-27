import { join } from "path"

const host = process.env.VITE_CLOUD_SERVER_HOST ?? "localhost"
const port = process.env.VITE_CLOUD_SERVER_PORT ?? "18080"
const appPort = parseInt(process.env.VITE_APP_PORT ?? "3000")
const prefix = process.env.VITE_API_PREFIX ?? ""
const basePath = (process.env.VITE_BASE_PATH ?? "").replace(/\/+$/, "") // e.g. "/costrict-web-portal"
const dist = join(import.meta.dir, "../dist")
const STATIC_CACHE_CONTROL = "public, max-age=2592000, immutable"
const ENTRY_CACHE_CONTROL = "no-cache, no-store, must-revalidate"

const rewrite = (p: string) => p.replace(new RegExp(`^${prefix}`), "")

/** Strip the deployment base path prefix so static files resolve to dist/ */
const stripBase = (p: string) =>
  basePath && p.startsWith(basePath) ? p.slice(basePath.length) || "/" : p

const isEntryDocument = (p: string) => p === "/" || p.endsWith(".html")

const withCacheHeaders = (file: Bun.BunFile, cacheControl: string) =>
  new Response(file, {
    headers: {
      "Cache-Control": cacheControl,
      ...(cacheControl === ENTRY_CACHE_CONTROL
        ? {
            Pragma: "no-cache",
            Expires: "0",
          }
        : {}),
    },
  })

const proxyHttp = async (req: Request) => {
  const url = new URL(req.url)
  url.hostname = host
  url.port = port
  url.protocol = "http:"
  url.pathname = rewrite(url.pathname)
  return fetch(new Request(url.toString(), req))
}

Bun.serve({
  port: appPort,
  hostname: "0.0.0.0",
  fetch(req, server) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path.startsWith(`${prefix}/cloud`)) {
      const upgraded = server.upgrade(req, { data: { path } } as any)
      if (upgraded) return
      return proxyHttp(req)
    }

    if (path.startsWith(`${prefix}/api`)) return proxyHttp(req)

    const filePath = stripBase(path)
    const file = Bun.file(join(dist, filePath))
    return file.exists().then((ok) =>
      ok
        ? withCacheHeaders(
            file,
            isEntryDocument(filePath) ? ENTRY_CACHE_CONTROL : STATIC_CACHE_CONTROL,
          )
        : withCacheHeaders(Bun.file(join(dist, "index.html")), ENTRY_CACHE_CONTROL),
    )
  },
  websocket: {
    async open(ws) {
      const path = (ws.data as any).path
      const upstream = new WebSocket(`ws://${host}:${port}${rewrite(path)}`)
      upstream.binaryType = "arraybuffer"
      ;(ws.data as any).upstream = upstream

      upstream.onmessage = (e) => ws.send(e.data)
      upstream.onclose = (e) => ws.close(e.code, e.reason)
      upstream.onerror = () => ws.close(1011, "upstream error")
    },
    message(ws, msg) {
      const upstream: WebSocket = (ws.data as any).upstream
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(msg)
    },
    close(ws, code, reason) {
      const upstream: WebSocket = (ws.data as any).upstream
      upstream?.close(code, reason)
    },
  },
})

console.log(`Listening on http://0.0.0.0:${appPort}`)
