import type { ParentProps } from "solid-js"
import { createSignal, createMemo, Show, createEffect, untrack, onCleanup } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { useNavigate, useParams } from "@solidjs/router"
import { showToast, Toast } from "@opencode-ai/ui/toast"
import type { Device, Workspace, CreateWorkspaceRequest } from "../types"
import { workspaceApi, deviceApi } from "../lib/api"
import { WorkspaceProvider, useWorkspace, type WorkspaceContextValue } from "../context"
import { ServerConnection, ServerProvider, useServer } from "@/context/server"
import { useAuth } from "@/context/auth"
import { getProxyUrl } from "../lib/url"
import { ActiveWorkspaceProvider, useActiveWorkspace } from "../active-workspace"
import { useLanguage } from "@/context/language"
import { MobileWorkspaceHeader } from "./header"

let inMobileWorkspace = false

const [newSessionTrigger, setNewSessionTrigger] = createSignal(0)
export const triggerNewSession = () => setNewSessionTrigger((p) => p + 1)
export { newSessionTrigger }

export default function MobileWorkspaceLayout(props: ParentProps) {
  const language = useLanguage()
  const t = language.t
  const [workspaces, setWorkspaces] = createStore<Workspace[]>([])

  const safeSetWorkspaces = (data: Workspace[]) => {
    const uniqueMap = new Map(data.map((w) => [w.id, w]))
    const deduplicated = Array.from(uniqueMap.values())
    setWorkspaces(reconcile(deduplicated, { key: "id", merge: false }))
  }
  const [devices, setDevices] = createStore<Device[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = createSignal<string | undefined>(undefined)
  const [enabledIds, setEnabledIds] = createSignal<string[]>([])
  const [visitedIds, setVisitedIds] = createSignal<string[]>([])
  const [sidebarOpened, setSidebarOpened] = createSignal(false)
  const [closedIds, setClosedIds] = createSignal<Set<string>>(new Set<string>())
  const auth = useAuth()
  const navigate = useNavigate()

  let loaded = false
  createEffect(() => {
    const user = auth.user()
    if (!user) return
    if (loaded) return
    loaded = true
    untrack(async () => {
      setIsLoading(true)
      try {
        const [workspacesRes, devicesRes] = await Promise.all([
          workspaceApi.list().catch(() => ({ workspaces: [] })),
          deviceApi.list().catch(() => ({ devices: [] })),
        ])

        const uniqueWorkspacesMap = new Map<string, Workspace>()
        for (const w of workspacesRes.workspaces as Workspace[]) uniqueWorkspacesMap.set(w.id, w)
        const deduplicatedWorkspaces = [...uniqueWorkspacesMap.values()]

        safeSetWorkspaces(deduplicatedWorkspaces)
        setDevices(reconcile(devicesRes.devices, { key: "id", merge: false }))

        const newWorkspaceIds = new Set(workspacesRes.workspaces.map((w: any) => w.id))
        setEnabledIds((prev) => prev.filter((id) => newWorkspaceIds.has(id)))
      } catch (err) {
        showToast({
          title: t("workspace.loading.failed"),
          description: t("workspace.loading.dataFailed"),
        })
      } finally {
        setIsLoading(false)
      }
    })
  })

  const DISABLE_DELAY_MS = 1_500
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  const deferDisable = (id: string) => {
    if (pending.has(id)) return
    showToast({
      variant: "error",
      title: t("workspace.device.offline"),
      description: t("workspace.error.disconnected"),
    })
    pending.set(
      id,
      setTimeout(() => {
        pending.delete(id)
        handleDisableWorkspace(id)
      }, DISABLE_DELAY_MS),
    )
  }

  let loading = false
  const loadDevices = async () => {
    if (!auth.user()) return
    if (document.visibilityState !== "visible") return
    if (!inMobileWorkspace) return
    if (loading) return
    loading = true
    try {
      const prevStatuses = devices.map((d) => ({ id: d.id, status: d.status }))
      const res = await deviceApi.list().catch(() => ({ devices: [] }))
      setDevices(reconcile(res.devices, { key: "id", merge: false }))
      const changed = res.devices.some((d) => prevStatuses.find((p) => p.id === d.id)?.status !== d.status)
      if (!changed) return
      const prevOnlineIds = new Set(workspaces.filter((w) => w.deviceStatus === "online").map((w) => w.id))
      const wsRes = await workspaceApi.list().catch(() => ({ workspaces: [] as Workspace[] }))

      const uniqueWorkspacesMap = new Map<string, Workspace>()
      for (const w of wsRes.workspaces) uniqueWorkspacesMap.set(w.id, w)
      const deduplicatedWorkspaces = [...uniqueWorkspacesMap.values()]

      safeSetWorkspaces(deduplicatedWorkspaces)
      const enabled = enabledIds()
      wsRes.workspaces
        .filter((w) => prevOnlineIds.has(w.id) && w.deviceStatus !== "online" && enabled.includes(w.id))
        .forEach((w) => deferDisable(w.id))
    } finally {
      loading = false
    }
  }

  const timer = setInterval(loadDevices, 30_000)
  document.addEventListener("visibilitychange", loadDevices)
  inMobileWorkspace = true
  onCleanup(() => {
    inMobileWorkspace = false
    clearInterval(timer)
    document.removeEventListener("visibilitychange", loadDevices)
    for (const t of pending.values()) clearTimeout(t)
    pending.clear()
  })

  const handleSelectWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId)
  }

  const handleEnableWorkspace = (id: string) => {
    setClosedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    setEnabledIds((prev) => {
      if (prev.includes(id)) return prev
      return [...prev, id]
    })
  }

  const handleDisableWorkspace = (id: string) => {
    const prev = enabledIds()
    setClosedIds((prev) => { const next = new Set(prev); next.add(id); return next })
    const next = prev.filter((x) => x !== id)
    setEnabledIds(next)
    setVisitedIds((prev) => prev.filter((x) => x !== id))
    if (selectedWorkspaceId() === id) {
      setSelectedWorkspaceId(undefined)
    }
  }

  const handleCreateWorkspace = async (deviceId: string, directory: string, name: string) => {
    const device = devices.find((d) => d.id === deviceId)
    if (!device) {
      showToast({ title: t("workspace.create.failed"), description: t("workspace.create.deviceNotFound") })
      return
    }
    if (device.status === "offline") {
      showToast({ title: t("workspace.create.failed"), description: t("workspace.create.deviceOffline") })
      return
    }
    try {
      const request: CreateWorkspaceRequest = {
        name,
        deviceId,
        directories: [{ name: "default", path: directory, isDefault: true }],
      }
      const response = await workspaceApi.create(request)
      const newWorkspace = response.workspace
      setWorkspaces((prev) => [...prev, newWorkspace])
      setSelectedWorkspaceId(newWorkspace.id)
      const refreshed = await workspaceApi.list()
      safeSetWorkspaces(refreshed.workspaces)
      showToast({
        title: t("workspace.create.success"),
        description: t("workspace.create.successDetail", { name: newWorkspace.name, device: device.displayName }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      showToast({ title: t("workspace.create.failedTitle"), description: msg })
      throw err
    }
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId)
    if (!workspace) return
    try {
      await workspaceApi.delete(workspaceId)
      handleDisableWorkspace(workspaceId)
      safeSetWorkspaces(workspaces.filter((w) => w.id !== workspaceId))
      showToast({ title: t("workspace.delete.success"), description: workspace.name })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      showToast({ title: t("workspace.delete.failedTitle"), description: msg })
    }
  }

  const handleRenameWorkspace = async (workspaceId: string, name: string) => {
    try {
      const res = await workspaceApi.update(workspaceId, { name })
      const updated = workspaces.map((w) => (w.id === workspaceId ? res.workspace : w))
      safeSetWorkspaces(updated)
      showToast({ title: t("workspace.rename.success"), description: name })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      showToast({ title: t("workspace.rename.failedTitle"), description: msg })
      throw err
    }
  }

  const contextValue: WorkspaceContextValue = {
    workspaces: () => workspaces,
    devices: () => devices,
    selectedWorkspaceId,
    enabledWorkspaceIds: enabledIds,
    closedWorkspaceIds: () => [...closedIds()],
    isLoading,
    sidebarOpened,
    selectWorkspace: handleSelectWorkspace,
    enableWorkspace: handleEnableWorkspace,
    disableWorkspace: handleDisableWorkspace,
    createWorkspace: handleCreateWorkspace,
    deleteWorkspace: handleDeleteWorkspace,
    renameWorkspace: handleRenameWorkspace,
    removeVisited: (id: string) => setVisitedIds((prev) => prev.filter((x) => x !== id)),
    openSidebar: () => setSidebarOpened(true),
    closeSidebar: () => setSidebarOpened(false),
    toggleSidebar: () => setSidebarOpened((v) => !v),
    refreshDevices: loadDevices,
  }

  return (
    <WorkspaceProvider value={contextValue}>
      <ActiveWorkspaceProvider>
        <MobileServerProvider>
          <MobileActivation>
            <div class="h-full w-full max-w-[100dvw] flex flex-col bg-background-base">
              <MobileWorkspaceHeader />
              <div class="flex-1 min-h-0">
                {props.children}
              </div>
            </div>
          </MobileActivation>
        </MobileServerProvider>
      </ActiveWorkspaceProvider>
      <Toast.Region />
    </WorkspaceProvider>
  )
}

function MobileServerProvider(props: ParentProps) {
  const workspace = useWorkspace()

  const enabledWorkspaces = createMemo(() => {
    const ids = workspace.enabledWorkspaceIds()
    const all = workspace.workspaces()
    return ids
      .map((id) => all.find((w) => w.id === id))
      .filter((w): w is Workspace => !!w?.deviceUniqueId)
      .sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0))
  })

  const servers = createMemo<ServerConnection.Http[]>(() =>
    enabledWorkspaces().map((w) => ({
      type: "http" as const,
      http: { url: getProxyUrl(w.deviceUniqueId!) },
    })),
  )

  const defaultServer = createMemo<ServerConnection.Key>(() => {
    const first = enabledWorkspaces()[0]
    return first ? ServerConnection.Key.make(getProxyUrl(first.deviceUniqueId!)) : ("" as ServerConnection.Key)
  })

  return (
    <ServerProvider defaultServer={defaultServer()} servers={servers()}>
      {props.children}
    </ServerProvider>
  )
}

function MobileActivation(props: ParentProps) {
  const params = useParams()
  const server = useServer()
  const workspace = useWorkspace()
  const active = useActiveWorkspace()
  const navigate = useNavigate()

  let lastId = ""
  createEffect(() => {
    const id = params.workspaceID ?? ""
    if (id !== lastId) {
      if (workspace.sidebarOpened()) workspace.closeSidebar()
      lastId = id
    }
  })

  createEffect(() => {
    const id = params.workspaceID
    if (!id) return

    const all = workspace.workspaces()
    const target = all.find((w: Workspace) => w.id === id)
    if (!target?.deviceUniqueId) return

    const key = ServerConnection.Key.make(getProxyUrl(target.deviceUniqueId!))
    untrack(() => {
      const isClosed = workspace.closedWorkspaceIds().includes(id)
      const enabled = workspace.enabledWorkspaceIds().includes(id)
      if (!isClosed && !enabled) workspace.enableWorkspace(id)
      if (workspace.selectedWorkspaceId() !== id) workspace.selectWorkspace(id)
      if (server.key !== key) server.setActive(key)
      if (active) active.setActive(id, target)
    })
  })

  return props.children
}
