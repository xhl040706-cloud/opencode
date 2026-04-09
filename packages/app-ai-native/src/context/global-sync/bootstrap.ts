import type {
  OpencodeClient,
  PermissionRequest,
  Project,
  QuestionRequest,
  Todo,
} from "@opencode-ai/sdk/v2/client"
import { showToast } from "@opencode-ai/ui/toast"
import { getFilename } from "@opencode-ai/util/path"
import { retry } from "@opencode-ai/util/retry"
import { batch } from "solid-js"
import { reconcile, type SetStoreFunction, type Store } from "solid-js/store"
import type { State, VcsCache } from "./types"
import { cmp, normalizeProviderList } from "./utils"
import { formatServerError } from "@/utils/server-errors"
import { workspaceAdapter } from "@/context/workspace-adapter"

type GlobalStore = {
  ready: boolean
  project: Project[]
  session_todo: {
    [sessionID: string]: Todo[]
  }
  reload: undefined | "pending" | "complete"
}

export async function bootstrapGlobal(input: {
  globalSDK: OpencodeClient
  connectErrorTitle: string
  connectErrorDescription: string
  requestFailedTitle: string
  translate: (key: string, vars?: Record<string, string | number>) => string
  formatMoreCount: (count: number) => string
  setGlobalStore: SetStoreFunction<GlobalStore>
}) {
  const api = workspaceAdapter(input.globalSDK)
  const health = await api
    .health()
    .then((x) => x.data)
    .catch(() => undefined)
  if (!health?.healthy) {
    showToast({
      variant: "error",
      title: input.connectErrorTitle,
      description: input.connectErrorDescription,
    })
    input.setGlobalStore("ready", true)
    return
  }

  const required = []

  const optional = [
    // Provider auth is intentionally not bootstrapped in web mode anymore.
    // Model/provider authentication is handled on the device side for now.
  ]

  const requiredErrors = (await Promise.allSettled(required))
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason)
  if (requiredErrors.length) {
    const message = formatServerError(requiredErrors[0], input.translate)
    const more = requiredErrors.length > 1 ? input.formatMoreCount(requiredErrors.length - 1) : ""
    showToast({
      variant: "error",
      title: input.requestFailedTitle,
      description: message + more,
    })
    input.setGlobalStore("ready", true)
    return
  }

  const optionalResults = await Promise.allSettled(optional)
  const optionalErrors = optionalResults
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason)
  if (optionalErrors.length) {
    console.warn("[bootstrapGlobal] optional requests failed", optionalErrors)
  }

  input.setGlobalStore("ready", true)
}

function groupBySession<T extends { id: string; sessionID: string }>(input: T[]) {
  return input.reduce<Record<string, T[]>>((acc, item) => {
    if (!item?.id || !item.sessionID) return acc
    const list = acc[item.sessionID]
    if (list) list.push(item)
    if (!list) acc[item.sessionID] = [item]
    return acc
  }, {})
}

export async function bootstrapDirectory(input: {
  directory: string
  sdk: OpencodeClient
  store: Store<State>
  setStore: SetStoreFunction<State>
  vcsCache: VcsCache
  loadSessions: (directory: string) => Promise<void> | void
  translate: (key: string, vars?: Record<string, string | number>) => string
}) {
  const api = workspaceAdapter(input.sdk)
  if (input.store.status !== "complete") input.setStore("status", "loading")

  const required = {
    agent: () => api.agents().then((x) => input.setStore("agent", x.data ?? [])),
  }

  try {
    await Promise.all(Object.values(required).map((p) => retry(p)))
  } catch (err) {
    console.error("Failed to bootstrap instance", err)
    const project = getFilename(input.directory)
    showToast({
      variant: "error",
      title: `Failed to reload ${project}`,
      description: formatServerError(err, input.translate),
    })
    input.setStore("status", "partial")
    return
  }

  if (input.store.status !== "complete") input.setStore("status", "partial")

  const optional = [
    input.sdk.provider.list().then((x) => {
      const data = x.data
      if (!data) return
      input.setStore("provider", normalizeProviderList(data))
    }),
    api.path().then((x) => input.setStore("path", x.data!)),
    api.sessionStatus().then((x) => input.setStore("session_status", x.data!)),
    input.loadSessions(input.directory),
    input.sdk.mcp.status().then((x) => input.setStore("mcp", x.data!)),
    input.sdk.lsp.status().then((x) => input.setStore("lsp", x.data!)),
    input.sdk.vcs.get().then((x) => {
      const next = x.data ?? input.store.vcs
      input.setStore("vcs", next)
      if (next?.branch) input.vcsCache.setStore("value", next)
    }),
    api.permissions().then((x) => {
      const grouped = groupBySession(
        (x.data ?? []).filter((perm): perm is PermissionRequest => !!perm?.id && !!perm.sessionID),
      )
      batch(() => {
        for (const sessionID of Object.keys(input.store.permission)) {
          if (grouped[sessionID]) continue
          input.setStore("permission", sessionID, [])
        }
        for (const [sessionID, permissions] of Object.entries(grouped)) {
          input.setStore(
            "permission",
            sessionID,
            reconcile(
              permissions.filter((p) => !!p?.id).sort((a, b) => cmp(a.id, b.id)),
              { key: "id" },
            ),
          )
        }
      })
    }),
    api.questions().then((x) => {
      const grouped = groupBySession((x.data ?? []).filter((q): q is QuestionRequest => !!q?.id && !!q.sessionID))
      batch(() => {
        for (const sessionID of Object.keys(input.store.question)) {
          if (grouped[sessionID]) continue
          input.setStore("question", sessionID, [])
        }
        for (const [sessionID, questions] of Object.entries(grouped)) {
          input.setStore(
            "question",
            sessionID,
            reconcile(
              questions.filter((q) => !!q?.id).sort((a, b) => cmp(a.id, b.id)),
              { key: "id" },
            ),
          )
        }
      })
    }),
  ]

  Promise.allSettled(optional).then((results) => {
    const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason)
    if (errors.length) {
      console.warn("[bootstrapDirectory] optional requests failed", {
        directory: input.directory,
        errors,
      })
    }
    input.setStore("status", "complete")
  })
}
