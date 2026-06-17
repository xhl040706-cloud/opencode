import fs from "node:fs/promises"
import path from "node:path"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import { fileURLToPath } from "url"

// ─── Demo 设备 Mock 后端 ──────────────────────────────────────────
// 仅对 demo-device 生效，配合 src/pages/workspace/lib/url.ts 的相对路径，
// 让本地 dev 的 /workspace/demo 路由不依赖真实后端即可进入完整工作区。

const DEMO_DEVICE_ID = "demo-device"
const DEMO_WORKSPACE_ID = "hrm-approval-demo"
const DEMO_DIRECTORY = "/Users/demo/Projects/costrict-hrm-demo"

const DEVICE_PROXY_PREFIX = `/cloud/device/${DEMO_DEVICE_ID}/proxy`

const TEXT_FILE_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".css", ".csv", ".cts", ".go", ".h", ".hpp",
  ".htm", ".html", ".java", ".js", ".json", ".jsx", ".md", ".mjs",
  ".mts", ".py", ".rb", ".rs", ".scss", ".sh", ".sql", ".svg",
  ".toml", ".ts", ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
])

function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") return ""
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
}

function stripBasePath(pathname, basePath) {
  const normalizedBasePath = normalizeBasePath(basePath)
  if (!normalizedBasePath) return pathname
  if (pathname === normalizedBasePath) return "/"
  if (pathname.startsWith(normalizedBasePath + "/")) {
    return pathname.slice(normalizedBasePath.length)
  }
  return pathname
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader("Content-Type", "application/json; charset=utf-8")
  response.setHeader("Cache-Control", "no-store")
  response.end(JSON.stringify(payload))
}

function resolveDevicePath(inputPath) {
  const root = DEMO_DIRECTORY
  const clean = (inputPath || "").trim()
  if (!clean || clean === root) return root
  if (path.isAbsolute(clean)) {
    const abs = path.resolve(clean)
    if (abs === root || abs.startsWith(root + path.sep)) return abs
    return null
  }
  const abs = path.resolve(root, clean.replace(/^\/+/, ""))
  if (abs === root || abs.startsWith(root + path.sep)) return abs
  return null
}

async function handleDemoDeviceApi(apiPath, requestUrl, request, response) {
  // SSE 事件流：保持连接，仅发心跳
  if (apiPath === "/api/v1/events") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    response.write(": demo-event-stream-connected\n\n")
    const heartbeat = setInterval(() => {
      response.write(`: ping ${Date.now()}\n\n`)
    }, 15_000)
    request.on("close", () => clearInterval(heartbeat))
    return
  }

  // 静态 mock（device 工作页 bootstrap 必需端点）
  const STATIC_MOCK = {
    "/api/v1/runtime/health": { status: "ok", version: "demo-1.0.0" },
    "/api/v1/runtime/init-status": {
      directory: DEMO_DIRECTORY,
      ready: true,
      agent: { state: "session_active", healthy: true },
      prewarm: {
        status: "completed",
        started_at: new Date(0).toISOString(),
        finished_at: new Date(0).toISOString(),
      },
    },
    "/api/v1/runtime/config": {
      allow_absolute_paths: true,
      max_list_depth: 5,
      allowed_operations: ["file_tree", "file_read", "diff"],
      blacklist_count: 0,
      whitelist_enabled: false,
    },
    "/api/v1/runtime/vcs": {
      directory: DEMO_DIRECTORY,
      branch: "demo/approval-status-fix",
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
    },
    "/api/v1/agents/health": {
      agents: [
        { id: "code", name: "CoStrict Coding Agent", available: true, healthy: true, state: "session_active" },
      ],
    },
    "/api/v1/agents/session-modes": [
      { id: "code", name: "CoStrict Coding Agent" },
    ],
    "/api/v1/agents/models": {
      connected: [{ id: "demo-model", name: "Demo Coding Model" }],
    },
    "/api/v1/agents/commands": [],
    "/api/v1/conversations": [
      {
        id: "demo-session-approval-fix",
        title: "修复审批状态异常",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
    "/api/v1/conversations/status": {},
    "/api/v1/permissions": [],
    "/api/v1/questions": [],
  }

  if (apiPath in STATIC_MOCK) {
    sendJson(response, 200, STATIC_MOCK[apiPath])
    return
  }

  // 文件树：返回空目录（Demo 无真实文件系统）
  if (apiPath === "/api/v1/runtime/files") {
    const inputPath = requestUrl.searchParams.get("path") || ""
    sendJson(response, 200, { path: inputPath, entries: [] })
    return
  }

  // 文件元信息
  if (apiPath === "/api/v1/runtime/files/meta") {
    sendJson(response, 404, { code: "FILE_NOT_FOUND", error: "File not found" })
    return
  }

  // 文件内容
  if (apiPath === "/api/v1/runtime/files/content") {
    sendJson(response, 404, { code: "FILE_NOT_FOUND", error: "File not found" })
    return
  }

  // 会话消息 / todo / tasks / diff 等列表端点默认返回空集合
  if (
    apiPath.startsWith("/api/v1/conversations/") &&
    (apiPath.endsWith("/messages") ||
      apiPath.endsWith("/todo") ||
      apiPath.endsWith("/tasks") ||
      apiPath.endsWith("/diff"))
  ) {
    sendJson(response, 200, [])
    return
  }

  // terminal 相关端点
  if (apiPath === "/api/v1/terminal/sessions") {
    sendJson(response, 200, [])
    return
  }

  // 其它未明确 mock 的端点：返回空对象，保证前端不阻塞
  sendJson(response, 200, {})
}

function localDemoDevicePlugin() {
  let resolvedBasePath = ""
  return {
    name: "opencode-desktop:demo-device-mock",
    configResolved(config) {
      resolvedBasePath = config.base ?? ""
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          const requestUrl = new URL(request.url || "/", "http://localhost")
          const pathname = stripBasePath(requestUrl.pathname, resolvedBasePath)

          // workspaceApi.get(hrm-approval-demo) — 提供假 workspace 详情
          if (pathname === `/api/workspaces/${DEMO_WORKSPACE_ID}`) {
            sendJson(response, 200, {
              workspace: {
                id: DEMO_WORKSPACE_ID,
                name: "HRM 审批示例空间",
                userId: "demo-user",
                deviceId: DEMO_DEVICE_ID,
                deviceUniqueId: DEMO_DEVICE_ID,
                isDefault: true,
                status: "active",
                deviceStatus: "online",
                directories: [
                  {
                    id: "demo-directory",
                    workspaceId: DEMO_WORKSPACE_ID,
                    name: "costrict-hrm-demo",
                    path: DEMO_DIRECTORY,
                    isDefault: true,
                    orderIndex: 0,
                    createdAt: new Date(0).toISOString(),
                    updatedAt: new Date(0).toISOString(),
                  },
                ],
                settings: {},
                createdAt: new Date(0).toISOString(),
                updatedAt: new Date(0).toISOString(),
              },
            })
            return
          }

          if (!pathname.startsWith(DEVICE_PROXY_PREFIX)) {
            next()
            return
          }

          const apiPath = pathname.slice(DEVICE_PROXY_PREFIX.length)
          await handleDemoDeviceApi(apiPath, requestUrl, request, response)
        } catch (error) {
          sendJson(response, 500, { error: (error && error.message) || "Demo device mock failed" })
        }
      })
    },
  }
}

/**
 * @type {import("vite").PluginOption}
 */
export default [
  {
    name: "opencode-desktop:config",
    config() {
      return {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        worker: {
          format: "es",
        },
      }
    },
  },
  localDemoDevicePlugin(),
  tailwindcss(),
  solidPlugin(),
  VitePWA({
    registerType: "autoUpdate",
    injectRegister: false,
    manifest: {
      name: "CoStrict Cloud",
      short_name: "CoStrict",
      description: "AI-powered development tool",
      theme_color: "#F8F7F7",
      background_color: "#F8F7F7",
      display: "standalone",
      start_url: "./m/workspace/",
      scope: "./",
      icons: [
        {
          src: "favicon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2,ttf}"],
      globIgnores: ["**/index.html"],
      navigateFallback: null,
    },
  }),
]
