import type { ContentTab } from "@/context/content-tabs"

export function activeSession(tabs: ContentTab[], id: string | undefined) {
  const tab = tabs.find((item) => item.id === id)
  if (tab?.kind !== "session") return
  return tab.meta.sessionID as string | undefined
}

export function shouldRestore(sid: string | undefined, done: string | undefined) {
  if (!sid) return false
  return sid !== done
}

/**
 * Decide which session tabs are stale and should be closed.
 *
 * A session tab is stale when its session is no longer in the workspace's
 * (directory-scoped) live session list and it isn't a freshly-created pending
 * session. The `pinnedSessionId` (the session the URL currently points at) is
 * NEVER pruned: a session opened by deep-link can legitimately live in a
 * directory outside this workspace (e.g. an agent's isolated work dir), so it
 * won't appear in the live list — closing it would drop the session the user
 * is actively viewing and reset the URL.
 */
export function sessionTabsToClose(
  tabs: ContentTab[],
  liveSessionIds: Set<string>,
  pinnedSessionId: string | undefined,
  isPending: (sessionId: string) => boolean,
): string[] {
  return tabs
    .filter((tab) => {
      if (tab.kind !== "session") return false
      const sid = tab.meta?.sessionID as string | undefined
      if (!sid) return false
      if (sid === pinnedSessionId) return false
      if (liveSessionIds.has(sid)) return false
      if (isPending(sid)) return false
      return true
    })
    .map((tab) => tab.id)
}