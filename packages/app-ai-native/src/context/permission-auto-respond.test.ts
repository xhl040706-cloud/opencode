import { describe, expect, test } from "bun:test"
import type { PermissionRequest, Session } from "@opencode-ai/sdk/v2/client"
import { autoRespondsPermission } from "./permission-auto-respond"

const session = (input: { id: string; parentID?: string }) =>
  ({
    id: input.id,
    parentID: input.parentID,
  }) as Session

const permission = (sessionID: string) =>
  ({
    sessionID,
  }) as Pick<PermissionRequest, "sessionID">

describe("autoRespondsPermission", () => {
  test("uses a parent session's workspace-scoped auto-accept", () => {
    const workspaceId = "ws-1"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${workspaceId}/root`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), workspaceId)).toBe(true)
  })

  test("uses a parent session's legacy auto-accept key", () => {
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]

    expect(autoRespondsPermission({ root: true }, sessions, permission("child"), "ws-1")).toBe(true)
  })

  test("defaults to requiring approval when no lineage override exists", () => {
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" }), session({ id: "other" })]
    const autoAccept = {
      other: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), "ws-1")).toBe(false)
  })

  test("inherits a parent session's false override", () => {
    const workspaceId = "ws-1"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${workspaceId}/root`]: false,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), workspaceId)).toBe(false)
  })

  test("prefers a child override over parent override", () => {
    const workspaceId = "ws-1"
    const sessions = [session({ id: "root" }), session({ id: "child", parentID: "root" })]
    const autoAccept = {
      [`${workspaceId}/root`]: false,
      [`${workspaceId}/child`]: true,
    }

    expect(autoRespondsPermission(autoAccept, sessions, permission("child"), workspaceId)).toBe(true)
  })
})
