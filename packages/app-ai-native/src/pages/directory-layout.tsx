import { createEffect, createMemo, Show, type ParentProps } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { SDKProvider } from "@/context/sdk"
import { SyncProvider, useSync } from "@/context/sync"
import { LocalProvider } from "@/context/local"
import { DataProvider } from "@opencode-ai/ui/context"
import { decode64 } from "@/utils/base64"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { DirectoryContext } from "@/context/directory"
import { workspaceKey } from "@/pages/layout/helpers"
import { useActiveWorkspace } from "./workspace/active-workspace"
import { useWorkspace } from "./workspace/context"

function DirectoryDataProvider(props: ParentProps<{ directory: string; workspaceId: string; dirSlug: string }>) {
  const sync = useSync()

  return (
    <DataProvider
      data={sync.data}
      directory={props.directory}
      onNavigateToSession={(sessionID: string) => `/workspace/${props.workspaceId}/${props.dirSlug}/session/${sessionID}`}
      onSessionHref={(sessionID: string) => `/workspace/${props.workspaceId}/${props.dirSlug}/session/${sessionID}`}
    >
      <LocalProvider>{props.children}</LocalProvider>
    </DataProvider>
  )
}

export default function Layout(props: ParentProps) {
  const params = useParams()
  const navigate = useNavigate()
  const language = useLanguage()
  const active = useActiveWorkspace()
  const workspace = useWorkspace()
  const currentWorkspace = createMemo(() => {
    const id = params.workspaceID
    if (!id) return undefined
    return workspace.workspaces().find((item) => item.id === id) ?? (active?.id === id ? active.workspace : undefined)
  })

  const directory = createMemo(() => {
    const dir = decode64(params.dir) ?? ""
    if (!dir) return ""
    return workspaceKey(dir)
  })

  createEffect(() => {
    const ws = currentWorkspace()
    if (ws && params.workspaceID) {
      active?.setActive(params.workspaceID, ws)
    }
  })

  createEffect(() => {
    if (!params.workspaceID) return
    if (!params.dir) return
    if (directory()) return
    showToast({
      variant: "error",
      title: language.t("common.requestFailed"),
      description: language.t("directory.error.invalidUrl"),
    })
    navigate("/", { replace: true })
  })

  return (
    <Show when={directory()}>
      <DirectoryContext.Provider value={directory}>
        <SDKProvider directory={directory}>
          <SyncProvider>
            <DirectoryDataProvider directory={directory()!} workspaceId={params.workspaceID ?? ""} dirSlug={params.dir ?? ""}>
              {props.children}
            </DirectoryDataProvider>
          </SyncProvider>
        </SDKProvider>
      </DirectoryContext.Provider>
    </Show>
  )
}
