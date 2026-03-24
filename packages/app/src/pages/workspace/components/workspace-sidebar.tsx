import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { Spinner } from "@opencode-ai/ui/spinner"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { DateTime } from "luxon"
import type { Device, DeviceStatus, Workspace, WorkspaceDirectory } from "../types"
import { DeviceList } from "./device-list"
import { CreateWorkspaceDialogContent } from "./create-workspace-dialog"
import { useWorkspace } from "../context"
import { ServerConnection, useServer } from "@/context/server"
import { getProxyUrl } from "../lib/url"
import { useWorkspaceNavigate } from "@/hooks/use-workspace-navigate"
import { useActiveWorkspace } from "../active-workspace"
import { useLanguage } from "@/context/language"

export function WorkspaceSidebar() {
  const language = useLanguage()
  const t = language.t
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
  }

  const handleCloseWorkspace = (workspace: Workspace) => {
    disableWorkspace(workspace.id)
    if (active.id === workspace.id) active.clear()
    if (params.workspaceID === workspace.id) rawNavigate("/workspace")
  }

  const handleSelectWorkspace = (workspace: Workspace) => {
    if (!workspace.deviceUniqueId) return
    selectWorkspace(workspace.id)
    active.setActive(workspace.id, { ...workspace })
    server.setActive(ServerConnection.Key.make(getProxyUrl(workspace.deviceUniqueId)))
    const primaryDir = getPrimaryDirectory(workspace)
    const dirSlug = primaryDir ? encodeDirectory(primaryDir.path) : "default"
    navigateToNewSession({ workspaceId: workspace.id, dir: dirSlug })
  }

  const [workspaceSearchQuery, setWorkspaceSearchQuery] = createSignal("")
  const [deviceSearchQuery, setDeviceSearchQuery] = createSignal("")
  const [isDeviceListCollapsed, setIsDeviceListCollapsed] = createSignal(false)
  const [isRunningCollapsed, setIsRunningCollapsed] = createSignal(false)
  const [isIdleCollapsed, setIsIdleCollapsed] = createSignal(false)

  const getDeviceStatusDot = (status?: DeviceStatus) => {
    switch (status) {
      case "online":
        return { online: true, offline: false, text: t("workspace.device.online") }
      case "offline":
        return { online: false, offline: true, text: t("workspace.device.offline") }
      default:
        return { online: false, offline: false, text: t("workspace.device.unbound") }
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
        getPrimaryDirectory(workspace)?.path.toLowerCase().includes(query),
    )
  })

  // Use stable ID arrays so <For> tracks by string value equality, not object reference
  const runningIds = createMemo(() =>
    filteredWorkspaces()
      .filter((w) => isEnabled(w))
      .map((w) => w.id),
  )
  const idleIds = createMemo(() =>
    filteredWorkspaces()
      .filter((w) => !isEnabled(w))
      .map((w) => w.id),
  )

  // Lookup helper: always reads from workspaces() to get latest data
  const findWorkspace = (id: string) => workspaces().find((w) => w.id === id)

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

  const WorkspaceCard = (cardProps: { id: string; isRunning: boolean }) => {
    // Derive workspace reactively from the stable id
    const workspace = createMemo(() => findWorkspace(cardProps.id))
    const primaryDir = createMemo(() => {
      const ws = workspace()
      return ws ? getPrimaryDirectory(ws) : undefined
    })
    const dot = createMemo(() => getDeviceStatusDot(workspace()?.deviceStatus))
    const selected = () => selectedWorkspaceId() === cardProps.id
    const [open, setOpen] = createSignal(false)

    return (
      <Show when={workspace()}>
        {(ws) => (
          <Collapsible open={open()}>
            <div
              class="group/workspace flex items-stretch rounded-md transition-colors cursor-default"
              classList={{ "bg-surface-base-active": selected() }}
            >
              <Show
                when={cardProps.isRunning}
                fallback={
                  <div
                    class="flex-1 min-w-0 flex items-center gap-1 px-2 h-10 rounded-l-md hover:bg-surface-raised-base-hover transition-colors"
                    onClick={() => handleSelectWorkspace(ws())}
                  >
                    <div class="shrink-0 size-6 flex items-center justify-center">
                      <Icon name="folder" size="small" class="text-icon-weak" />
                    </div>
                    <div class="min-w-0 flex flex-col">
                      <div class="flex items-center gap-1.5">
                        <Tooltip placement="top" value={dot().text}>
                          <div
                            classList={{
                              "size-1.5 rounded-full shrink-0": true,
                              "bg-icon-success-base": dot().online,
                              "bg-icon-critical-base": dot().offline,
                              "bg-border-weak-base": !dot().online && !dot().offline,
                            }}
                          />
                        </Tooltip>
                        <span class="text-14-regular text-text-strong truncate">{ws().name}</span>
                      </div>
                      <Show when={primaryDir()}>
                        <span class="text-11-regular text-text-weak truncate">{primaryDir()!.path}</span>
                      </Show>
                    </div>
                  </div>
                }
              >
                <Collapsible.Trigger
                  class="flex-1 min-w-0 flex items-center gap-1 px-2 h-10 rounded-l-md hover:bg-surface-raised-base-hover transition-colors cursor-pointer"
                  onClick={() => {
                    setOpen((v) => !v)
                    handleSelectWorkspace(ws())
                  }}
                >
                  <div class="shrink-0 size-6 flex items-center justify-center">
                    <Icon name={open() ? "chevron-down" : "chevron-right"} size="small" class="text-icon-weak" />
                  </div>
                  <div class="min-w-0 flex flex-col">
                    <div class="flex items-center gap-1.5">
                      <Tooltip placement="top" value={dot().text}>
                        <div
                          classList={{
                            "size-1.5 rounded-full shrink-0": true,
                            "bg-icon-success-base": dot().online,
                            "bg-icon-critical-base": dot().offline,
                            "bg-border-weak-base": !dot().online && !dot().offline,
                          }}
                        />
                      </Tooltip>
                      <span class="text-14-regular text-text-strong truncate">{ws().name}</span>
                    </div>
                    <Show when={primaryDir()}>
                      <span class="text-11-regular text-text-weak truncate">{primaryDir()!.path}</span>
                    </Show>
                  </div>
                </Collapsible.Trigger>
              </Show>

              <div class="shrink-0 flex flex-col w-8 border-l border-border-weak-base opacity-0 group-hover/workspace:opacity-100 transition-opacity self-stretch">
                <Tooltip
                  placement="left"
                  value={cardProps.isRunning ? t("workspace.close") : t("workspace.run")}
                  class="flex-1"
                >
                  <div
                    class="h-full flex items-center justify-center cursor-pointer hover:bg-surface-raised-base-hover transition-colors rounded-tr-md"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      cardProps.isRunning ? handleCloseWorkspace(ws()) : handleOpenWorkspace(ws())
                    }}
                  >
                    <Icon
                      name={cardProps.isRunning ? "circle-x" : "circle-check"}
                      size="small"
                      class="text-icon-weak"
                    />
                  </div>
                </Tooltip>
                <Tooltip placement="left" value={t("workspace.delete")} class="flex-1">
                  <div
                    class="h-full flex items-center justify-center cursor-pointer hover:bg-surface-critical-weak transition-colors rounded-br-md"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation()
                      deleteWorkspace(cardProps.id)
                    }}
                  >
                    <Icon name="trash" size="small" class="text-icon-weak" />
                  </div>
                </Tooltip>
              </div>
            </div>
            <Show when={cardProps.isRunning}>
              <Collapsible.Content>
                <WorkspaceSessions id={cardProps.id} />
              </Collapsible.Content>
            </Show>
          </Collapsible>
        )}
      </Show>
    )
  }

  return (
    <div class="flex flex-col h-full w-72 bg-surface-base border-r border-border-weak-base">
      <div class="shrink-0 p-2 border-b border-border-weak-base flex items-center gap-1">
        <div class="flex-1 flex items-center gap-2 h-8 px-2 bg-background-base rounded-md border border-border-weak-base focus-within:border-border-strong-base">
          <Icon name="magnifying-glass" class="size-4 text-text-weak shrink-0" />
          <input
            type="text"
            placeholder={t("workspace.search.placeholder")}
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
              <span class="text-12-medium text-text-weak">{t("workspace.running")}</span>
              <span class="text-11-regular text-text-weaker">{runningIds().length}</span>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div class="flex flex-col gap-0.5">
                <For each={runningIds()}>{(id) => <WorkspaceCard id={id} isRunning={true} />}</For>
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
              <span class="text-12-medium text-text-weak">{t("workspace.idle")}</span>
              <span class="text-11-regular text-text-weaker">{idleIds().length}</span>
            </Collapsible.Trigger>
            <Collapsible.Content>
              <div class="flex flex-col gap-0.5">
                <For each={idleIds()}>{(id) => <WorkspaceCard id={id} isRunning={false} />}</For>
                <Show when={filteredWorkspaces().length === 0}>
                  <div class="flex flex-col items-center justify-center py-8 text-text-weak">
                    <Icon name="folder" class="size-8 mb-2 opacity-30" />
                    <span class="text-12-regular">{t("workspace.empty")}</span>
                    <span class="text-11-regular text-text-weaker mt-1">{t("workspace.emptyHint")}</span>
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

type SessionData = {
  id: string
  title: string
  directory: string
  time: { created: number; updated?: number }
  parentID?: string
}

const PAGE_SIZE = 10

/**
 * Loads and displays sessions for a workspace.
 * Accepts a stable `id` prop instead of a workspace object to avoid
 * SolidJS <For> reference-reuse bugs.
 */
function WorkspaceSessions(props: { id: string }) {
  const language = useLanguage()
  const t = language.t
  const { workspaces } = useWorkspace()
  const { navigateToSession } = useWorkspaceNavigate()
  const params = useParams()
  const [sessions, setSessions] = createSignal<SessionData[]>([])
  const [loading, setLoading] = createSignal(false)
  const [more, setMore] = createSignal(false)
  const [limit, setLimit] = createSignal(PAGE_SIZE)

  // Always derive workspace from the stable id
  const workspace = createMemo(() => workspaces().find((w) => w.id === props.id))
  const dirs = createMemo(() => workspace()?.directories ?? [])
  const device = createMemo(() => workspace()?.deviceUniqueId)

  const load = async (cap: number) => {
    const uid = device()
    if (!uid) return
    const directories = dirs()
    if (directories.length === 0) return
    // Capture id at call time for stale-check
    const target = props.id

    setLoading(true)
    try {
      const url = getProxyUrl(uid)
      const all: SessionData[] = []
      for (const dir of directories) {
        const qs = new URLSearchParams({ directory: dir.path, roots: "true", limit: String(cap) })
        const res = await fetch(`${url}/session?${qs}`, { credentials: "include" }).catch(() => null)
        if (!res?.ok) continue
        const body = await res.json().catch(() => [])
        const items = (Array.isArray(body) ? body : (body.data ?? [])) as SessionData[]
        for (const s of items) {
          if (!s.parentID && !all.some((x) => x.id === s.id)) all.push(s)
        }
      }
      // Stale guard: if the component's id changed while fetching, discard
      if (props.id !== target) return
      all.sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      setMore(all.length >= cap)
      setSessions(all)
    } finally {
      setLoading(false)
    }
  }

  // Reload when the workspace's directories or device changes
  createEffect(
    on([dirs, device], () => {
      setSessions([])
      setLimit(PAGE_SIZE)
      load(PAGE_SIZE)
    }),
  )

  const loadMore = () => {
    const next = limit() + PAGE_SIZE
    setLimit(next)
    load(next)
  }

  const click = (session: SessionData) => {
    navigateToSession(session.id, { workspaceId: props.id })
  }

  return (
    <div class="pr-1 py-1">
      <Show when={sessions().length > 0}>
        <nav class="flex flex-col gap-0.5">
          <For each={sessions()}>
            {(session) => {
              const active = () => params.id === session.id
              return (
                <button
                  class="flex items-center gap-1.5 px-2 h-8 rounded text-left transition-colors w-full"
                  classList={{
                    "bg-surface-base-active": active(),
                    "hover:bg-surface-raised-base-hover/50": !active(),
                  }}
                  onClick={() => click(session)}
                >
                  <Icon
                    name="bubble-5"
                    class="size-3 shrink-0"
                    classList={{ "text-icon-base": active(), "text-text-weaker": !active() }}
                  />
                  <span
                    class="text-12-regular truncate flex-1"
                    classList={{ "text-text-strong": active(), "text-text-base": !active() }}
                  >
                    {session.title || t("workspace.session.new")}
                  </span>
                  <span class="text-10-regular text-text-weaker shrink-0">
                    {DateTime.fromMillis(session.time.updated ?? session.time.created).toRelative()}
                  </span>
                </button>
              )
            }}
          </For>
          <Show when={more()}>
            <button
              class="flex items-center justify-center h-7 w-full rounded text-11-regular text-text-weak hover:bg-surface-raised-base-hover/50 transition-colors"
              disabled={loading()}
              onClick={loadMore}
            >
              <Show when={loading()} fallback={t("workspace.loadMore")}>
                <Spinner class="size-3" />
              </Show>
            </button>
          </Show>
        </nav>
      </Show>
      <Show when={loading() && sessions().length === 0}>
        <div class="flex items-center gap-2 py-2 px-2">
          <Spinner class="size-3.5" />
          <span class="text-11-regular text-text-weaker">{t("workspace.loadingSessions")}</span>
        </div>
      </Show>
    </div>
  )
}
