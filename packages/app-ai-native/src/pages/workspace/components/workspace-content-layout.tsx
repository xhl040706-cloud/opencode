import { createMemo, createSignal, For, Match, onMount, Show, Switch, createEffect, on, onCleanup, untrack } from "solid-js"
import { useParams } from "@solidjs/router"
import { Toast } from "@opencode-ai/ui/toast"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { ResizeHandle } from "@opencode-ai/ui/resize-handle"
import { Tabs } from "@opencode-ai/ui/tabs"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { useServer } from "@/context/server"
import { useLanguage } from "@/context/language"
import { useFile } from "@/context/file"
import { useDeviceProject } from "@/context/device-project"
import { useDeviceSDK } from "@/context/device-sdk"
import { useDeviceWorkspace } from "@/context/device-workspace"
import { DeviceSessionProvider } from "@/context/device-session"
import { DeviceSessionTab } from "./device-session-tab"
import { TerminalTab } from "./terminal-tab"
import { useDeviceTerminal } from "@/context/device-terminal"
import { ContentTabContext, createContentTabStore, useContentTabs, type ContentTab } from "@/context/content-tabs"
import { DeviceInterface, useDeviceLayout } from "./device-interface"
import { FilePreviewTab } from "./file-preview-tab"
import { DiffPreviewTab } from "./diff-preview-tab"
import { decode64 } from "@/utils/base64"
import { workspaceKey } from "@/pages/layout/helpers"
import FileTree from "@/components/file-tree"
import type { FileNode } from "@opencode-ai/sdk/v2"
import type { DiffFileEntry } from "@/client/device-client"
import { getDirectory, getFilename } from "@opencode-ai/util/path"

let newSessionCounter = 0

let newTerminalCounter = 0

function TabIcon(props: { tab: ContentTab }) {
  return <Icon name={props.tab.icon as any ?? "file-tree"} size="small" class="shrink-0 text-text-weak" />
}

function TabContent(props: { tab: ContentTab }) {
  return (
    <Switch>
      <Match when={props.tab.kind === "file"}>
        <FilePreviewTab tab={props.tab} />
      </Match>
      <Match when={props.tab.kind === "diff"}>
        <DiffPreviewTab tab={props.tab} />
      </Match>
      <Match when={props.tab.kind === "session"}>
        <DeviceSessionProvider sessionID={(props.tab.meta as any)?.sessionID}>
          <DeviceSessionTab tabId={props.tab.id} />
        </DeviceSessionProvider>
      </Match>
      <Match when={props.tab.kind === "terminal"}>
        <TerminalTab tab={props.tab} />
      </Match>
    </Switch>
  )
}

function ContentTabPanel() {
  const tabStore = useContentTabs()
  const terminal = useDeviceTerminal()
  const language = useLanguage()

  const closeTab = (id: string) => {
    const tab = tabStore.tabs().find((t) => t.id === id)
    if (tab?.kind === "terminal") {
      const sessionId = (tab.meta as any)?.sessionId as string | undefined
      if (sessionId) terminal.close(sessionId)
    }
    tabStore.close(id)
  }

  return (
    <div class="flex-1 min-w-0 h-full flex flex-col">
      <Show
        when={tabStore.tabs().length > 0}
        fallback={
          <div class="flex-1 h-full flex items-center justify-center text-text-weak text-14-regular">
            {language.t("workspace.content.selectFileOrSession")}
          </div>
        }
      >
        <Tabs
          value={tabStore.activeId()}
          onChange={tabStore.activate}
          class="h-full flex flex-col"
        >
          <Tabs.List class="h-[41px] shrink-0 border-b bg-background-base [&::after]:border-b-0 overflow-x-auto scrollbar-none" onWheel={(e) => { e.currentTarget.scrollLeft += e.deltaY }}>
            <For each={tabStore.tabs()}>
              {(tab) => (
                <Tabs.Trigger
                  value={tab.id}
                  class="group h-full min-w-[100px] max-w-[180px] !bg-background-weak !border-b-0 has-[[data-selected]]:!bg-background-base has-[[data-selected]]:!border-b has-[[data-selected]]:before:absolute has-[[data-selected]]:before:top-0 has-[[data-selected]]:before:left-0 has-[[data-selected]]:before:right-0 has-[[data-selected]]:before:h-[2px] has-[[data-selected]]:before:bg-icon-strong-base [&>[data-slot=tabs-trigger]]:h-full [&>[data-slot=tabs-trigger]]:w-full [&>[data-slot=tabs-trigger]]:px-2 [&>[data-slot=tabs-trigger]]:gap-1.5 flex items-center gap-1.5 text-13-regular text-text-weak hover:text-text-base has-[[data-selected]]:text-text-base transition-colors relative"
                >
                  <TabIcon tab={tab} />
                  <span class="truncate flex-1 min-w-0">{tab.title}</span>
                  <button
                    class="flex items-center justify-center h-full w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                  >
                    <Icon name={"close-small" as any} size="small" class="text-text-weak" />
                  </button>
                </Tabs.Trigger>
              )}
            </For>
          </Tabs.List>
          <For each={tabStore.tabs()}>
            {(tab) => (
              <Show when={tabStore.activeId() === tab.id}>
                <Tabs.Content value={tab.id} class="flex-1 min-h-0">
                  <TabContent tab={tab} />
                </Tabs.Content>
              </Show>
            )}
          </For>
        </Tabs>
      </Show>
    </div>
  )
}

function FileTreeWithTabs(props: { path: string }) {
  const tabStore = useContentTabs()
  const file = useFile()

  const handleFileClick = (node: FileNode) => {
    if (node.type === "directory") return
    const path = node.path ?? node.absolute
    if (!path) return
    tabStore.open({
      kind: "file",
      key: path,
      title: node.name,
      icon: "file-tree",
      meta: { path },
    })
    void file.load(path)
  }

  return <FileTree path={props.path} onFileClick={handleFileClick} />
}

type SidebarSection = "sessions" | "files" | "diffs"

const SECTION_MIN_HEIGHT = 120
const SECTION_HEADER_HEIGHT = 32

function ContentSidebar(props: { directory: string }) {
  const language = useLanguage()
  const dl = useDeviceLayout()
  const tabStore = useContentTabs()
  const terminal = useDeviceTerminal()
  const sdk = useDeviceSDK()
  const [expanded, setExpanded] = createSignal<Record<SidebarSection, boolean>>({
    sessions: false,
    files: true,
    diffs: false,
  })
  const [heights, setHeights] = createSignal<Record<SidebarSection, number>>({
    sessions: SECTION_MIN_HEIGHT,
    files: 300,
    diffs: SECTION_MIN_HEIGHT,
  })
  const [diffFiles, setDiffFiles] = createSignal<DiffFileEntry[]>([])
  const [diffBranch, setDiffBranch] = createSignal<string>("")
  const [diffLoading, setDiffLoading] = createSignal(false)

  const loadDiff = async () => {
    if (diffLoading()) return
    setDiffLoading(true)
    try {
      const result = await sdk.client.runtime.diff({ stat: true })
      if (result) {
        setDiffFiles(result.files ?? [])
        setDiffBranch(result.branch ?? "")
      }
    } catch {
      setDiffFiles([])
    } finally {
      setDiffLoading(false)
    }
  }

  createEffect(() => {
    if (expanded().diffs) untrack(() => loadDiff())
  })

  const diffCount = createMemo(() => diffFiles().length)

  const statusColor = (status: string) => {
    switch (status) {
      case "modified": return "text-warning"
      case "deleted": return "text-danger"
      case "renamed": return "text-info"
      default: return "text-text-weak"
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "modified": return "pencil-line"
      case "deleted": return "trash"
      case "renamed": return "arrow-right"
      default: return "file-tree"
    }
  }

  const toggle = (section: SidebarSection) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const expandedCount = createMemo(() =>
    Object.values(expanded()).filter(Boolean).length,
  )

  const sections = createMemo<{ key: SidebarSection; icon: string; label: string; badge?: number }[]>(() => [
    { key: "sessions", icon: "message" as any, label: language.t("workspace.content.section.sessions") },
    { key: "files", icon: "file-tree", label: language.t("workspace.content.section.files") },
    { key: "diffs", icon: "branch" as any, label: language.t("workspace.content.section.changes"), badge: diffCount() || undefined },
  ])

  return (
    <div class="flex flex-col h-full bg-background-base border-r">
      <div class="h-[41px] shrink-0 flex items-center gap-1 px-2 border-b">
        <Tooltip value={language.t("workspace.content.newSession")} placement="bottom">
          <IconButton
            icon="plus-small"
            variant="ghost"
            iconSize="medium"
            onClick={() => {
              newSessionCounter++
              tabStore.open({
                kind: "session",
                key: `new-${newSessionCounter}`,
                title: language.t("command.session.new"),
                icon: "message",
                meta: { sessionID: undefined },
              })
            }}
            aria-label={language.t("workspace.content.newSession")}
          />
        </Tooltip>
        <Tooltip value={language.t("command.terminal.new")} placement="bottom">
          <IconButton
            icon="terminal"
            variant="ghost"
            iconSize="medium"
            onClick={() => {
              newTerminalCounter++
              const pendingKey = `pending-${newTerminalCounter}`
              tabStore.open({
                kind: "terminal",
                key: pendingKey,
                title: language.t("command.terminal.new"),
                icon: "terminal",
                meta: { sessionId: undefined },
              })
              terminal.new().then((sessionId) => {
                if (!sessionId) {
                  tabStore.close(tabStore.makeTabId("terminal", pendingKey))
                  return
                }
                tabStore.replace(tabStore.makeTabId("terminal", pendingKey), {
                  kind: "terminal",
                  key: sessionId,
                  title: `Terminal`,
                  icon: "terminal",
                  meta: { sessionId },
                })
              })
            }}
            aria-label={language.t("command.terminal.new")}
          />
        </Tooltip>
        <div class="flex-1" />
      </div>

      <div class="flex-1 min-h-0 flex flex-col">
        <For each={sections()}>
          {(section, idx) => {
            const isOpen = createMemo(() => expanded()[section.key])
            const isFirstExpanded = createMemo(() => {
              if (!isOpen()) return false
              const keys: SidebarSection[] = ["sessions", "files", "diffs"]
              for (const k of keys) {
                if (expanded()[k]) return k === section.key
              }
              return false
            })

            return (
              <div
                class="flex flex-col min-h-0 relative"
                classList={{
                  "flex-1": isFirstExpanded(),
                  "shrink-0": isOpen() && !isFirstExpanded(),
                }}
                style={{
                  height: isOpen() && !isFirstExpanded() ? `${heights()[section.key]}px` : undefined,
                }}
              >
                <Show when={isOpen() && !isFirstExpanded()}>
                  <ResizeHandle
                    direction="vertical"
                    size={heights()[section.key]}
                    min={SECTION_MIN_HEIGHT}
                    max={800}
                    onResize={(h: number) => setHeights((prev) => ({ ...prev, [section.key]: h }))}
                  />
                </Show>
                <button
                  class="shrink-0 flex items-center gap-1.5 w-full px-2 text-12-regular text-text-weak hover:text-text-base hover:bg-background-stronger transition-colors cursor-pointer border-b"
                  style={{ height: `${SECTION_HEADER_HEIGHT}px` }}
                  onClick={() => toggle(section.key)}
                >
                  <Icon
                    name={isOpen() ? "chevron-down" : "chevron-right"}
                    size="small"
                    class="shrink-0"
                  />
                  <span class="truncate">{section.label}</span>
                  <Show when={section.badge !== undefined}>
                    <span class="ml-auto text-11-regular text-text-weak tabular-nums">{section.badge}</span>
                  </Show>
                </button>
                <Show when={isOpen()}>
                  <div class="flex-1 min-h-0 overflow-y-auto">
                    <Show when={section.key === "sessions"}>
                      <div class="px-3 py-2 text-12-regular text-text-weak">
                        {language.t("workspace.content.comingSoon")}
                      </div>
                    </Show>
                    <Show when={section.key === "files"}>
                      <div class="p-2">
                        <FileTreeWithTabs path={props.directory} />
                      </div>
                    </Show>
                    <Show when={section.key === "diffs"}>
                      <Show when={!diffLoading()} fallback={
                        <div class="px-3 py-2 text-12-regular text-text-weak">
                          {language.t("common.loading")}{language.t("common.loading.ellipsis")}
                        </div>
                      }>
                        <Show when={diffFiles().length > 0} fallback={
                          <div class="px-3 py-2 text-12-regular text-text-weak">
                            {language.t("session.review.noChanges")}
                          </div>
                        }>
                          <div class="px-2 py-1">
                            <Show when={diffBranch()}>
                              <div class="px-1 pb-1 text-11-regular text-text-weak flex items-center gap-1">
                                <Icon name="branch" size="small" class="shrink-0" />
                                <span class="truncate">{diffBranch()}</span>
                              </div>
                            </Show>
                            <For each={diffFiles()}>
                              {(file) => (
                                <div class="flex items-center gap-1.5 px-1 py-0.5 text-12-regular hover:bg-background-stronger rounded-sm cursor-pointer group/diff"
                                  onClick={() => {
                                    tabStore.open({
                                      kind: "diff",
                                      key: file.path,
                                      title: getFilename(file.path),
                                      icon: statusIcon(file.status) as string,
                                      meta: { path: file.path, status: file.status },
                                    })
                                  }}
                                >
                                  <Icon name={statusIcon(file.status) as any} size="small" class={`shrink-0 ${statusColor(file.status)}`} />
                                  <span class="truncate flex-1 min-w-0">{file.path}</span>
                                  <Show when={file.additions > 0 || file.deletions > 0}>
                                    <span class="shrink-0 text-11-regular tabular-nums flex items-center gap-0.5">
                                      <Show when={file.additions > 0}>
                                        <span class="text-success">+{file.additions}</span>
                                      </Show>
                                      <Show when={file.deletions > 0}>
                                        <span class="text-danger">-{file.deletions}</span>
                                      </Show>
                                    </span>
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                        </Show>
                      </Show>
                    </Show>
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

export function WorkspaceContentLayout() {
  const params = useParams()
  const server = useServer()
  const language = useLanguage()
  const dl = useDeviceLayout()
  const tabStore = createContentTabStore()

  const ready = createMemo(() => !!params.workspaceID && !!server.key)
  const directory = createMemo(() => {
    const dir = decode64(params.dir) ?? ""
    if (!dir) return ""
    return workspaceKey(dir)
  })

  return (
    <Show
      when={ready() && directory()}
      fallback={<div class="size-full" />}
    >
      <DeviceInterface directory={directory()!} deviceLayout={dl}>
        <ContentTabContext.Provider value={tabStore}>
          <div class="flex h-full w-full min-h-0">
            <Show when={dl.fileTree.opened()}>
              <div
                class="shrink-0 h-full relative"
                style={{ width: `${dl.fileTree.width()}px` }}
              >
                <ContentSidebar directory={directory()!} />
                <ResizeHandle
                  direction="horizontal"
                  size={dl.fileTree.width()}
                  min={160}
                  max={500}
                  collapseThreshold={100}
                  onResize={dl.fileTree.resize}
                  onCollapse={dl.fileTree.close}
                />
              </div>
            </Show>

            <div class="flex-1 min-w-0 h-full flex flex-col">
              <ContentTabPanel />
            </div>
          </div>
          <Toast.Region />
        </ContentTabContext.Provider>
      </DeviceInterface>
    </Show>
  )
}
