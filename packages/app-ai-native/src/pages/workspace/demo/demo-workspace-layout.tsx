import type { ParentProps } from "solid-js"
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { WorkspaceProvider, type WorkspaceContextValue } from "../context"
import { ActiveWorkspaceProvider } from "../active-workspace"
import { ServerProvider, ServerConnection } from "@/context/server"
import { WorkspaceSidebar } from "../components/workspace-sidebar"
import { getProxyUrl } from "../lib/url"
import { DeviceClientContext } from "@/context/device-client"
import { DeviceSDKContext } from "@/context/device-sdk"
import { DeviceInitGate } from "@/context/device-init"
import { DeviceFileProvider } from "@/context/device-file"
import { DeviceTerminalProvider } from "@/context/device-terminal"
import { DeviceWorkspaceProvider } from "@/context/device-workspace"
import { DeviceLocalProvider } from "@/context/device-local"
import { DirectoryContext } from "@/context/directory"
import { LayoutContext } from "@/context/layout"
import { ContentTabContext, createContentTabStore } from "@/context/content-tabs"
import { WorkspaceContentLayout } from "../components/workspace-content-layout"
import { WorkspaceInitGate } from "@/context/workspace-init-gate"
import { useDeviceLayout } from "../components/device-interface"
import { createSdkForServer } from "@/utils/server"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { drawer } from "../drawer"
import { demoDevice, demoWorkspace, DEMO_DEVICE_ID, DEMO_WORKSPACE_ID, DEMO_DIRECTORY } from "./demo-fixtures"

// ─── 导航栏可见性管理（与 layout.tsx 的 setNav 一致）──────────────────
const setNav = (hidden: boolean) => {
  if (typeof document === "undefined") return
  const nav = document.querySelector<HTMLElement>('[data-component="root-layout-nav"]')
  if (!nav) return
  nav.style.opacity = hidden ? "0" : "1"
  nav.style.pointerEvents = hidden ? "none" : ""
}

/**
 * Demo 工作空间薄壳组件。
 *
 * 不复制任何真实 Workspace 面板，复用：
 * - WorkspaceSidebar（左侧设备/工作空间列表）
 * - WorkspaceContentLayout（完整工作区 UI）
 * - DeviceSessionView, FileTreeWithTabs, DiffPreviewTab, TerminalTab, SessionComposerRegion
 *
 * 数据全部来自 demo-fixtures.ts + vite mock server，不请求真实 API。
 */
export default function DemoWorkspaceLayout() {
  const language = useLanguage()
  const platform = usePlatform()
  const dl = useDeviceLayout()
  const tabStore = createContentTabStore()
  const [sidebarOpened, setSidebarOpened] = createSignal(true)

  // ─── Demo WorkspaceProvider 数据 ───────────────────────────────
  const workspaceContext: WorkspaceContextValue = {
    workspaces: () => [demoWorkspace],
    devices: () => [demoDevice],
    selectedWorkspaceId: () => DEMO_WORKSPACE_ID,
    enabledWorkspaceIds: () => [DEMO_WORKSPACE_ID],
    closedWorkspaceIds: () => [],
    isLoading: () => false,
    sidebarOpened,
    selectWorkspace() {},
    enableWorkspace() {},
    disableWorkspace() {},
    async createWorkspace() {},
    deleteWorkspace() {},
    async renameWorkspace() {},
    removeVisited() {},
    openSidebar: () => setSidebarOpened(true),
    closeSidebar: () => setSidebarOpened(false),
    toggleSidebar: () => setSidebarOpened((v) => !v),
    refreshDevices() {},
  }

  // ─── Demo Server 连接 ─────────────────────────────────────────
  const serverUrl = getProxyUrl(DEMO_DEVICE_ID)
  const serverKey = ServerConnection.Key.make(serverUrl)
  const demoServer: ServerConnection.Http = {
    type: "http",
    http: { url: serverUrl },
  }

  // ─── SDK Client（与 DirectDeviceProviders 一致）──────────────
  const clientValue = createMemo(() => {
    const client = createSdkForServer({ server: { url: serverUrl }, fetch: platform.fetch, throwOnError: true })
    return {
      client,
      url: serverUrl,
      createClient(opts: { directory: string; throwOnError?: boolean }) {
        return createSdkForServer({ server: { url: serverUrl }, fetch: platform.fetch, ...opts })
      },
    }
  })

  const sdkValue = createMemo(() => {
    const dirClient = createSdkForServer({ server: { url: serverUrl }, fetch: platform.fetch, directory: DEMO_DIRECTORY, throwOnError: true })
    return {
      client: dirClient,
      directory: DEMO_DIRECTORY,
      url: serverUrl,
      createClient(opts: { directory: string; throwOnError?: boolean }) {
        return createSdkForServer({ server: { url: serverUrl }, fetch: platform.fetch, ...opts })
      },
    }
  })

  // ─── DeviceLayoutProvider（与 layout.tsx 一致）────────────────
  const layoutValue = {
    ready: () => true,
    handoff: { tabs: () => undefined, setTabs() {}, clearTabs() {} },
    projects: { list: () => [], open() {}, close() {}, expand() {}, collapse() {}, move() {} },
    sidebar: { opened: () => false, open() {}, close() {}, toggle() {}, width: () => 280, resize() {}, workspaces: () => () => false, setWorkspaces() {}, toggleWorkspaces() {} },
    terminal: { height: () => 200, width: dl.terminal.width, resize: dl.terminal.resize },
    review: { diffStyle: dl.diffStyle, setDiffStyle: dl.setDiffStyle },
    fileTree: { opened: dl.fileTree.opened, width: dl.fileTree.width, tab: () => "all" as const, setTab() {}, open: dl.fileTree.open, close: dl.fileTree.close, toggle: dl.fileTree.toggle, resize: dl.fileTree.resize },
    session: { width: () => 400, resize() {} },
    mobileSidebar: { opened: () => false, show() {}, hide() {}, toggle() {} },
    pendingMessage: { set() {}, consume() { return undefined } },
    view() {
      return {
        scroll: () => ({ x: 0, y: 0 }),
        setScroll() {},
        terminal: { opened: dl.terminal.opened, open: dl.terminal.open, close: dl.terminal.close, toggle: dl.terminal.toggle },
        reviewPanel: { opened: () => false, open() {}, close() {}, toggle() {} },
        review: { open: () => undefined, setOpen() {} },
      }
    },
    tabs() { return { tabs: () => ({ all: [], active: undefined }), active: () => undefined, all: () => [], setActive() {}, setAll() {}, async open() {}, close() {}, move() {} } },
  }

  // ─── 导航栏状态（进入时隐藏）─────────────────────────────────────
  createEffect(() => setNav(drawer.opened()))
  onCleanup(() => { drawer.hide(); setNav(false) })

  return (
    <WorkspaceProvider value={workspaceContext}>
      <ActiveWorkspaceProvider>
        <ServerProvider defaultServer={serverKey} servers={[demoServer]}>
          {/* ─── 左右分栏布局（与 WorkspaceShell 一致）─── */}
          <div class="flex h-full w-full min-h-0 overflow-x-hidden">
            {/* 左侧 Sidebar */}
            <div
              class="hidden h-full shrink-0 overflow-hidden transition-[width] duration-200 md:block"
              style={{ width: sidebarOpened() ? "var(--native-sidebar-width)" : "0px" }}
            >
              <WorkspaceSidebar />
            </div>
            {/* 移动端 Sidebar 抽屉 */}
            <div class="md:hidden">
              <div
                classList={{
                  "fixed inset-x-0 top-0 bottom-0 z-40 transition-opacity duration-200": true,
                  "opacity-100 pointer-events-auto": drawer.opened(),
                  "opacity-0 pointer-events-none": !drawer.opened(),
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) drawer.hide()
                }}
              />
              <aside
                aria-label={language.t("workspace.page.title")}
                classList={{
                  "fixed top-0 bottom-0 left-0 z-50 w-[var(--native-sidebar-width)] max-w-[calc(100vw-2rem)] border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-out": true,
                  "translate-x-0": drawer.opened(),
                  "-translate-x-full": !drawer.opened(),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <WorkspaceSidebar hide={drawer.hide} />
              </aside>
            </div>
            {/* 右侧工作区内容 */}
            <div
              class="flex h-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden bg-background-base"
              classList={{
                "md:rounded-l-[var(--native-radius-lg)]": sidebarOpened(),
                "md:border-l": sidebarOpened(),
                "md:border-l-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)]": sidebarOpened(),
              }}
            >
              {/* ─── 完整 Provider 嵌套（与 WorkspaceContentInstance 一致）─── */}
              <DeviceClientContext.Provider value={clientValue()}>
                <DeviceSDKContext.Provider value={sdkValue()}>
                  <DeviceInitGate>
                    <LayoutContext.Provider value={layoutValue}>
                      <DirectoryContext.Provider value={() => DEMO_DIRECTORY}>
                        <WorkspaceInitGate>
                          <DeviceWorkspaceProvider workspaceId={DEMO_WORKSPACE_ID}>
                            <DeviceFileProvider visible={() => true}>
                              <DeviceTerminalProvider>
                                <DeviceLocalProvider workspaceId={DEMO_WORKSPACE_ID}>
                                  <ContentTabContext.Provider value={tabStore}>
                                    <WorkspaceContentLayout
                                      workspaceId={DEMO_WORKSPACE_ID}
                                      directory={DEMO_DIRECTORY}
                                    />
                                  </ContentTabContext.Provider>
                                </DeviceLocalProvider>
                              </DeviceTerminalProvider>
                            </DeviceFileProvider>
                          </DeviceWorkspaceProvider>
                        </WorkspaceInitGate>
                      </DirectoryContext.Provider>
                    </LayoutContext.Provider>
                  </DeviceInitGate>
                </DeviceSDKContext.Provider>
              </DeviceClientContext.Provider>
            </div>
          </div>
        </ServerProvider>
      </ActiveWorkspaceProvider>
    </WorkspaceProvider>
  )
}
