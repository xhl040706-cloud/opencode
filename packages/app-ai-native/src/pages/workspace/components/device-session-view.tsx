import { Show, createMemo, createSignal, createEffect, on, onCleanup, batch, type JSX } from "solid-js"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { createStore, produce } from "solid-js/store"
import { createAutoScroll } from "@opencode-ai/ui/hooks"
import { DataProvider } from "@opencode-ai/ui/context"
import { FileComponentProvider } from "@opencode-ai/ui/context/file"
import { File } from "@opencode-ai/ui/file"
import { useDeviceSDK } from "@/context/device-sdk"
import { useDeviceWorkspace } from "@/context/device-workspace"
import { useDeviceSessionStore } from "@/context/device-session"
import { useDeviceLocal } from "@/context/device-local"
import { useLanguage } from "@/context/language"
import { PromptProvider, usePrompt } from "@/context/prompt"

import { NewSessionView } from "@/components/session/session-new-view"
import { MessageTimeline } from "@/pages/session/message-timeline"
import { SessionComposerRegion } from "@/pages/session/composer/session-composer-region"
import { createDeviceSessionComposerState } from "@/pages/session/composer/device-session-composer-state"
import { createScrollSpy } from "@/pages/session/scroll-spy"
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
  PermissionRequest,
  QuestionRequest,
} from "@opencode-ai/sdk/v2/client"
import type { Project, Path } from "@opencode-ai/sdk/v2/client"
import type { ProviderCapabilitiesResponse } from "@/context/global-sync/types"
import { legacyProvider } from "@/utils/legacy-provider"
import { DeviceSessionViewHeader, type HeaderState } from "./device-session-view-header"
import { env } from "@/lib/env"

const emptyMessages: Message[] = []
const busySinceMap = new Map<string, number>()

// One-shot prompt seeder: prefills the composer with a fixed prefix (e.g.
// `/skill-writer `) once the device's model + agent are ready, placing the
// cursor at the end so the user just types their request and presses Enter.
// Opt-in via `DeviceSessionView`'s `promptSeed` prop; never auto-sends, so it
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

export function DeviceSessionView(props: {
  sessionID?: string
  createdSessionID?: () => string | undefined
  title?: () => string | undefined
  promptSeed?: string
  hiddenSeed?: string
  onSessionCreated?: (input: { sessionID: string; title?: string }) => void
  onClose?: () => void
  header?: (state: HeaderState) => JSX.Element
}) {
  const device = useDeviceSDK()
  const workspace = useDeviceWorkspace()
  const store = useDeviceSessionStore()
  const local = useDeviceLocal()
  const language = useLanguage()

  let snapFrame: number | undefined

  const sid = createMemo(() => props.createdSessionID?.() ?? props.sessionID)

  const [viewingStack, setViewingStack] = createSignal<{ id: string; name: string }[]>([])

  local.setOnSessionCreated((input) => queueMicrotask(() => props.onSessionCreated?.(input)))
  local.setNavigateBack(() => setViewingStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev)))
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

  const isNew = createMemo(() => !props.createdSessionID?.() && !props.sessionID)

  const rootSessionID = sid

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
    return !!workspace.data.session.find((s) => s.id === id) && !store.historyLoading(id)
  })

  const ready = createMemo(() => {
    const id = currentSessionID()
    if (!id) return false
    if (viewingSessionID()) return phase[id] === "ready"
    return !!workspace.data.session.find((s) => s.id === id) && !store.historyLoading(id)
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

  const dataProps = createMemo(() => {
    const cid = currentSessionID()
    const parts = effectiveParts()
    const status = workspace.data.status
    return {
      status: (status === "unavailable" || status === "loading" ? "loading" : "complete") as "complete" | "loading",
      agent: workspace.data.agent,
      agentRuntimes: [] as unknown[],
      command: workspace.data.command,
      project: "",
      projectMeta: undefined as any,
      icon: undefined as string | undefined,
      provider: legacyProvider(workspace.data.provider),
      path: { directory: device.directory } as Path,
      session: workspace.data.session,
      sessionTotal: workspace.data.sessionTotal,
      session_status: {
        ...workspace.data.sessionStatus,
        ...(cid ? { [cid]: effectiveStatus() } : {}),
        "": effectiveStatus(),
        undefined: effectiveStatus(),
      } as Record<string, SessionStatus>,
      session_diff: {} as Record<string, FileDiff[]>,
      todo: { [cid ?? ""]: store.data.todos[cid ?? ""] ?? [] } as Record<string, Todo[]>,
      permission: workspace.data.permissions,
      question: workspace.data.questions,
      mcp: {} as Record<string, any>,
      lsp: [] as any[],
      vcs: workspace.data.vcs,
      limit: 50,
      message: { [cid ?? ""]: enrichedMessages(), "": enrichedMessages(), undefined: enrichedMessages() } as Record<
        string,
        Message[]
      >,
      part: { ...parts } as Record<string, Part[]>,
      partProgress: store.data.partProgress,
    }
  })

  const headerState: HeaderState = {
    viewingStack,
    setViewingStack,
    isNew,
    userScrolled: () => autoScroll.userScrolled(),
    resumeScroll,
    rootSessionID,
    mobileUrl,
    viewingSessionID,
    title: () => props.title?.(),
    onClose: () => props.onClose?.(),
  }

  return (
        <PromptProvider>
            <PromptSeeder seed={props.promptSeed} />
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
                              {props.header ? props.header(headerState) : <DeviceSessionViewHeader state={headerState} />}
                              <div ref={containerRef} class="flex-1 min-h-0 flex flex-col">
                                <div class="@container relative shrink-0 flex flex-col min-h-0 h-full bg-background-stronger flex-1">
                                  <div class="flex-1 min-h-0 overflow-hidden">
                                    <Show
                                      when={!isNew()}
                                      fallback={<NewSessionView />}
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
                  </PromptProvider>
  )
}
