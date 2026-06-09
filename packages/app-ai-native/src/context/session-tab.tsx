import { createContext, createEffect, createMemo, createSignal, onCleanup, useContext, type ParentProps } from "solid-js"
import { useContentTabs } from "@/context/content-tabs"
import { useDeviceWorkspace } from "@/context/device-workspace"
import type { Session } from "@opencode-ai/sdk/v2/client"

type SessionTabValue = {
  tabId: string
  createdSessionID: () => string | undefined
  setCreatedSessionID: (id: string | undefined) => void
  isNew: () => boolean
  rootSessionID: () => string | undefined
  replaceTab: (input: { sessionID: string; title?: string }) => void
}

const SessionTabContext = createContext<SessionTabValue>()

export function useSessionTab() {
  const ctx = useContext(SessionTabContext)
  if (!ctx) throw new Error("useSessionTab must be used within SessionTabProvider")
  return ctx
}

export function SessionTabProvider(props: ParentProps<{ tabId: string; sessionID?: string }>) {
  const tabStore = useContentTabs()
  const workspace = useDeviceWorkspace()

  const [createdSessionID, setCreatedSessionID] = createSignal<string | undefined>()

  const isNew = createMemo(() => !createdSessionID() && !props.sessionID)
  const rootSessionID = createMemo(() => createdSessionID() ?? props.sessionID)

  const replaceTab = (input: { sessionID: string; title?: string }) => {
    if (!createdSessionID() && !props.sessionID) {
      setCreatedSessionID(input.sessionID)
    }
    const current = tabStore.tabs().find((t) => t.id === props.tabId)
    if (current && !(current.meta as any)?.sessionID) {
      tabStore.updateMeta(props.tabId, { sessionID: input.sessionID })
      if (input.title) tabStore.setTitle(props.tabId, input.title)
    }
  }

  const unsubscribe = workspace.subscribe((payload) => {
    if (payload.type === "session.created") {
      const info = (payload.properties as { info?: Session })?.info ?? (payload.properties as Session)
      if (info?.id) {
        const current = tabStore.tabs().find((t) => t.id === props.tabId)
        if (current && (current.meta as any)?.sessionID === info.id && info.title) {
          tabStore.setTitle(props.tabId, info.title)
        }
      }
    }
    if (payload.type === "session.updated") {
      const info = (payload.properties as { info?: Session })?.info ?? (payload.properties as Session)
      const cid = rootSessionID()
      if (info?.id === cid && info.title) {
        tabStore.setTitle(props.tabId, info.title)
      }
    }
  })
  onCleanup(() => unsubscribe())

  const value: SessionTabValue = {
    tabId: props.tabId,
    createdSessionID,
    setCreatedSessionID,
    isNew,
    rootSessionID,
    replaceTab,
  }

  return <SessionTabContext.Provider value={value}>{props.children}</SessionTabContext.Provider>
}
