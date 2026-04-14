import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
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
import { ContentTabContext, createContentTabStore, useContentTabs, type ContentTab } from "@/context/content-tabs"
import { DeviceInterface, useDeviceLayout } from "./device-interface"
import { FilePreviewTab } from "./file-preview-tab"
import { decode64 } from "@/utils/base64"
import { workspaceKey } from "@/pages/layout/helpers"
import FileTree from "@/components/file-tree"
import type { FileNode } from "@opencode-ai/sdk/v2"

function TabIcon(props: { tab: ContentTab }) {
  return <Icon name={props.tab.icon as any ?? "file-tree"} size="small" class="shrink-0 text-text-weak" />
}

function TabContent(props: { tab: ContentTab; language: ReturnType<typeof useLanguage> }) {
  return (
    <Switch>
      <Match when={props.tab.kind === "file"}>
        <FilePreviewTab tab={props.tab} />
      </Match>
      <Match when={props.tab.kind === "session"}>
        <div class="h-full flex items-center justify-center text-text-weak text-14-regular">
          {props.language.t("workspace.content.sessionComingSoon")}
        </div>
      </Match>
    </Switch>
  )
}

function ContentTabPanel() {
  const tabStore = useContentTabs()
  const language = useLanguage()

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
          <Tabs.List class="h-9 shrink-0 px-1 gap-0.5 border-b border-border-base bg-background-base">
            <For each={tabStore.tabs()}>
              {(tab) => (
                <Tabs.Trigger
                  value={tab.id}
                  class="group flex items-center gap-1.5 h-7 px-2 rounded-md text-13-regular text-text-weak hover:text-text-base hover:bg-background-stronger data-[selected]:text-text-base data-[selected]:bg-background-stronger transition-colors max-w-[160px]"
                >
                  <TabIcon tab={tab} />
                  <span class="truncate">{tab.title}</span>
                  <button
                    class="hidden group-hover:flex items-center justify-center size-4 rounded-sm hover:bg-background-base shrink-0 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation()
                      tabStore.close(tab.id)
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
                  <TabContent tab={tab} language={language} />
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

  const toggle = (section: SidebarSection) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const expandedCount = createMemo(() =>
    Object.values(expanded()).filter(Boolean).length,
  )

  const sections = createMemo<{ key: SidebarSection; icon: string; label: string }[]>(() => [
    { key: "sessions", icon: "message" as any, label: language.t("workspace.content.section.sessions") },
    { key: "files", icon: "file-tree", label: language.t("workspace.content.section.files") },
    { key: "diffs", icon: "git-branch" as any, label: language.t("workspace.content.section.changes") },
  ])

  return (
    <div class="flex flex-col h-full bg-background-base border-r border-border-base">
      <div class="h-10 shrink-0 flex items-center gap-1 px-2 border-b border-border-base">
        <Tooltip value={language.t("workspace.content.newSession")} placement="bottom">
          <IconButton
            icon="plus-small"
            variant="ghost"
            iconSize="medium"
            onClick={() => {}}
            aria-label={language.t("workspace.content.newSession")}
          />
        </Tooltip>
        <div class="flex-1" />
      </div>

      <div class="flex-1 min-h-0 flex flex-col">
        <For each={sections()}>
          {(section, idx) => {
            const isOpen = createMemo(() => expanded()[section.key])
            const isOnly = createMemo(() => isOpen() && expandedCount() === 1)

            return (
              <div
                class="flex flex-col min-h-0"
                classList={{
                  "flex-1": isOnly(),
                  "shrink-0": isOpen() && !isOnly(),
                }}
                style={{
                  height: isOpen() && !isOnly() ? `${heights()[section.key]}px` : undefined,
                }}
              >
                <button
                  class="shrink-0 flex items-center gap-1.5 w-full px-2 text-12-regular text-text-weak hover:text-text-base hover:bg-background-stronger transition-colors cursor-pointer border-b border-border-base"
                  style={{ height: `${SECTION_HEADER_HEIGHT}px` }}
                  onClick={() => toggle(section.key)}
                >
                  <Icon
                    name={isOpen() ? "chevron-down" : "chevron-right"}
                    size="small"
                    class="shrink-0"
                  />
                  <span class="truncate">{section.label}</span>
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
                      <div class="px-3 py-2 text-12-regular text-text-weak">
                        {language.t("workspace.content.comingSoon")}
                      </div>
                    </Show>
                  </div>
                </Show>
                <Show when={isOpen() && !isOnly() && idx() < sections().length - 1}>
                  <ResizeHandle
                    direction="vertical"
                    size={heights()[section.key]}
                    min={SECTION_MIN_HEIGHT}
                    max={800}
                    onResize={(h: number) => setHeights((prev) => ({ ...prev, [section.key]: h }))}
                  />
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
                class="shrink-0 h-full"
                style={{ width: `${dl.fileTree.width()}px` }}
              >
                <ContentSidebar directory={directory()!} />
              </div>
              <ResizeHandle
                direction="horizontal"
                size={dl.fileTree.width()}
                min={160}
                max={500}
                collapseThreshold={100}
                onResize={dl.fileTree.resize}
                onCollapse={dl.fileTree.close}
              />
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
