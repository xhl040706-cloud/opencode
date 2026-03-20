import type { ParentProps } from "solid-js"
import { createSignal, createMemo, onMount, Show, createEffect, untrack, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useParams } from "@solidjs/router"
import { showToast } from "@opencode-ai/ui/toast"
import type { Device, Workspace, CreateWorkspaceRequest } from "../types"
import { workspaceApi, deviceApi } from "../lib/api"
import { WorkspaceSidebar } from "./workspace-sidebar"
import { WorkspaceProvider, useWorkspace, type WorkspaceContextValue } from "../context"
import { ServerConnection, ServerProvider, useServer } from "@/context/server"
import { AppInterface } from "@/app-interface"
import { getProxyUrl } from "../lib/url"
import { ActiveWorkspaceProvider } from "../active-workspace"

let inWorkspace = false

export default function WorkspaceLayout(props: ParentProps) {
  const [workspaces, setWorkspaces] = createStore<Workspace[]>([])
  const [devices, setDevices] = createStore<Device[]>([])
  const [isLoading, setIsLoading] = createSignal(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = createSignal<string | undefined>(undefined)
  const [selectedDeviceId, setSelectedDeviceId] = createSignal<string | undefined>(undefined)
  const [showHistorySidebar, setShowHistorySidebar] = createSignal(false)
  const [enabledIds, setEnabledIds] = createSignal<string[]>([])
  const closed = new Set<string>()

  onMount(async () => {
    setIsLoading(true)
    try {
      const [workspacesRes, devicesRes] = await Promise.all([
        workspaceApi.list().catch(() => ({ workspaces: [] })),
        deviceApi.list().catch(() => ({ devices: [] })),
      ])
      setWorkspaces(workspacesRes.workspaces)
      setDevices(devicesRes.devices)
    } catch (err) {
      showToast({
        title: "加载失败",
        description: "无法加载工作空间或设备数据",
      })
    } finally {
      setIsLoading(false)
    }
  })

  let loading = false
  const loadDevices = async () => {
    if (document.visibilityState !== "visible") return
    if (!inWorkspace) return
    if (loading) return
    loading = true
    try {
      const prevStatuses = devices.map((d) => ({ id: d.id, status: d.status }))
      const res = await deviceApi.list().catch(() => ({ devices: [] }))
      setDevices(res.devices)
      const changed = res.devices.some((d) => prevStatuses.find((p) => p.id === d.id)?.status !== d.status)
      if (!changed) return
      const prevOnlineIds = new Set(workspaces.filter((w) => w.deviceStatus === "online").map((w) => w.id))
      const wsRes = await workspaceApi.list().catch(() => ({ workspaces: [] as Workspace[] }))
      setWorkspaces(wsRes.workspaces)
      const enabled = enabledIds()
      wsRes.workspaces
        .filter((w) => prevOnlineIds.has(w.id) && w.deviceStatus !== "online" && enabled.includes(w.id))
        .forEach((w) => handleDisableWorkspace(w.id))
    } finally {
      loading = false
    }
  }

  const timer = setInterval(loadDevices, 30_000)
  document.addEventListener("visibilitychange", loadDevices)
  inWorkspace = true
  onCleanup(() => {
    inWorkspace = false
    clearInterval(timer)
    document.removeEventListener("visibilitychange", loadDevices)
  })

  const handleSelectWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId)
  }

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    const device = devices.find((d) => d.id === deviceId)
    if (device) {
      showToast({
        title: "已选择设备",
        description: device.displayName,
      })
    }
  }

  const handleEnableWorkspace = (id: string) => {
    closed.delete(id)
    setEnabledIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const handleDisableWorkspace = (id: string) => {
    closed.add(id)
    setEnabledIds((prev) => prev.filter((x) => x !== id))
    if (selectedWorkspaceId() === id) setSelectedWorkspaceId(undefined)
  }

  const refreshWorkspaces = async () => {
    try {
      const res = await workspaceApi.list()
      setWorkspaces(res.workspaces)
    } catch (err) {
      console.error("Failed to refresh workspaces:", err)
    }
  }

  const handleCreateWorkspace = async (deviceId: string, directory: string) => {
    const device = devices.find((d) => d.id === deviceId)
    if (!device) {
      showToast({ title: "创建失败", description: "设备不存在" })
      return
    }
    if (device.status === "offline") {
      showToast({ title: "创建失败", description: "设备处于离线状态" })
      return
    }
    try {
      const name = directory.split("/").pop() || "New Workspace"
      const request: CreateWorkspaceRequest = {
        name,
        deviceId,
        directories: [{ name: "default", path: directory, isDefault: true }],
      }
      const response = await workspaceApi.create(request)
      const newWorkspace = response.workspace
      setWorkspaces((prev) => [...prev, newWorkspace])
      setSelectedWorkspaceId(newWorkspace.id)
      await refreshWorkspaces()
      showToast({
        title: "创建工作空间成功",
        description: `在 ${device.displayName} 上创建了 ${newWorkspace.name}`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误"
      showToast({ title: "创建工作空间失败", description: msg })
      throw err
    }
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId)
    if (!workspace) return
    try {
      await workspaceApi.delete(workspaceId)
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId))
      handleDisableWorkspace(workspaceId)
      await refreshWorkspaces()
      showToast({ title: "删除工作空间成功", description: workspace.name })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误"
      showToast({ title: "删除工作空间失败", description: msg })
    }
  }

  const contextValue: WorkspaceContextValue = {
    workspaces: () => [...workspaces],
    devices: () => [...devices],
    selectedWorkspaceId,
    selectedDeviceId,
    enabledWorkspaceIds: enabledIds,
    closedWorkspaceIds: () => Array.from(closed),
    isLoading,
    showHistorySidebar,
    selectWorkspace: handleSelectWorkspace,
    selectDevice: handleSelectDevice,
    enableWorkspace: handleEnableWorkspace,
    disableWorkspace: handleDisableWorkspace,
    createWorkspace: handleCreateWorkspace,
    deleteWorkspace: handleDeleteWorkspace,
    closeHistorySidebar: () => setShowHistorySidebar(false),
  }

  return (
    <WorkspaceProvider value={contextValue}>
      <ActiveWorkspaceProvider>
        <WorkspaceServerProvider>
          <WorkspaceActivation>
            <div class="flex h-full w-full min-h-0">
              <WorkspaceSidebar />
              <WorkspaceContent>{props.children}</WorkspaceContent>
            </div>
          </WorkspaceActivation>
        </WorkspaceServerProvider>
      </ActiveWorkspaceProvider>
    </WorkspaceProvider>
  )
}

function WorkspaceServerProvider(props: ParentProps) {
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
    }))
  )

  const defaultServer = createMemo<ServerConnection.Key>(() => {
    const first = enabledWorkspaces()[0]
    return first
      ? ServerConnection.Key.make(getProxyUrl(first.deviceUniqueId!))
      : ("" as ServerConnection.Key)
  })

  return (
    <ServerProvider defaultServer={defaultServer()} servers={servers()}>
      {props.children}
    </ServerProvider>
  )
}

function WorkspaceActivation(props: ParentProps) {
  const params = useParams()
  const server = useServer()
  const workspace = useWorkspace()

  createEffect(() => {
    const id = params.workspaceID
    if (!id) return

    untrack(() => {
      const target = workspace.workspaces().find((w: Workspace) => w.id === id)
      if (!target?.deviceUniqueId) return

      const key = ServerConnection.Key.make(getProxyUrl(target.deviceUniqueId))
      const isClosed = workspace.closedWorkspaceIds().includes(id)
      const enabled = workspace.enabledWorkspaceIds().includes(id)
      if (!isClosed && !enabled) workspace.enableWorkspace(id)
      if (workspace.selectedWorkspaceId() !== id) workspace.selectWorkspace(id)
      if (server.key !== key) server.setActive(key)
    })
  })

  return props.children
}

function WorkspaceContent(props: ParentProps) {
  const server = useServer()
  return (
    <Show
      when={server.key}
      fallback={<div class="flex-1 min-h-0 bg-background-base" />}
    >
      <AppInterface>
        {props.children}
      </AppInterface>
    </Show>
  )
}
