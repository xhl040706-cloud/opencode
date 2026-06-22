import { describe, expect, test } from "bun:test"
import { sessionTabsToClose, shouldRestore, activeSession } from "./workspace-content-layout-sync"
import type { ContentTab } from "@/context/content-tabs"

function sessionTab(id: string, sessionID?: string): ContentTab {
  return { id, kind: "session", key: id, title: id, meta: { sessionID } } as ContentTab
}

const never = () => false

describe("sessionTabsToClose", () => {
  test("closes a session tab whose session is not live, not pending, not pinned", () => {
    const tabs = [sessionTab("t1", "s1")]
    expect(sessionTabsToClose(tabs, new Set(), undefined, never)).toEqual(["t1"])
  })

  test("does NOT close the session the URL is pinned to, even if not live", () => {
    const tabs = [sessionTab("t1", "s1")]
    expect(sessionTabsToClose(tabs, new Set(), "s1", never)).toEqual([])
  })

  test("does not close a live session", () => {
    const tabs = [sessionTab("t1", "s1")]
    expect(sessionTabsToClose(tabs, new Set(["s1"]), undefined, never)).toEqual([])
  })

  test("does not close a pending session", () => {
    const tabs = [sessionTab("t1", "s1")]
    expect(sessionTabsToClose(tabs, new Set(), undefined, (sid) => sid === "s1")).toEqual([])
  })

  test("ignores non-session tabs", () => {
    const tabs = [{ id: "f1", kind: "file", key: "f1", title: "f", meta: {} } as ContentTab]
    expect(sessionTabsToClose(tabs, new Set(), undefined, never)).toEqual([])
  })

  test("prunes only the stale ones, keeps live + pinned", () => {
    const tabs = [
      sessionTab("t1", "live"),
      sessionTab("t2", "pinned"),
      sessionTab("t3", "stale"),
    ]
    expect(sessionTabsToClose(tabs, new Set(["live"]), "pinned", never)).toEqual(["t3"])
  })
})

describe("shouldRestore", () => {
  test("true when sid differs from done", () => {
    expect(shouldRestore("s2", "s1")).toBe(true)
  })
  test("false when sid equals done", () => {
    expect(shouldRestore("s1", "s1")).toBe(false)
  })
  test("false for empty sid", () => {
    expect(shouldRestore(undefined, "s1")).toBe(false)
  })
})

describe("activeSession", () => {
  test("returns the sessionID of the active session tab", () => {
    expect(activeSession([sessionTab("t1", "s1")], "t1")).toBe("s1")
  })
  test("returns undefined for a non-session active tab", () => {
    const tabs = [{ id: "f1", kind: "file", key: "f1", title: "f", meta: {} } as ContentTab]
    expect(activeSession(tabs, "f1")).toBeUndefined()
  })
})
