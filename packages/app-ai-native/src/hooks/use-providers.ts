import type { ProviderListResponse } from "@opencode-ai/sdk/v2/client"
import { useGlobalSync } from "@/context/global-sync"
import { decode64 } from "@/utils/base64"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

const EMPTY: ProviderListResponse = { all: [], connected: [], default: {} }

export const popularProviders = [
  "costrict",
  "opencode",
  "opencode-go",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
]
const popularProviderSet = new Set(popularProviders)

export function useProviders() {
  const globalSync = useGlobalSync()
  const params = useParams()
  const currentDirectory = createMemo(() => decode64(params.dir) ?? "")
  const providers = createMemo(() => {
    const dir = currentDirectory()
    if (!dir) return EMPTY
    const [projectStore] = globalSync.child(dir)
    return projectStore.provider
  })
  const connectedIDs = createMemo(() => new Set(providers().connected))
  const connected = createMemo(() => providers().all.filter((p) => connectedIDs().has(p.id)))
  const paid = createMemo(() =>
    connected().filter((p) => p.id !== "opencode" || Object.values(p.models).find((m) => m.cost?.input)),
  )
  const popular = createMemo(() => providers().all.filter((p) => popularProviderSet.has(p.id)))
  return {
    all: createMemo(() => providers().all),
    default: createMemo(() => providers().default),
    popular,
    connected,
    paid,
  }
}
