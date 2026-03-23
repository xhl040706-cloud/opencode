import { createSignal, createMemo, For, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import type { Device, DeviceStatus, Workspace, WorkspaceDirectory } from "../types"
import { DeviceList } from "./device-list"
import { CreateWorkspaceDialogContent } from "./create-workspace-dialog"
import { useWorkspace } from "../context"
import { ServerConnection, useServer } from "@/context/server"
import { getProxyUrl } from "../lib/url"
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate"
import { useActiveWorkspace } from "../active-workspace"


export function WorkspaceSidebar() {
  const dialog = useDialog()
  const active = useActiveWorkspace()!
  const {
    workspaces,
    devices,
    selectedWorkspaceId,
    selectedDeviceId,
    enabledWorkspaceIds,
    selectWorkspace,
    selectDevice,
    enableWorkspace,
    disableWorkspace,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspace()

  const server = useServer()
  const params = useParams()
  const rawNavigate = useNavigate()
  const { navigateToNewSession, encodeDirectory } = useWorkspaceNavigate()

  const isEnabled = (workspace: Workspace) => enabledWorkspaceIds().includes(workspace.id)

  const getPrimaryDirectory = (workspace: Workspace): WorkspaceDirectory | undefined => {
    if (!workspace.directories || workspace.directories.length === 0) return undefined
    return workspace.directories.find((d) => d.isDefault) || workspace.directories[0]
  }

  const handleOpenWorkspace = (workspace: Workspace) => {
    if (!workspace.deviceUniqueId) return
    enableWorkspace(workspace.id)
    selectWorkspace(workspace.id)
    active.setActive(workspace.id, workspace)
    server.setActive(ServerConnection.Key.make(getProxyUrl(workspace.deviceUniqueId)))
    const primaryDir = getPrimaryDirectory(workspace)
    const dirSlug = primaryDir ? encodeDirectory(primaryDir.path) : 'default'
    navigateToNewSession({ workspaceId: workspace.id, dir: dirSlug })
  }

  const handleCloseWorkspace = (workspace: Workspace) => {
    disableWorkspace(workspace.id)
    if (active.id === workspace.id) active.clear()
    if (params.workspaceID === workspace.id) rawNavigate("/workspace")
  }

  const handleSelectWorkspace = (workspace: Workspace) => {
    selectWorkspace(workspace.id)
  }

  const [workspaceSearchQuery, setWorkspaceSearchQuery] = createSignal("")
  const [deviceSearchQuery, setDeviceSearchQuery] = createSignal("")
  const [isDeviceListCollapsed, setIsDeviceListCollapsed] = createSignal(false)
  const [isRunningCollapsed, setIsRunningCollapsed] = createSignal(false)
  const [isIdleCollapsed, setIsIdleCollapsed] = createSignal(false)

  const getDeviceStatusDot = (status?: DeviceStatus) => {
    switch (status) {
      case "online":
        return { online: true, offline: false, text: "在线" }
      case "offline":
        return { online: false, offline: true, text: "离线" }
      default:
        return { online: false, offline: false, text: "未绑定" }
    }
  }

  const filteredWorkspaces = createMemo(() => {
    const query = workspaceSearchQuery().toLowerCase()
    const all = workspaces()
    if (!query) return all
    return all.filter(
      (workspace) =>
        workspace.name.toLowerCase().includes(query) ||
        workspace.description?.toLowerCase().includes(query) ||
        getPrimaryDirectory(workspace)?.path.toLowerCase().includes(query)
    )
  })

  const runningWorkspaces = createMemo(() => filteredWorkspaces().filter((w) => isEnabled(w)))
  const idleWorkspaces = createMemo(() => filteredWorkspaces().filter((w) => !isEnabled(w)))

  const handleCreateWorkspace = (device: Device) => {
    dialog.show(() => (
      <CreateWorkspaceDialogContent
        device={device}
        onCreate={async (directory: string) => {
          await createWorkspace(device.id, directory)
        }}
      />
    ))
  }

  const WorkspaceCard = (cardProps: { workspace: Workspace; isRunning: boolean }) => {
    const primaryDir = getPrimaryDirectory(cardProps.workspace)
    const dot = getDeviceStatusDot(cardProps.workspace.deviceStatus)
    const selected = () => selectedWorkspaceId() === cardProps.workspace.id

    return (
      <div
        class="group/workspace flex items-stretch rounded-md transition-colors cursor-default"
        classList={{ "bg-surface-base-active": selected() }}
      >
        <div
          class="flex-1 min-w-0 flex items-center gap-1 px-2 py-1.5 rounded-l-md hover:bg-surface-raised-base-hover transition-colors"
          onClick={() => handleSelectWorkspace(cardProps.workspace)}
        >
          <div class="shrink-0 size-6 flex items-center justify-center">
            <Icon name="folder" size="small" class="text-icon-weak" />
          </div>
          <div class="min-w-0 flex flex-col">
            <div class="flex items-center gap-1.5">
              <Tooltip placement="top" value={dot.text}>
                <div
                  classList={{
                    "size-1.5 rounded-full shrink-0": true,
                    "bg-icon-success-base": dot.online,
                    "bg-icon-critical-base": dot.offline,
                    "bg-border-weak-base": !dot.online && !dot.offline,
                  }}
                />
              </Tooltip>
              <span class="text-14-regular text-text-strong truncate">
                {cardProps.workspace.name}
              </span>
            </div>
            <Show when={primaryDir}>
              <span class="text-11-regular text-text-weak truncate">
                {primaryDir!.path}
              </span>
            </Show>
          </div>
        </div>

        <div class="shrink-0 flex flex-col w-8 border-l border-border-weak-base opacity-0 group-hover/workspace:opacity-100 transition-opacity self-stretch">
          <Tooltip placement="left" value={cardProps.isRunning ? "关闭" : "运行"} class="flex-1">
            <div
              class="h-full flex items-center justify-center cursor-pointer hover:bg-surface-raised-base-hover transition-colors rounded-tr-md"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                cardProps.isRunning ? handleCloseWorkspace(cardProps.workspace) : handleOpenWorkspace(cardProps.workspace)
              }}
            >
              <Icon name={cardProps.isRunning ? "circle-x" : "circle-check"} size="small" class="text-icon-weak" />
            </div>
          </Tooltip>
          <Tooltip placement="left" value="删除" class="flex-1">
            <div
              class="h-full flex items-center justify-center cursor-pointer hover:bg-surface-critical-weak transition-colors rounded-br-md"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                deleteWorkspace(cardProps.workspace.id)
              }}
            >
              <Icon name="trash" size="small" class="text-icon-weak" />
            </div>
          </Tooltip>
        </div>
      </div>
    )
  }

  return (
    <div class="flex flex-col h-full w-72 bg-surface-base border-r border-border-weak-base">
      <div class="shrink-0 p-2 border-b border-border-weak-base">
        <div class="flex items-center gap-2 h-8 px-2 bg-background-base rounded-md border border-border-weak-base focus-within:border-border-strong-base">
          <Icon name="magnifying-glass" class="size-4 text-text-weak shrink-0" />
          <input
            type="text"
            placeholder="搜索工作空间..."
            value={workspaceSearchQuery()}
            onInput={(e: Event) => setWorkspaceSearchQuery((e.target as HTMLInputElement).value)}
            class="flex-1 text-13-regular bg-transparent placeholder:text-text-weak focus:outline-none"
          />
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto py-2">
        <Collapsible open={!isRunningCollapsed()}>
          <div class="px-2 py-1">
            <Collapsible.Trigger
              class="flex items-center gap-1 px-1 py-0.5 w-full rounded-md hover:bg-surface-base-hover transition-colors cursor-pointer mb-1"
              onClick={() => setIsRunningCollapsed((v) => !v)}
            >
              <Icon
                name={isRunningCollapsed() ? "chevron-right" : "chevron-down"}
                size="small"
                class="size-4 text-icon-weak shrink-0"
              />
              <span class="text-12-medium text-text-weak">运行中</span>
              <span class="text-11-regular text-text-weaker">{runningWorkspaces().length}</span>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div class="flex flex-col gap-0.5">
                <For each={runningWorkspaces()}>
                  {(workspace) => <WorkspaceCard workspace={workspace} isRunning={true} />}
                </For>
              </div>
            </Collapsible.Content>
          </div>
        </Collapsible>

        <Collapsible open={!isIdleCollapsed()}>
          <div class="px-2 py-1">
            <Collapsible.Trigger
              class="flex items-center gap-1 px-1 py-0.5 w-full rounded-md hover:bg-surface-base-hover transition-colors cursor-pointer mb-1"
              onClick={() => setIsIdleCollapsed((v) => !v)}
            >
              <Icon
                name={isIdleCollapsed() ? "chevron-right" : "chevron-down"}
                size="small"
                class="size-4 text-icon-weak shrink-0"
              />
              <span class="text-12-medium text-text-weak">空闲</span>
              <span class="text-11-regular text-text-weaker">{idleWorkspaces().length}</span>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div class="flex flex-col gap-0.5">
                <For each={idleWorkspaces()}>
                  {(workspace) => <WorkspaceCard workspace={workspace} isRunning={false} />}
                </For>
                <Show when={filteredWorkspaces().length === 0}>
                  <div class="flex flex-col items-center justify-center py-8 text-text-weak">
                    <Icon name="folder" class="size-8 mb-2 opacity-30" />
                    <span class="text-12-regular">暂无工作空间</span>
                    <span class="text-11-regular text-text-weaker mt-1">从下方设备列表创建</span>
                  </div>
                </Show>
              </div>
            </Collapsible.Content>
          </div>
        </Collapsible>
      </div>

      <div class="shrink-0 border-t border-border-weak-base max-h-80 overflow-y-auto">
        <DeviceList
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={selectDevice}
          onCreateWorkspace={handleCreateWorkspace}
          searchQuery={deviceSearchQuery}
          onSearchChange={setDeviceSearchQuery}
          isCollapsed={isDeviceListCollapsed}
          onToggleCollapse={() => setIsDeviceListCollapsed((v) => !v)}
        />
      </div>
    </div>
  )
}
