import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { Spinner } from "@opencode-ai/ui/spinner"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
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
    renameWorkspace,
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
    const device = createMemo(() => {
      const ws = workspace()
      if (!ws?.deviceId) return undefined
      return devices().find((d) => d.id === ws.deviceId)
    })
    const selected = () => selectedWorkspaceId() === cardProps.id
    const [open, setOpen] = createSignal(false)
    const [mounted, setMounted] = createSignal(false)
    const [renaming, setRenaming] = createSignal(false)
    const [renameValue, setRenameValue] = createSignal("")
    const toggle = () => {
      if (!mounted()) setMounted(true)
      setOpen((v) => !v)
    }

    const startRename = () => {
      setRenameValue(workspace()?.name ?? "")
      setRenaming(true)
    }

    let committing = false
    const commitRename = async () => {
      if (committing) return
      committing = true
      setRenaming(false)
      const val = renameValue().trim()
      if (val && val !== workspace()?.name) {
        await renameWorkspace(cardProps.id, val).catch(() => null)
      }
      committing = false
    }

    const handleRenameKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") commitRename()
      if (e.key === "Escape") {
        committing = true
        setRenaming(false)
        committing = false
      }
    }

    // Idle card: three-line layout
    const idleContent = () => (
      <div class="min-w-0 flex flex-col gap-0.5 py-1.5">
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
          <Show
            when={renaming()}
            fallback={
              <>
                <span class="text-13-medium text-text-strong truncate">{workspace()?.name}</span>
                <Show when={workspace()?.isDefault}>
                  <span class="shrink-0 text-10-medium text-text-weaker bg-surface-base px-1 rounded-full">
                    {t("common.default")}
                  </span>
                </Show>
              </>
            }
          >
            <input
              class="flex-1 min-w-0 text-13-medium text-text-strong bg-background-base border border-border-strong-base rounded px-1 focus:outline-none"
              value={renameValue()}
              placeholder={t("workspace.rename.placeholder")}
              onInput={(e: Event) => setRenameValue((e.target as HTMLInputElement).value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKey}
              ref={(el) => setTimeout(() => el?.focus(), 0)}
              onClick={(e: MouseEvent) => e.stopPropagation()}
            />
          </Show>
        </div>
        <span class="text-11-regular text-text-weak truncate">
          {device()?.displayName ?? t("workspace.device.unbound")}
        </span>
        <Show when={primaryDir()}>
          <span class="text-11-regular text-text-weaker truncate">{primaryDir()!.path}</span>
        </Show>
      </div>
    )

    // Running card: single-line layout
    const runningContent = () => (
      <div class="flex items-center gap-1 min-w-0 w-full">
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
        <Show
          when={renaming()}
          fallback={
            <>
              <span class="text-14-regular text-text-strong truncate">{workspace()?.name}</span>
              <Show when={workspace()?.isDefault}>
                <span class="shrink-0 text-10-medium text-text-weaker bg-surface-base px-1 rounded-full">
                  {t("common.default")}
                </span>
              </Show>
              <Icon name={open() ? "chevron-down" : "chevron-right"} size="small" class="shrink-0 text-icon-weak" />
            </>
          }
        >
          <input
            class="flex-1 min-w-0 text-13-medium text-text-strong bg-background-base border border-border-strong-base rounded px-1 focus:outline-none"
            value={renameValue()}
            placeholder={t("workspace.rename.placeholder")}
            onInput={(e: Event) => setRenameValue((e.target as HTMLInputElement).value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKey}
            ref={(el) => setTimeout(() => el?.focus(), 0)}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          />
        </Show>
      </div>
    )

    if (cardProps.isRunning) {
      return (
        <Show when={workspace()}>
          {(ws) => (
            <div>
              <div class="group/workspace flex items-center rounded-md border border-border-weak-base transition-colors cursor-default h-8 has-[.content-area:hover]:bg-surface-base-hover">
                <div
                  classList={{
                    "shrink-0 w-1.5 self-stretch rounded-l-[calc(0.375rem-1px)] transition-colors": true,
                    "bg-icon-critical-base": dot().offline,
                    "bg-icon-success-base": !dot().offline,
                  }}
                />
                <div
                  class="content-area flex-1 min-w-0 flex items-center px-2 transition-colors h-full"
                  onClick={() => toggle()}
                >
                  {runningContent()}
                </div>
                <div class="shrink-0 flex items-center gap-0.5 pr-1 opacity-0 group-hover/workspace:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <Tooltip placement="top" value={t("workspace.more")}>
                      <DropdownMenu.Trigger
                        as={IconButton}
                        icon="dot-grid"
                        variant="ghost"
                        class="size-6 rounded-md cursor-pointer"
                        aria-label={t("workspace.more")}
                      />
                    </Tooltip>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content>
                        <DropdownMenu.Item onSelect={() => handleCloseWorkspace(ws())}>
                          <DropdownMenu.ItemLabel>{t("workspace.close")}</DropdownMenu.ItemLabel>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={startRename}>
                          <DropdownMenu.ItemLabel>{t("workspace.rename")}</DropdownMenu.ItemLabel>
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item onSelect={() => deleteWorkspace(cardProps.id)}>
                          <DropdownMenu.ItemLabel>{t("workspace.delete")}</DropdownMenu.ItemLabel>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu>
                  <Tooltip placement="top" value={t("workspace.newSession")}>
                    <IconButton
                      icon="plus-small"
                      variant="ghost"
                      class="size-6 rounded-md cursor-pointer"
                      aria-label={t("workspace.newSession")}
                      onClick={(event: MouseEvent) => {
                        event.stopPropagation()
                        if (!mounted()) setMounted(true)
                        if (!open()) setOpen(true)
                        const dir = primaryDir()
                        const dirSlug = dir ? encodeDirectory(dir.path) : "default"
                        navigateToNewSession({ workspaceId: cardProps.id, dir: dirSlug })
                      }}
                    />
                  </Tooltip>
                </div>
              </div>
              <Show when={mounted()}>
                <div classList={{ hidden: !open() }}>
                  <WorkspaceSessions id={cardProps.id} />
                </div>
              </Show>
            </div>
          )}
        </Show>
      )
    }

    return (
      <Show when={workspace()}>
        {(ws) => (
          <div
            class="group/workspace flex items-stretch rounded-md border border-border-weak-base transition-colors cursor-default"
            classList={{ "bg-surface-base-active": selected() }}
          >
            <div
              classList={{
                "shrink-0 w-1.5 rounded-l-md transition-colors": true,
                "bg-border-weak-base": true,
              }}
            />
            <div
              classList={{
                "flex-1 min-w-0 flex items-center px-2 transition-colors": true,
                "hover:bg-surface-base-hover": !dot().offline,
                "cursor-not-allowed opacity-60": dot().offline,
              }}
            >
              {idleContent()}
            </div>
            <div class="shrink-0 flex flex-col w-10 border-l border-border-weak-base opacity-0 group-hover/workspace:opacity-100 transition-opacity self-stretch">
              <Tooltip
                placement="left"
                value={dot().offline ? t("workspace.device.offline") : t("workspace.run")}
                class="flex-1"
              >
                <div
                  classList={{
                    "size-full flex items-center justify-center transition-colors rounded-tr-md": true,
                    "cursor-pointer hover:bg-surface-raised-base-hover": !dot().offline,
                    "cursor-not-allowed opacity-60": dot().offline,
                  }}
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    if (dot().offline) return
                    handleOpenWorkspace(ws())
                  }}
                >
                  <Icon name="arrow-up" size="small" class="text-icon-weak" />
                </div>
              </Tooltip>
              <Tooltip placement="left" value={t("workspace.rename")} class="flex-1">
                <div
                  class="size-full flex items-center justify-center cursor-pointer hover:bg-surface-raised-base-hover transition-colors"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    startRename()
                  }}
                >
                  <Icon name="edit" size="small" class="text-icon-weak" />
                </div>
              </Tooltip>
              <Tooltip placement="left" value={t("workspace.delete")} class="flex-1">
                <div
                  class="size-full flex items-center justify-center cursor-pointer hover:bg-surface-raised-base-hover transition-colors rounded-br-md"
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
        )}
      </Show>
    )
  }

  return (
    <div class="flex flex-col h-full w-full bg-background-stronger border-r border-border-weak-base">
      <div class="h-10 shrink-0 flex items-center px-4">
        <span class="text-13-medium">{t("workspace.page.title")}</span>
      </div>
      <div class="shrink-0 p-2 flex items-center gap-1 border-t border-border-weak-base">
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

      <div class="flex-1 min-h-0 overflow-y-auto pb-2">
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
              <div class="flex flex-col gap-1.5">
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
              <div class="flex flex-col gap-1.5">
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
  const { navigateToSession, encodeDirectory: encodeDir } = useWorkspaceNavigate()
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

  // Track whether initial load has been done
  let loaded = false

  // Reload when the workspace's directories or device changes
  createEffect(
    on([dirs, device], ([newDirs, newDevice], prev) => {
      if (!loaded) {
        loaded = true
        load(PAGE_SIZE)
        return
      }
      if (!prev || newDirs !== prev[0] || newDevice !== prev[1]) {
        setSessions([])
        setLimit(PAGE_SIZE)
        load(PAGE_SIZE)
      }
    }),
  )

  const loadMore = () => {
    const next = limit() + PAGE_SIZE
    setLimit(next)
    load(next)
  }

  // Watch current session ID: insert placeholder if not in list
  createEffect(
    on(
      () => params.id,
      (id) => {
        // Insert placeholder for new session not yet in list
        if (id && !sessions().some((s) => s.id === id)) {
          const primary = dirs()[0]
          if (primary) {
            setSessions((list) => [
              {
                id,
                title: "",
                directory: primary.path,
                time: { created: Date.now() },
              },
              ...list,
            ])
          }
        }
      },
    ),
  )

  // When the active session is a placeholder (no title), poll the list until title appears
  createEffect(
    on(
      () => {
        const id = params.id
        if (!id) return undefined
        const s = sessions().find((x) => x.id === id)
        return s && !s.title ? id : undefined
      },
      (id) => {
        if (!id) return
        let stopped = false

        const poll = async () => {
          while (!stopped) {
            await new Promise((r) => setTimeout(r, 2000))
            if (stopped) break
            const uid = device()
            if (!uid) break
            const directories = dirs()
            if (directories.length === 0) break
            const url = getProxyUrl(uid)
            for (const dir of directories) {
              const qs = new URLSearchParams({ directory: dir.path, roots: "true", limit: String(PAGE_SIZE) })
              const res = await fetch(`${url}/session?${qs}`, { credentials: "include" }).catch(() => null)
              if (!res?.ok) continue
              const body = await res.json().catch(() => null)
              const items = (Array.isArray(body) ? body : (body.data ?? [])) as SessionData[]
              const found = items.find((s) => s.id === id)
              if (!found?.title) continue
              setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: found.title } : s)))
              stopped = true
              break
            }
          }
        }

        void poll()
        return () => {
          stopped = true
        }
      },
    ),
  )

  const click = (session: SessionData) => {
    navigateToSession(session.id, { workspaceId: props.id, dir: encodeDir(session.directory) })
  }

  const archive = async (session: SessionData) => {
    const uid = device()
    if (!uid) return
    const url = getProxyUrl(uid)
    await fetch(`${url}/session`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: session.id, directory: session.directory, time: { archived: Date.now() } }),
    }).catch(() => null)
    setSessions((prev) => prev.filter((s) => s.id !== session.id))
    if (params.id === session.id) navigateToSession("", { workspaceId: props.id, dir: encodeDir(session.directory) })
  }

  return (
    <div class="pr-1 py-1">
      <Show when={sessions().length > 0}>
        <nav class="flex flex-col gap-0.5">
          <For each={sessions()}>
            {(session) => {
              const active = () => params.id === session.id
              return (
                <div class="group/session relative">
                  <button
                    class="flex items-center gap-1.5 px-2 h-8 rounded-md text-left transition-all w-full group-hover/session:pr-7"
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
                  </button>
                  <div class="absolute top-0.5 right-0.5 flex items-center opacity-0 pointer-events-none group-hover/session:opacity-100 group-hover/session:pointer-events-auto transition-opacity">
                    <Tooltip value={t("common.archive")} placement="top">
                      <IconButton
                        icon="archive"
                        variant="ghost"
                        class="size-6 rounded-md"
                        aria-label={t("common.archive")}
                        onClick={(event: MouseEvent) => {
                          event.preventDefault()
                          event.stopPropagation()
                          archive(session)
                        }}
                      />
                    </Tooltip>
                  </div>
                </div>
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
      <Show when={!loading() && sessions().length === 0}>
        <div class="flex items-center gap-2 py-2 px-2">
          <span class="text-11-regular text-text-weaker">{t("workspace.emptySessions")}</span>
        </div>
      </Show>
    </div>
  )
}
