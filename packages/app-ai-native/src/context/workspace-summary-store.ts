import { createStore, produce } from "solid-js/store"
import type { SessionStatus, QuestionRequest, PermissionRequest } from "@opencode-ai/sdk/v2/client"
import { isSessionUnread, unreadVersion } from "./session-unread-store"

export type WorkspaceSummary = {
  branch?: string
  hasActiveSession: boolean
  hasPendingInteraction: boolean
  hasUnreadSession: boolean
}

const [summaries, setSummaries] = createStore<Record<string, WorkspaceSummary>>({})

export function useWorkspaceSummary(id: string) {
  return () => summaries[id]
}

export function syncSummary(
  id: string,
  data: {
    vcs?: { branch?: string } | undefined
    sessionStatus: Record<string, SessionStatus>
    questions: Record<string, QuestionRequest[]>
    permissions: Record<string, PermissionRequest[]>
    sessionIds?: string[]
  },
) {
  const hasActiveSession = Object.values(data.sessionStatus).some(
    (s) => s.type === "busy" || s.type === "retry",
  )
  const hasPendingInteraction =
    Object.values(data.questions).some((q) => q.length > 0) ||
    Object.values(data.permissions).some((p) => p.length > 0)
  unreadVersion()
  const ids = data.sessionIds ?? Object.keys(data.sessionStatus)
  const hasUnreadSession = ids.some((sid) => isSessionUnread(sid))
  const next = {
    branch: data.vcs?.branch,
    hasActiveSession,
    hasPendingInteraction,
    hasUnreadSession,
  }
  const prev = summaries[id]
  if (prev && prev.branch === next.branch && prev.hasActiveSession === next.hasActiveSession && prev.hasPendingInteraction === next.hasPendingInteraction && prev.hasUnreadSession === next.hasUnreadSession) return
  setSummaries(id, next)
}

export function clearSummary(id: string) {
  setSummaries(produce((draft) => { delete draft[id] }))
}
