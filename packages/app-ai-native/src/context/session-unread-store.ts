import { createStore, produce } from "solid-js/store"
import { createSignal } from "solid-js"

const [unreadMap, setUnreadMap] = createStore<Record<string, boolean>>({})

const [version, setVersion] = createSignal(0)

export function markSessionUnread(sessionId: string) {
  if (unreadMap[sessionId]) return
  setUnreadMap(sessionId, true)
  setVersion((v) => v + 1)
}

export function clearSessionUnread(sessionId: string) {
  if (!unreadMap[sessionId]) return
  setUnreadMap(produce((draft) => { delete draft[sessionId] }))
  setVersion((v) => v + 1)
}

export function isSessionUnread(sessionId: string): boolean {
  return !!unreadMap[sessionId]
}

export function unreadVersion(): number {
  return version()
}
