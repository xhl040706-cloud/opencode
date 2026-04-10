import { useGlobalSync } from "@/context/global-sync"
import type { ProviderCapabilitiesResponse } from "@/context/global-sync/types"
import { decode64 } from "@/utils/base64"
import { useParams } from "@solidjs/router"
import { createMemo } from "solid-js"

const EMPTY: ProviderCapabilitiesResponse = { connected: [] }

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
  const connected = createMemo(() => providers().connected)
  const paid = createMemo(() =>
    connected().filter((p) => p.id !== "opencode" || Object.values(p.models).find((m) => m.cost?.input)),
  )
  return {
    connected,
    paid,
  }
}
