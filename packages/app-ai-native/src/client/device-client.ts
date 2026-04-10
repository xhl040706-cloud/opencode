import type { Event, OpencodeClient } from "@opencode-ai/sdk/v2/client"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { createDeviceTransport } from "./device-transport"

type ClientOpts = {
  baseUrl: string
  headers?: HeadersInit
  fetch?: typeof globalThis.fetch
  signal?: AbortSignal
  directory?: string
  throwOnError?: boolean
}

export type DeviceClient = {
  baseUrl: string
  transport: ReturnType<typeof createDeviceTransport>
  raw: OpencodeClient
  getConfig(): { baseUrl: string }
  global: {
    health: OpencodeClient["global"]["health"]
    event: OpencodeClient["global"]["event"]
    dispose: OpencodeClient["global"]["dispose"]
  }
  path: {
    get: () => Promise<{ data: unknown }>
  }
  app: {
    agents: () => Promise<{ data: unknown }>
  }
  provider: OpencodeClient["provider"]
  auth: OpencodeClient["auth"]
  worktree: OpencodeClient["worktree"]
  project: OpencodeClient["project"]
  file: OpencodeClient["file"]
  find: OpencodeClient["find"]
  pty: OpencodeClient["pty"]
  command: OpencodeClient["command"]
  mcp: {
    status: () => Promise<{ data: unknown }>
    connect: OpencodeClient["mcp"]["connect"]
    disconnect: OpencodeClient["mcp"]["disconnect"]
  }
  lsp: {
    status: () => Promise<{ data: unknown }>
  }
  vcs: {
    get: () => Promise<{ data: unknown }>
  }
  instance: {
    dispose: OpencodeClient["instance"]["dispose"]
  }
  permission: {
    list: () => Promise<{ data: unknown }>
    respond: OpencodeClient["permission"]["respond"]
  }
  question: {
    list: () => Promise<{ data: unknown }>
    reply: OpencodeClient["question"]["reply"]
    reject: OpencodeClient["question"]["reject"]
  }
  session: {
    create: (body?: unknown) => Promise<{ data: unknown }>
    get: ({ sessionID }: { sessionID: string }) => Promise<{ data: unknown }>
    list: (input?: QueryInput) => Promise<{ data: unknown }>
    messages: (input: { sessionID: string; directory?: string; limit?: number }) => Promise<{ data: unknown }>
    status: () => Promise<{ data: unknown }>
    diff: ({ sessionID }: { sessionID: string }) => Promise<{ data: unknown }>
    todo: ({ sessionID }: { sessionID: string }) => Promise<{ data: unknown }>
    update: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) => Promise<{ data: unknown }>
    delete: ({ sessionID }: { sessionID: string }) => Promise<{ data: unknown }>
    abort: ({ sessionID }: { sessionID: string }) => Promise<{ data: unknown }>
    revert: ({ sessionID, messageID }: { sessionID: string; messageID: string }) => Promise<{ data: unknown }>
    unrevert: ({ sessionID }: { sessionID: string }) => Promise<{ data: unknown }>
    summarize: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) => Promise<{ data: unknown }>
    shell: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) => Promise<{ data: unknown }>
    command: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) => Promise<{ data: unknown }>
    promptAsync: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) => Promise<{ data: unknown }>
    share: OpencodeClient["session"]["share"]
    unshare: OpencodeClient["session"]["unshare"]
  }
  runtime: {
    health: () => Promise<{ healthy: boolean; version?: string }>
    targetContext: (directory?: string) => Promise<unknown>
    modelCapabilities: (directory?: string) => Promise<unknown>
    agents: (directory?: string) => Promise<unknown>
    commands: (directory?: string) => Promise<unknown>
    fileList: (path: string) => Promise<unknown>
    fileRead: (path: string) => Promise<unknown>
    findFiles: (query: string, dirs: "true" | "false", directory?: string) => Promise<unknown>
    mcpStatus: (directory?: string) => Promise<unknown>
    lspStatus: (directory?: string) => Promise<unknown>
    vcs: (directory?: string) => Promise<unknown>
    terminalCreate: (input: unknown) => Promise<unknown>
    terminalUpdate: (input: { ptyID: string } & Record<string, unknown>) => Promise<unknown>
    terminalRemove: (ptyID: string) => Promise<unknown>
    instanceDispose: (directory?: string) => Promise<unknown>
  }
  interaction: {
    permissions: (directory?: string) => Promise<unknown>
    permissionRespond: (requestID: string, input: unknown) => Promise<unknown>
    questions: (directory?: string) => Promise<unknown>
    questionReply: (requestID: string, input: unknown) => Promise<unknown>
    questionReject: (requestID: string) => Promise<unknown>
  }
  conversation: {
    create: (body?: unknown) => Promise<unknown>
    get: (sessionID: string, directory?: string) => Promise<unknown>
    list: (input?: QueryInput) => Promise<unknown>
    messages: (sessionID: string, input?: QueryInput) => Promise<unknown>
    status: (directory?: string) => Promise<unknown>
    diff: (sessionID: string, directory?: string) => Promise<unknown>
    todo: (sessionID: string, directory?: string) => Promise<unknown>
    update: (sessionID: string, body: unknown) => Promise<unknown>
    delete: (sessionID: string) => Promise<unknown>
    abort: (sessionID: string) => Promise<unknown>
    revert: (sessionID: string, messageID: string) => Promise<unknown>
    unrevert: (sessionID: string) => Promise<unknown>
    summarize: (sessionID: string, body?: unknown) => Promise<unknown>
    shell: (sessionID: string, body: unknown) => Promise<unknown>
    command: (sessionID: string, body: unknown) => Promise<unknown>
    prompt: (sessionID: string, body: unknown) => Promise<unknown>
    promptAsync: (sessionID: string, body: unknown) => Promise<unknown>
  }
  event: {
    stream: (input?: { signal?: AbortSignal; onSseError?: (error: unknown) => void }) => Promise<{ stream: AsyncIterable<{ directory?: string; payload: Event }> }>
  }
  createClient(next: Omit<ClientOpts, "baseUrl" | "headers" | "fetch">): DeviceClient
}

function auth(headers: HeadersInit | undefined, baseUrl: string) {
  return {
    headers,
    baseUrl,
  }
}

export function createDeviceClient(opts: ClientOpts): DeviceClient {
  const http = createDeviceTransport(opts)
  const sdk = createOpencodeClient({
    ...auth(opts.headers, opts.baseUrl),
    fetch: opts.fetch,
    signal: opts.signal,
    directory: opts.directory,
    throwOnError: opts.throwOnError,
  })

  const dir = (input?: string) => input ?? opts.directory ?? ""

  return {
    baseUrl: opts.baseUrl,
    transport: http,
    raw: sdk as OpencodeClient,
    getConfig() {
      return { baseUrl: opts.baseUrl }
    },
    global: {
      health: () => sdk.global.health(),
      event: sdk.global.event.bind(sdk.global),
      dispose: () => sdk.global.dispose(),
    },
    path: {
      get: () => http.get("/path", { directory: dir() }).then((data) => ({ data })),
    },
    app: {
      agents: () => http.get("/agent", { directory: dir() }).then((data) => ({ data })),
    },
    provider: sdk.provider,
    auth: sdk.auth,
    worktree: sdk.worktree,
    project: sdk.project,
    file: sdk.file,
    find: sdk.find,
    pty: sdk.pty,
    command: sdk.command,
    mcp: {
      status: () => http.get("/mcp", { directory: dir() }).then((data) => ({ data })),
      connect: sdk.mcp.connect,
      disconnect: sdk.mcp.disconnect,
    },
    lsp: {
      status: () => http.get("/lsp", { directory: dir() }).then((data) => ({ data })),
    },
    vcs: {
      get: () => http.get("/vcs", { directory: dir() }).then((data) => ({ data })),
    },
    instance: {
      dispose: sdk.instance.dispose,
    },
    permission: {
      list: () => http.get("/permission", { directory: dir() }).then((data) => ({ data })),
      respond: sdk.permission.respond,
    },
    question: {
      list: () => http.get("/question", { directory: dir() }).then((data) => ({ data })),
      reply: sdk.question.reply,
      reject: sdk.question.reject,
    },
    session: {
      create: (body?: unknown) => http.post("/session", body).then((data) => ({ data })),
      get: ({ sessionID }: { sessionID: string }) => http.get(`/session/${sessionID}`, { directory: dir() }).then((data) => ({ data })),
      list: (input?: QueryInput) => http.get("/session", { directory: dir(), ...input }).then((data) => ({ data })),
      messages: ({ sessionID, directory, limit }: { sessionID: string; directory?: string; limit?: number }) =>
        http.get(`/session/${sessionID}/message`, { directory: directory ?? dir(), limit }).then((data) => ({ data })),
      status: () => http.get("/session/status", { directory: dir() }).then((data) => ({ data })),
      diff: ({ sessionID }: { sessionID: string }) => http.get(`/session/${sessionID}/diff`, { directory: dir() }).then((data) => ({ data })),
      todo: ({ sessionID }: { sessionID: string }) => http.get(`/session/${sessionID}/todo`, { directory: dir() }).then((data) => ({ data })),
      update: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) =>
        http.patch(`/session/${sessionID}`, body).then((data) => ({ data })),
      delete: ({ sessionID }: { sessionID: string }) => http.delete(`/session/${sessionID}`).then((data) => ({ data })),
      abort: ({ sessionID }: { sessionID: string }) => http.post(`/session/${sessionID}/abort`).then((data) => ({ data })),
      revert: ({ sessionID, messageID }: { sessionID: string; messageID: string }) =>
        http.post(`/session/${sessionID}/revert`, { messageID }).then((data) => ({ data })),
      unrevert: ({ sessionID }: { sessionID: string }) => http.post(`/session/${sessionID}/unrevert`).then((data) => ({ data })),
      summarize: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) =>
        http.post(`/session/${sessionID}/summarize`, body).then((data) => ({ data })),
      shell: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) =>
        http.post(`/session/${sessionID}/shell`, body).then((data) => ({ data })),
      command: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) =>
        http.post(`/session/${sessionID}/command`, body).then((data) => ({ data })),
      promptAsync: ({ sessionID, ...body }: { sessionID: string } & Record<string, unknown>) =>
        http.post(`/session/${sessionID}/prompt_async`, body).then((data) => ({ data })),
      share: sdk.session.share,
      unshare: sdk.session.unshare,
    },
    runtime: {
      health: () => http.get<{ healthy: boolean; version?: string }>("/global/health"),
      targetContext: (directory?: string) => http.get("/path", { directory: dir(directory) }),
      modelCapabilities: (directory?: string) => http.get("/provider/capabilities", { directory: dir(directory) }),
      agents: (directory?: string) => http.get("/agent", { directory: dir(directory) }),
      commands: (directory?: string) => http.get("/command", { directory: dir(directory) }),
      fileList: (path: string) => http.get("/file/file", { path }),
      fileRead: (path: string) => http.get("/file/file/content", { path }),
      findFiles: (query: string, dirs: "true" | "false", directory?: string) =>
        http.get("/file/find/file", { directory: dir(directory), query, dirs }),
      mcpStatus: (directory?: string) => http.get("/mcp", { directory: dir(directory) }),
      lspStatus: (directory?: string) => http.get("/lsp", { directory: dir(directory) }),
      vcs: (directory?: string) => http.get("/vcs", { directory: dir(directory) }),
      terminalCreate: (input: unknown) => http.post("/pty", input),
      terminalUpdate: (input: { ptyID: string } & Record<string, unknown>) => http.put(`/pty/${input.ptyID}`, input),
      terminalRemove: (ptyID: string) => http.delete(`/pty/${ptyID}`),
      instanceDispose: (directory?: string) => http.post("/instance/dispose", { directory: dir(directory) }),
    },
    interaction: {
      permissions: (directory?: string) => http.get("/permission", { directory: dir(directory) }),
      permissionRespond: (requestID: string, input: unknown) => http.post(`/permission/${requestID}/reply`, input),
      questions: (directory?: string) => http.get("/question", { directory: dir(directory) }),
      questionReply: (requestID: string, input: unknown) => http.post(`/question/${requestID}/reply`, input),
      questionReject: (requestID: string) => http.post(`/question/${requestID}/reject`),
    },
    conversation: {
      create: (body?: unknown) => http.post("/session", body),
      get: (sessionID: string, directory?: string) => http.get(`/session/${sessionID}`, { directory: dir(directory) }),
      list: (input?: QueryInput) => http.get("/session", input),
      messages: (sessionID: string, input?: QueryInput) => http.get(`/session/${sessionID}/message`, input),
      status: (directory?: string) => http.get("/session/status", { directory: dir(directory) }),
      diff: (sessionID: string, directory?: string) => http.get(`/session/${sessionID}/diff`, { directory: dir(directory) }),
      todo: (sessionID: string, directory?: string) => http.get(`/session/${sessionID}/todo`, { directory: dir(directory) }),
      update: (sessionID: string, body: unknown) => http.patch(`/session/${sessionID}`, body),
      delete: (sessionID: string) => http.delete(`/session/${sessionID}`),
      abort: (sessionID: string) => http.post(`/session/${sessionID}/abort`),
      revert: (sessionID: string, messageID: string) => http.post(`/session/${sessionID}/revert`, { messageID }),
      unrevert: (sessionID: string) => http.post(`/session/${sessionID}/unrevert`),
      summarize: (sessionID: string, body?: unknown) => http.post(`/session/${sessionID}/summarize`, body),
      shell: (sessionID: string, body: unknown) => http.post(`/session/${sessionID}/shell`, body),
      command: (sessionID: string, body: unknown) => http.post(`/session/${sessionID}/command`, body),
      prompt: (sessionID: string, body: unknown) => http.post(`/session/${sessionID}/message`, body),
      promptAsync: (sessionID: string, body: unknown) => http.post(`/session/${sessionID}/prompt_async`, body),
    },
    event: {
      stream: sdk.global.event.bind(sdk.global) as (input?: {
        signal?: AbortSignal
        onSseError?: (error: unknown) => void
      }) => Promise<{ stream: AsyncIterable<{ directory?: string; payload: Event }> }>,
    },
    createClient(next: Omit<ClientOpts, "baseUrl" | "headers" | "fetch">) {
      return createDeviceClient({
        ...opts,
        ...next,
      })
    },
  }
}

type QueryInput = Record<string, string | number | boolean | undefined>
