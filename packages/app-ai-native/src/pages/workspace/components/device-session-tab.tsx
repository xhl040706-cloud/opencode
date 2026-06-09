import { Show, For, createMemo, createSignal, createEffect, on, onCleanup, batch } from "solid-js"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { createStore, produce } from "solid-js/store"
import { createAutoScroll } from "@opencode-ai/ui/hooks"
import { DataProvider } from "@opencode-ai/ui/context"
import { FileComponentProvider } from "@opencode-ai/ui/context/file"
import { File } from "@opencode-ai/ui/file"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Button } from "@opencode-ai/ui/button"
import { Card } from "@opencode-ai/ui/card"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useDeviceSDK } from "@/context/device-sdk"
import { useDeviceWorkspace } from "@/context/device-workspace"
import { useDeviceSessionStore } from "@/context/device-session"
import { useDeviceLocal } from "@/context/device-local"
import { deviceAdapter, ConversationAdapterContext } from "@/context/device-adapter"
import { useLanguage } from "@/context/language"
import { useFile } from "@/context/file"
import { SyncContext } from "@/context/sync"
import { LocalContext } from "@/context/local"
import { SDKContext } from "@/context/sdk"
import { PromptProvider, usePrompt } from "@/context/prompt"
import { CommentsContext } from "@/context/comments"
import { PermissionContext } from "@/context/permission"
import { CommandContext } from "@/context/command"
import { GlobalSyncContext } from "@/context/global-sync"
import { SettingsContext } from "@/context/settings"
import { DirectoryContext } from "@/context/directory"
import { LayoutContext } from "@/context/layout"
import { FileContext } from "@/context/file"
import { NewSessionView } from "@/components/session/session-new-view"
import { MessageTimeline } from "@/pages/session/message-timeline"
import { SessionComposerRegion } from "@/pages/session/composer/session-composer-region"
import { createDeviceSessionComposerState } from "@/pages/session/composer/device-session-composer-state"
import { createScrollSpy } from "@/pages/session/scroll-spy"
import { useContentTabs } from "@/context/content-tabs"
import { useSessionTab } from "@/context/session-tab"
import type {
  Message,
  Part,
  Session,
  SessionStatus,
  FileDiff,
  Todo,
  Command,
  Agent,
  VcsInfo,
  ProviderListResponse,
  PermissionRequest,
  QuestionRequest,
} from "@opencode-ai/sdk/v2/client"
import type { Project, Path } from "@opencode-ai/sdk/v2/client"
import type { ProviderCapability, ProviderCapabilitiesResponse } from "@/context/global-sync/types"
import { legacyProvider } from "@/utils/legacy-provider"

import { SessionQrCodeContent } from "./session-qrcode-dialog"
import { isMobile } from "@/lib/mobile"
import { env } from "@/lib/env"

const emptyMessages: Message[] = []
const idle: SessionStatus = { type: "idle" }
const busySinceMap = new Map<string, number>()

// One-shot prompt seeder: prefills the composer with a fixed prefix (e.g.
// `/skill-writer `) once the device's model + agent are ready, placing the
// cursor at the end so the user just types their request and presses Enter.
// Opt-in via `DeviceSessionTab`'s `promptSeed` prop; never auto-sends, so it
// does not affect ordinary workspace sessions.
function PromptSeeder(props: { seed?: string }) {
  const prompt = usePrompt()
  const local = useDeviceLocal()
  let seeded = false
  createEffect(() => {
    if (seeded) return
    const seed = props.seed
    if (!seed) return
    if (!prompt.ready()) return
    if (!local.model.current() || !local.agent.current()) return
    if (prompt.dirty()) {
      seeded = true
      return
    }
    seeded = true
    prompt.set([{ type: "text", content: seed, start: 0, end: seed.length }], seed.length)
  })
  return null
}

export function DeviceSessionView(props: { tabId: string; promptSeed?: string; hiddenSeed?: string }) {
  const device = useDeviceSDK()
  const workspace = useDeviceWorkspace()
  const store = useDeviceSessionStore()
  const local = useDeviceLocal()
  const language = useLanguage()
  const file = useFile()
  const tabStore = useContentTabs()
  const dialog = useDialog()
  const sessionTab = useSessionTab()

  let snapFrame: number | undefined

  const sid = createMemo(() => sessionTab.rootSessionID())
  const [viewingStack, setViewingStack] = createSignal<{ id: string; name: string }[]>([])
  const [phase, setPhase] = createStore<Record<string, "loading" | "ready" | "error">>({})
  createEffect((prev: string[]) => {
    const stack = viewingStack()
    const currentIds = stack.map((e) => e.id)
    if (prev.length > currentIds.length) {
      batch(() => {
        setPhase(
          produce((draft: Record<string, "loading" | "ready" | "error">) => {
            const removed = prev.filter((id) => !currentIds.includes(id))
            for (const id of removed) delete draft[id]
          }),
        )
      })
    }
    return currentIds
  }, [] as string[])

  const containerRef = (el: HTMLDivElement) => {
    el.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement
        const anchor = target.closest("a")
        if (!anchor) return
        const href = anchor.getAttribute("href")
        if (!href?.startsWith("#subagent-")) return
        e.preventDefault()
        e.stopPropagation()
        const id = href.slice("#subagent-".length)
        const name = anchor.textContent?.trim() || id.slice(0, 8)
        setViewingStack((prev) => [...prev, { id, name }])
      },
      true,
    )
  }

  const isNew = sessionTab.isNew

  const rootSessionID = sessionTab.rootSessionID

  const mobileUrl = createMemo(() => {
    const host = `${env.MOBILE_HOST}${env.BASE_PATH ? `${env.BASE_PATH}` : ""}`
    if (!host) return ""
    const wsId = workspace.workspaceId
    const sid = rootSessionID()
    if (!wsId || !sid) return ""
    return `${host}/m/workspace/${wsId}?session=${sid}`
  })
  const viewingSessionID = createMemo(() => {
    const stack = viewingStack()
    return stack.length > 0 ? stack[stack.length - 1].id : undefined
  })
  const currentSessionID = createMemo(() => viewingSessionID() ?? rootSessionID())

  createEffect(() => {
    local.setActiveSession(currentSessionID())
  })

  createEffect(() => {
    if (isNew()) return
    const msgs = effectiveMessages()
    const last = [...msgs].reverse().find((m) => m.role === "user")
    if (!last) return
    if (last.agent) local.agent.set(last.agent)
    const lastModel = (last as any).model as { providerID: string; modelID: string } | undefined
    if (lastModel && lastModel.providerID) {
      local.model.set(lastModel)
    }
  })

  const adapter = createMemo(() => deviceAdapter(device.client))

  const effectiveMessages = createMemo(() => {
    const cid = currentSessionID()
    if (!cid) return [] as Message[]
    return store.data.messages[cid] ?? []
  })

  const effectiveStatus = createMemo(() => {
    const cid = currentSessionID()
    if (cid) return workspace.data.sessionStatus[cid] ?? ({ type: "idle" } as SessionStatus)
    return ({ type: "idle" } as SessionStatus)
  })

  const isWorking = createMemo(() => {
    const t = effectiveStatus()?.type
    return t === "busy" || t === "retry"
  })

  const busySince = createMemo(() => {
    const cid = currentSessionID()
    if (!cid || !isWorking()) return undefined
    let t = busySinceMap.get(cid)
    if (t === undefined) {
      t = Date.now()
      busySinceMap.set(cid, t)
    }
    return t
  })

  createEffect(() => {
    const cid = currentSessionID()
    if (!cid) return
    if (!isWorking()) {
      busySinceMap.delete(cid)
    }
  })

  let reconcileTimer: ReturnType<typeof setTimeout> | undefined
  let wasActive = false

  createEffect(() => {
    const cid = currentSessionID()
    if (!cid) {
      wasActive = false
      return
    }
    const active = isWorking()
    if (wasActive && !active) {
      if (reconcileTimer) clearTimeout(reconcileTimer)
      const targetId = cid
      reconcileTimer = setTimeout(() => {
        reconcileTimer = undefined
        if (currentSessionID() !== targetId) return
        reconcileSessionData(targetId)
      }, 150)
    }
    wasActive = active
  })

  onCleanup(() => {
    if (reconcileTimer) {
      clearTimeout(reconcileTimer)
      reconcileTimer = undefined
    }
  })

  const reconcileSessionData = async (targetId: string) => {
    try {
      await store.loadMessages(targetId)
      requestAnimationFrame(() => resumeScroll())
    } catch {}
  }

  const effectiveParts = createMemo(() => {
    return store.data.parts
  })

  createEffect(
    on(currentSessionID, (id) => {
      if (!id) return
      const cached = store.data.messages[id]
      setPhase(id, cached?.length ? "ready" : "loading")
      Promise.all([
        store.loadMessages(id),
        store.todo(id),
      ])
        .then(() => {
          if (currentSessionID() === id) setPhase(id, "ready")
        })
        .catch(() => {
          if (currentSessionID() === id && phase[id] !== "ready") setPhase(id, "error")
        })
    }),
  )

  onCleanup(() => {
    if (snapFrame !== undefined) cancelAnimationFrame(snapFrame)
  })

  // ── Adapt device providers to original context interfaces ──

  // SDKContext value
  const sdkValue = {
    client: device.client,
    directory: device.directory,
    url: device.url,
    createClient: device.createClient,
    event: {
      listen(cb: (e: any) => void) {
        return () => {}
      },
    },
  }

  // SyncContext value — adapt DeviceWorkspaceProvider + DeviceSessionProvider
  type SyncDataShape = {
    status: "complete" | "loading"
    agent: Agent[] | undefined
    agentRuntimes: unknown[]
    command: Command[] | undefined
    project: string
    projectMeta: any
    icon: string | undefined
    provider: ProviderCapabilitiesResponse | undefined
    path: Path
    session: Session[]
    sessionTotal: number
    session_status: Record<string, SessionStatus>
    session_diff: Record<string, FileDiff[]>
    todo: Record<string, Todo[]>
    permission: Record<string, PermissionRequest[]>
    question: Record<string, QuestionRequest[]>
    mcp: Record<string, any>
    lsp: any[]
    vcs: VcsInfo | undefined
    limit: number
    message: Record<string, Message[]>
    part: Record<string, Part[]>
    partProgress: Record<string, string[]>
  }

  const [syncData, setSyncData] = createStore<SyncDataShape>({
    status: "complete",
    agent: undefined,
    agentRuntimes: [],
    command: undefined,
    project: "",
    projectMeta: undefined,
    icon: undefined,
    provider: undefined,
    path: { directory: device.directory } as Path,
    session: [],
    sessionTotal: 0,
    session_status: {},
    session_diff: {},
    todo: {},
    permission: {},
    question: {},
    mcp: {},
    lsp: [],
    vcs: undefined,
    limit: 50,
    message: {},
    part: {},
    partProgress: {},
  })

  createEffect(() => {
    const s = workspace.data.status
    setSyncData(
      "status",
      s === "unavailable" ? ("complete" as const) : s === "loading" ? ("loading" as const) : ("complete" as const),
    )
  })
  createEffect(() => setSyncData("agent", workspace.data.agent))
  createEffect(() => setSyncData("command", workspace.data.command))
  createEffect(() => setSyncData("provider", workspace.data.provider))
  createEffect(() => setSyncData("session", workspace.data.session))
  createEffect(() => setSyncData("sessionTotal", workspace.data.sessionTotal))
  createEffect(() => setSyncData("permission", workspace.data.permissions))
  createEffect(() => setSyncData("question", workspace.data.questions))
  createEffect(() => setSyncData("vcs", workspace.data.vcs))
  createEffect(() => {
    const cid = currentSessionID()
    const status = effectiveStatus()
    setSyncData("session_status", {
      ...workspace.data.sessionStatus,
      ...(cid ? { [cid]: status } : {}),
      "": status,
      undefined: status,
    })
  })
  createEffect(() => {
    const cid = currentSessionID() ?? ""
      setSyncData("todo", { [cid]: store.data.todos[cid] ?? [] })
  })
  createEffect(() => {
    const msgs = effectiveMessages()
    const cid = currentSessionID() ?? ""
    setSyncData("message", { [cid]: msgs, "": msgs })
  })
  createEffect(() => {
    setSyncData("partProgress", store.data.partProgress)
  })

  const syncSet = (...args: any[]) => {
    if (!viewingSessionID()) return
    if (args[0] === "session_status" && args[1]) {
      workspace.session.setStatus(args[1] as string, args[2] as SessionStatus | undefined)
    }
  }

  const syncValue = {
    get data() {
      return syncData
    },
    get set() {
      return syncSet
    },
    get status() {
      return syncData.status
    },
    get ready() {
      return workspace.data.status !== "loading"
    },
    get project() {
      return {
        id: device.directory,
        worktree: device.directory,
        name: undefined as string | undefined,
        time: { created: Date.now(), updated: Date.now() },
      } as Project
    },
    session: {
      get(id: string) {
        return workspace.data.session.find((s) => s.id === id)
      },
      optimistic: {
        add(input: { directory?: string; sessionID: string; message: Message; parts: Part[] }) {
          const cid = currentSessionID() ?? input.sessionID
          store.optimisticAdd({ sessionID: cid, message: input.message, parts: input.parts })
        },
        remove(input: { directory?: string; sessionID: string; messageID: string }) {
          const cid = currentSessionID() ?? input.sessionID
          store.optimisticRemove({ sessionID: cid, messageID: input.messageID })
        },
      },
      addOptimisticMessage(input: {
        sessionID: string
        messageID: string
        parts: Part[]
        agent: string
        model: { providerID: string; modelID: string }
      }) {
        const cid = currentSessionID() ?? input.sessionID
        store.addOptimisticMessage({
          sessionID: cid,
          messageID: input.messageID,
          parts: input.parts,
          agent: input.agent,
          model: input.model,
        })
      },
      replaceTab(input: { sessionID: string; title?: string }) {
        sessionTab.replaceTab(input)
      },
      async sync(id: string) {
        await store.syncSession(id)
      },
      async diff(_id: string) {},
      async todo(id: string) {
        await store.todo(id)
      },
      history: {
        more(id: string) {
          return store.historyMore(id)
        },
        loading(id: string) {
          return store.historyLoading(id)
        },
        async loadMore(id: string, count?: number) {
          await store.historyLoadMore(id, count)
        },
      },
      async fetch(count?: number) {
        await workspace.session.fetch(count)
      },
      async remove(id: string) {
        await workspace.session.remove(id)
      },
    },
    command: {
      async load() {
        return workspace.command.load()
      },
    },
    vcs: {
      async load() {
        return workspace.vcs.load()
      },
    },
    directory: device.directory,
    currentSessionID,
    navigateBack: () => setViewingStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev)),
  }

  // LocalContext value
  const localValue = local

  // CommentsContext value
  const commentsValue = {
    add() {},
    update() {},
    remove() {},
    clear() {},
    all: () => [] as any[],
    focus() {},
    setFocus() {},
    active: () => false,
    setActive() {},
    replace() {},
  }

  // PermissionContext value
  const permissionValue = {
    ready: () => true,
    respond(input: any) {
      store.permissionRespond(input)
    },
    autoResponds() {
      return workspace.autoAccept.enabled()
    },
    isAutoAccepting() {
      return workspace.autoAccept.enabled()
    },
    toggleAutoAccept() {
      workspace.autoAccept.toggle()
    },
    enableAutoAccept() {
      workspace.autoAccept.enable()
    },
    disableAutoAccept() {
      workspace.autoAccept.disable()
    },
    permissionsEnabled: () => workspace.agentAvailable(),
  }

  // SettingsContext value
  const settingsValue = {
    ready: () => true,
    general: {
      showReasoningSummaries: () => true,
      shellToolPartsExpanded: () => false,
      editToolPartsExpanded: () => false,
    },
  }

  // CommandContext value — stub
  const commandValue = {
    ready: () => true,
    register: () => {},
    trigger: () => {},
    keybind: () => "",
    show: () => {},
    keybinds: () => {},
    suspended: () => false,
    get catalog() {
      return []
    },
    get options() {
      return []
    },
  }

  // LayoutContext value — reuse DeviceLayoutProvider's
  // Already provided by DeviceInterface

  const composer = createDeviceSessionComposerState({
    sessionID: currentSessionID,
    todos: () => {
      const cid = currentSessionID()
      return cid ? (store.data.todos[cid] ?? []) : []
    },
    isAutoAccepting: () => workspace.autoAccept.enabled(),
    enableAutoAccept: () => workspace.autoAccept.enable(),
  })

  const [composerMounted, setComposerMounted] = createSignal(true)
  createEffect(() => {
    const id = currentSessionID()
    void id
    setComposerMounted(false)
    const frame = requestAnimationFrame(() => setComposerMounted(true))
    onCleanup(() => cancelAnimationFrame(frame))
  })

  const [snap, setSnap] = createSignal(true)

  const done = createMemo(() => {
    const id = currentSessionID()
    if (!id) return false
    if (viewingSessionID()) return phase[id] === "ready" || phase[id] === "error"
    return store.data.session?.id === id && !store.historyLoading(id)
  })

  const ready = createMemo(() => {
    const id = currentSessionID()
    if (!id) return false
    if (viewingSessionID()) return phase[id] === "ready"
    return store.data.session?.id === id && !store.historyLoading(id)
  })

  const autoScroll = createAutoScroll({
    working: () => snap() || effectiveStatus()?.type === "busy",
    overflowAnchor: "dynamic",
  })

  const scrollSpy = createScrollSpy({
    onActive: () => {},
  })

  let scroller: HTMLDivElement | undefined
  let content: HTMLDivElement | undefined
  let promptDock: HTMLDivElement | undefined
  let dockHeight = 0

  const messages = createMemo(() => effectiveMessages())
  const messagesReady = createMemo(() => true)

  const enrichedMessages = createMemo(() => {
    const raw = effectiveMessages()
    if (!raw || raw.length === 0) return raw ?? []
    const parts = effectiveParts()
    const userIDs = new Set<string>()
    for (const m of raw) {
      if (m.role === "user") userIDs.add(m.id)
    }
    let orphanID: string | undefined
    let orphanCreated = false
    const orphan = {
      id: "",
      sessionID: currentSessionID() ?? "",
      role: "user",
      time: { created: 0 },
    } as any
    const enriched: any[] = []
    for (const m of raw) {
      if (m.role === "assistant" && m.parentID && !userIDs.has(m.parentID)) {
        if (!orphanCreated) {
          orphan.id = m.parentID
          orphan.time = { created: m.time?.created ?? 0 }
          orphanID = m.parentID
          enriched.push(orphan)
          userIDs.add(m.parentID)
          orphanCreated = true
        }
        if (m.parentID !== orphanID) {
          enriched.push({ ...m, parentID: orphanID })
          continue
        }
      }
      if (m.role === "user" && !parts[m.id]?.length) continue
      enriched.push(m)
    }
    return enriched
  })

  createEffect(on(currentSessionID, () => setSnap(true), { defer: true }))

  createEffect(() => {
    if (!snap()) return
    if (!scroller) return
    if (!done()) return
    if (snapFrame !== undefined) cancelAnimationFrame(snapFrame)
    snapFrame = requestAnimationFrame(() => {
      snapFrame = undefined
      if (ready()) resumeScroll()
      setSnap(false)
    })
  })

  const userMessages = createMemo(
    () => enrichedMessages().filter((m) => m.role === "user") as any[],
    emptyMessages as any[],
  )

  const setScrollRef = (el: HTMLDivElement | undefined) => {
    scroller = el
    autoScroll.scrollRef(el)
    scrollSpy.setContainer(el)
  }

  const resumeScroll = () => {
    autoScroll.forceScrollToBottom()
  }

  createResizeObserver(
    () => promptDock,
    ({ height }) => {
      const next = Math.ceil(height)
      if (next === dockHeight) return
      const el = scroller
      const delta = next - dockHeight
      const stick = el
        ? snap() ||
          !autoScroll.userScrolled() ||
          el.scrollHeight - el.clientHeight - el.scrollTop < 10 + Math.max(0, delta)
        : false
      dockHeight = next
      if (stick) autoScroll.forceScrollToBottom()
    },
  )

  const anchor = (id: string) => `message-${id}`

  const childStore = createMemo(() => {
    const result = {
      project: "",
      projectMeta: undefined as any,
      icon: undefined as string | undefined,
      provider: workspace.data.provider,
      agent: workspace.data.agent,
      agentRuntimes: [] as unknown[],
      command: workspace.data.command ?? [],
      path: { directory: device.directory } as Path,
      session: workspace.data.session,
      sessionTotal: workspace.data.sessionTotal,
      session_status: {} as Record<string, SessionStatus>,
      session_diff: {} as Record<string, FileDiff[]>,
      todo: {} as Record<string, Todo[]>,
      permission: {} as Record<string, PermissionRequest[]>,
      question: {} as Record<string, QuestionRequest[]>,
      mcp: {} as Record<string, any>,
      lsp: [] as any[],
      vcs: workspace.data.vcs,
      limit: 50,
      message: {} as Record<string, Message[]>,
      part: {} as Record<string, Part[]>,
      partProgress: {} as Record<string, string[]>,
    }
    return result
  })

  const globalSyncValue = {
    data: { ready: true, error: undefined as string | undefined, project: [] as any[] },
    set: () => {},
    get ready() {
      return true
    },
    get error() {
      return undefined
    },
    child: (_dir?: string) => [childStore(), () => {}] as const,
    bootstrap: async () => {},
    project: {
      loadSessions: async () => {},
      meta: () => {},
      icon: () => {},
    },
    todo: { set: () => {} },
  }

  const dataProps = createMemo(() => {
    const cid = currentSessionID()
    const parts = effectiveParts()
    return {
      ...syncData,
      message: { [cid ?? ""]: enrichedMessages(), "": enrichedMessages(), undefined: enrichedMessages() } as Record<
        string,
        Message[]
      >,
      part: { ...parts } as Record<string, Part[]>,
      partProgress: store.data.partProgress,
      provider: legacyProvider(workspace.data.provider),
    }
  })

  return (
    <ConversationAdapterContext.Provider value={adapter() as any}>
      <GlobalSyncContext.Provider value={globalSyncValue as any}>
        <SDKContext.Provider value={sdkValue as any}>
          <SyncContext.Provider value={syncValue as any}>
            <LocalContext.Provider value={localValue as any}>
              <PromptProvider>
                <PromptSeeder seed={props.promptSeed} />
                <CommentsContext.Provider value={commentsValue as any}>
                  <PermissionContext.Provider value={permissionValue as any}>
                    <CommandContext.Provider value={commandValue as any}>
                      <SettingsContext.Provider value={settingsValue as any}>
                        <DataProvider
                          data={dataProps()!}
                          directory={device.directory}
                          onNavigateToSession={(id: string) => {
                            const s = workspace.data.session.find((s) => s.id === id)
                            const name = s?.title ?? id.slice(0, 8)
                            setViewingStack((prev) => [...prev, { id, name }])
                          }}
                          onSessionHref={(id: string) => `#subagent-${id}`}
                        >
                          <FileComponentProvider component={File}>
                            <div class="relative bg-background-base size-full overflow-hidden flex flex-col">
                              <div class="shrink-0 flex items-center gap-0.5 px-3 h-8 border-b bg-background-base z-10">
                                <div class="flex items-center gap-0.5 min-w-0 flex-1 overflow-hidden">
                                  <button
                                    class="text-12-medium flex items-center min-w-0 truncate"
                                    classList={{
                                      "text-text-base": viewingStack().length === 0,
                                      "text-text-weak hover:text-text-base": viewingStack().length > 0,
                                    }}
                                    onClick={() => setViewingStack([])}
                                  >
                                    {tabStore.tabs().find((t) => t.id === props.tabId)?.title ??
                                      language.t("command.session.new")}
                                  </button>
                                  <For each={viewingStack()}>
                                    {(entry, idx) => (
                                      <>
                                        <Icon name="chevron-right" class="size-3 shrink-0 text-text-weak" />
                                        <button
                                          class="text-12-medium min-w-0 truncate"
                                          classList={{
                                            "text-text-base": idx() === viewingStack().length - 1,
                                            "text-text-weak hover:text-text-base": idx() !== viewingStack().length - 1,
                                          }}
                                          onClick={() => setViewingStack((prev) => prev.slice(0, idx() + 1))}
                                        >
                                          {entry.name}
                                        </button>
                                      </>
                                    )}
                                  </For>
                                </div>
                                <Show when={!isNew()}>
                                  <div class="shrink-0 flex items-center gap-0.5 ml-1">
                                    <Show when={autoScroll.userScrolled()}>
                                      <Tooltip value={language.t("session.messages.jumpToLatest")} placement="bottom">
                                        <IconButton
                                          icon="arrow-down-to-line"
                                          variant="ghost"
                                          iconSize="small"
                                          class="size-6 rounded-md"
                                          onClick={resumeScroll}
                                        />
                                      </Tooltip>
                                    </Show>
                                    <Show when={!viewingSessionID() && !isMobile()}>
                                      <Show when={mobileUrl()}>
                                        <Tooltip value={language.t("session.qrcode.title")} placement="bottom">
                                          <IconButton
                                            icon="scan-qr-code"
                                            variant="ghost"
                                            iconSize="small"
                                            class="size-6 rounded-md"
                                            aria-label={language.t("session.qrcode.title")}
                                            onClick={() => {
                                              dialog.show(() => (
                                                <SessionQrCodeContent
                                                  url={mobileUrl()!}
                                                  sessionTitle={
                                                    tabStore.tabs().find((t) => t.id === props.tabId)?.title ??
                                                    language.t("command.session.new")
                                                  }
                                                />
                                              ))
                                            }}
                                          />
                                        </Tooltip>
                                      </Show>
                                      <DropdownMenu gutter={4} placement="bottom-end">
                                        <DropdownMenu.Trigger
                                          as={IconButton}
                                          icon="dot-grid"
                                          variant="ghost"
                                          iconSize="small"
                                          class="size-6 rounded-md"
                                          aria-label={language.t("common.moreOptions")}
                                        />
                                        <DropdownMenu.Portal>
                                          <DropdownMenu.Content style={{ "min-width": "104px" }}>
                                            <DropdownMenu.Item
                                              onSelect={() => {
                                                const sid = rootSessionID()
                                                if (!sid) return
                                                const name =
                                                  workspace.data.session.find((s) => s.id === sid)?.title ??
                                                  language.t("command.session.new")
                                                dialog.show(() => (
                                                  <Dialog title={language.t("session.delete.title")} fit>
                                                    <div class="flex flex-col gap-4 pl-6 pr-2.5 pb-3">
                                                      <div class="flex flex-col gap-1">
                                                        <span class="text-14-regular text-text-strong">
                                                          {language.t("session.delete.confirm", { name })}
                                                        </span>
                                                      </div>
                                                      <div class="flex justify-end gap-2">
                                                        <Button
                                                          variant="ghost"
                                                          size="large"
                                                          onClick={() => dialog.close()}
                                                        >
                                                          {language.t("common.cancel")}
                                                        </Button>
                                                        <Button
                                                          variant="primary"
                                                          size="large"
                                                          onClick={async () => {
                                                            await device.client.conversation.delete(sid).catch(() => {})
                                                            tabStore.close(props.tabId)
                                                            dialog.close()
                                                          }}
                                                        >
                                                          {language.t("session.delete.button")}
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  </Dialog>
                                                ))
                                              }}
                                            >
                                              <DropdownMenu.ItemLabel>
                                                {language.t("common.delete")}
                                              </DropdownMenu.ItemLabel>
                                            </DropdownMenu.Item>
                                          </DropdownMenu.Content>
                                        </DropdownMenu.Portal>
                                      </DropdownMenu>
                                    </Show>
                                  </div>
                                </Show>
                              </div>
                              <div ref={containerRef} class="flex-1 min-h-0 flex flex-col">
                                <div class="@container relative shrink-0 flex flex-col min-h-0 h-full bg-background-stronger flex-1">
                                  <div class="flex-1 min-h-0 overflow-hidden">
                                    <Show
                                      when={!isNew()}
                                      fallback={<NewSessionView worktree="main" onWorktreeChange={() => {}} />}
                                    >
                                      <MessageTimeline
                                        hideHeader
                                        mobileChanges={false}
                                        mobileFallback={<div />}
                                        scroll={{ overflow: false, bottom: true }}
                                        onResumeScroll={resumeScroll}
                                        setScrollRef={setScrollRef}
                                        onScheduleScrollState={() => {}}
                                        onAutoScrollHandleScroll={autoScroll.handleScroll}
                                        onMarkScrollGesture={() => {}}
                                        hasScrollGesture={() => false}
                                        isDesktop={true}
                                        onScrollSpyScroll={scrollSpy.onScroll}
                                        onTurnBackfillScroll={() => {}}
                                        onAutoScrollInteraction={autoScroll.handleInteraction}
                                        centered={true}
                                        setContentRef={(el) => {
                                          content = el
                                          autoScroll.contentRef(el)
                                        }}
                                        turnStart={0}
                                        historyMore={false}
                                        historyLoading={false}
                                        onLoadEarlier={() => {}}
                                        renderedUserMessages={userMessages() as any[]}
                                        anchor={anchor}
                                        onRegisterMessage={scrollSpy.register}
                                        onUnregisterMessage={scrollSpy.unregister}
                                      />
                                    </Show>
                                  </div>

                                  <Show when={workspace.agentAvailable() && composerMounted()}>
                                    <SessionComposerRegion
                                      state={composer}
                                      ready={true}
                                      centered={true}
                                      inputRef={(el: HTMLDivElement) => {
                                        if (!el) return
                                        const handler = () => {
                                          const sid = rootSessionID()
                                          if (sid) workspace.session.clearUnread(sid)
                                        }
                                        el.addEventListener("focusin", handler)
                                        el.addEventListener("pointerdown", handler)
                                      }}
                                      newSessionWorktree="main"
                                      hiddenSeed={() => props.hiddenSeed}
                                      onNewSessionWorktreeReset={() => {}}
                                      onSubmit={() => {
                                        resumeScroll()
                                        const sid = rootSessionID()
                                        if (sid) workspace.session.clearUnread(sid)
                                      }}
                                      onResponseSubmit={resumeScroll}
                                      setPromptDockRef={(el) => {
                                        promptDock = el
                                      }}
                                      hideAttachButton
                                      hidePrompt={!!viewingSessionID()}
                                      working={isWorking()}
                                      busySince={busySince()}
                                    />
                                  </Show>
                                  <Show when={!workspace.agentAvailable()}>
                                    <div class="shrink-0 w-full pb-3 flex justify-center items-center">
                                      <span class="text-12-regular text-text-weak">
                                        {language.t("workspace.device.offline")}
                                      </span>
                                    </div>
                                  </Show>
                                </div>
                              </div>
                            </div>
                          </FileComponentProvider>
                        </DataProvider>
                      </SettingsContext.Provider>
                    </CommandContext.Provider>
                  </PermissionContext.Provider>
                </CommentsContext.Provider>
              </PromptProvider>
            </LocalContext.Provider>
          </SyncContext.Provider>
        </SDKContext.Provider>
      </GlobalSyncContext.Provider>
    </ConversationAdapterContext.Provider>
  )
}
