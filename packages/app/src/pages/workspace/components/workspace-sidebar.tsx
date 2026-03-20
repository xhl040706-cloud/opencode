import { createSignal, createMemo, For, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
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

  const WorkspaceCard = (props: { workspace: Workspace; isRunning: boolean }) => {
    const primaryDir = getPrimaryDirectory(props.workspace)
    const deviceStatus = getDeviceStatusDot(props.workspace.deviceStatus)

    return (
      <div
        class={`
          group flex items-center gap-0 rounded-md overflow-hidden border border-border-weak-base
          ${selectedWorkspaceId() === props.workspace.id ? "bg-surface-base-active border-transparent" : "bg-background-base"}
        `}
      >
        {/* 内容区 - 点击选中 */}
        <div
          class="flex-1 min-w-0 flex items-center gap-2 p-2 cursor-pointer rounded-l-md hover:bg-surface-base-hover transition-colors"
          onClick={() => handleSelectWorkspace(props.workspace)}
        >
          <Icon name="folder" class="size-4 text-text-weak shrink-0" />
          <div class="flex-1 min-w-0 flex flex-col">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-13-medium text-text-strong truncate">
                {props.workspace.name}
              </span>
              <Show when={props.workspace.isDefault}>
                <span class="text-10-medium px-1.5 py-0.5 rounded-full bg-primary-base text-white shrink-0">
                  默认
                </span>
              </Show>
              <Tooltip placement="top" value={deviceStatus.text}>
                <div
                  classList={{
                    "size-1.5 rounded-full shrink-0": true,
                    "bg-icon-success-base": deviceStatus.online,
                    "bg-icon-critical-base": deviceStatus.offline,
                    "bg-border-weak-base": !deviceStatus.online && !deviceStatus.offline,
                  }}
                />
              </Tooltip>
            </div>
            <Show when={primaryDir}>
              <span class="text-11-regular text-text-weak truncate">
                {primaryDir!.path}
              </span>
            </Show>
          </div>
        </div>

        {/* 操作区 - 固定宽度 */}
        <div class="shrink-0 flex items-center gap-1 px-2 py-2 w-24 justify-end border-l border-border-weak-base rounded-r-md hover:bg-surface-base-hover/50 transition-colors">
          <Tooltip placement="top" value="删除">
            <IconButton
              icon="trash"
              variant="ghost"
              size="small"
              class="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                deleteWorkspace(props.workspace.id)
              }}
            />
          </Tooltip>

          <Show
          when={props.isRunning}
          fallback={
            <Button
              variant="secondary"
              size="small"
              class="shrink-0 h-7 px-2 text-11-medium"
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                handleOpenWorkspace(props.workspace)
              }}
            >
              运行
            </Button>
          }
        >
          <Button
            variant="ghost"
            size="small"
            class="shrink-0 h-7 px-2 text-11-medium text-text-weak hover:text-text-strong"
            onClick={(e: MouseEvent) => {
              e.stopPropagation()
              handleCloseWorkspace(props.workspace)
            }}
          >
            关闭
          </Button>
        </Show>
        </div>
      </div>
    )
  }

  return (
    <div class="flex flex-col h-full w-72 bg-surface-base border-r border-border-weak-base">
      {/* 顶部搜索区域 */}
      <div class="shrink-0 p-3 border-b border-border-weak-base">
        <div class="relative">
          <Icon name="magnifying-glass" class="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-text-weak" />
          <input
            type="text"
            placeholder="搜索工作空间..."
            value={workspaceSearchQuery()}
            onInput={(e: Event) => setWorkspaceSearchQuery((e.target as HTMLInputElement).value)}
            class="w-full h-9 pl-8 pr-3 text-13-regular bg-background-base rounded-md border border-border-weak-base placeholder:text-text-weak focus:outline-none focus:border-border-strong-base"
          />
        </div>
      </div>

      {/* 工作空间列表 */}
      <div class="flex-1 min-h-0 overflow-y-auto">
        {/* 运行中分区 */}
        <Collapsible open={!isRunningCollapsed()}>
          <div class="flex flex-col gap-1 p-2">
            <div class="flex items-center justify-between px-2">
              <div class="flex items-center gap-2">
                <Collapsible.Trigger
                  as={IconButton}
                  icon={isRunningCollapsed() ? "chevron-right" : "chevron-down"}
                  variant="ghost"
                  size="small"
                  class="size-5"
                  onClick={() => setIsRunningCollapsed((v) => !v)}
                />
                <span class="text-12-medium text-text-strong">运行中</span>
                <span class="text-12-regular text-text-weak">({runningWorkspaces().length})</span>
              </div>
            </div>

            <Collapsible.Content>
              <div class="flex flex-col gap-1">
                <For each={runningWorkspaces()}>
                  {(workspace) => <WorkspaceCard workspace={workspace} isRunning={true} />}
                </For>
              </div>
            </Collapsible.Content>
          </div>
        </Collapsible>

        {/* 空闲分区 */}
        <Collapsible open={!isIdleCollapsed()}>
          <div class="flex flex-col gap-1 p-2">
            <div class="flex items-center justify-between px-2">
              <div class="flex items-center gap-2">
                <Collapsible.Trigger
                  as={IconButton}
                  icon={isIdleCollapsed() ? "chevron-right" : "chevron-down"}
                  variant="ghost"
                  size="small"
                  class="size-5"
                  onClick={() => setIsIdleCollapsed((v) => !v)}
                />
                <span class="text-12-medium text-text-strong">空闲</span>
                <span class="text-12-regular text-text-weak">({idleWorkspaces().length})</span>
              </div>
            </div>

            <Collapsible.Content>
              <div class="flex flex-col gap-1">
                <For each={idleWorkspaces()}>
                  {(workspace) => <WorkspaceCard workspace={workspace} isRunning={false} />}
                </For>

                <Show when={filteredWorkspaces().length === 0}>
                  <div class="flex flex-col items-center justify-center py-8 text-text-weak">
                    <Icon name="folder" class="size-10 mb-2 opacity-30" />
                    <span class="text-12-regular">暂无工作空间</span>
                    <span class="text-11-regular text-text-weaker mt-1">
                      从下方设备列表创建
                    </span>
                  </div>
                </Show>
              </div>
            </Collapsible.Content>
          </div>
        </Collapsible>
      </div>

      {/* 设备列表 */}
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
