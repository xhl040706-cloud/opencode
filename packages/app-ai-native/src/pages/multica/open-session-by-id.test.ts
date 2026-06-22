import { describe, expect, test } from "bun:test"
import { deriveWorkspaceName, findWorkspaceForDevice, openSessionById } from "./open-session-by-id"
import type { OpenSessionDeps } from "./open-session-by-id"
import type { Device, Workspace } from "@/pages/workspace/types"

function device(id: string, deviceId: string, status: Device["status"] = "online"): Device {
  return {
    id,
    deviceId,
    displayName: id,
    platform: "mac",
    version: "1",
    userId: "u",
    status,
    createdAt: "",
    updatedAt: "",
  }
}

function workspace(id: string, opts: Partial<Workspace> = {}): Workspace {
  return {
    id,
    name: id,
    userId: "u",
    isDefault: false,
    status: "active",
    createdAt: "",
    updatedAt: "",
    ...opts,
  }
}

// Collects the effects of openSessionById for assertions.
function harness(over: Partial<OpenSessionDeps> = {}) {
  const calls = {
    navigated: undefined as { workspaceId: string; sessionId: string } | undefined,
    created: undefined as { name: string; deviceId: string; directory: string } | undefined,
    error: undefined as "not_found" | "failed" | undefined,
  }
  const deps: OpenSessionDeps = {
    listDevices: async () => [],
    probeSession: async () => null,
    listWorkspaces: async () => [],
    createWorkspace: async (input) => {
      calls.created = input
      return "ws-new"
    },
    navigateToSession: (workspaceId, sessionId) => {
      calls.navigated = { workspaceId, sessionId }
    },
    onError: (reason) => {
      calls.error = reason
    },
    ...over,
  }
  return { calls, deps }
}

describe("findWorkspaceForDevice", () => {
  test("matches on deviceUniqueId (routing id)", () => {
    const ws = [workspace("w1", { deviceUniqueId: "dev-uniq" })]
    expect(findWorkspaceForDevice(ws, device("db-1", "dev-uniq"))).toBe("w1")
  })

  test("matches on deviceId (db id) as fallback", () => {
    const ws = [workspace("w1", { deviceId: "db-1" })]
    expect(findWorkspaceForDevice(ws, device("db-1", "dev-uniq"))).toBe("w1")
  })

  test("returns undefined when no workspace is on the device", () => {
    const ws = [workspace("w1", { deviceUniqueId: "other" })]
    expect(findWorkspaceForDevice(ws, device("db-1", "dev-uniq"))).toBeUndefined()
  })
})

describe("deriveWorkspaceName", () => {
  test("uses the last path segment", () => {
    expect(deriveWorkspaceName("/Users/x/multica_workspaces/a/b/workdir")).toBe("workdir")
  })
  test("ignores trailing slashes", () => {
    expect(deriveWorkspaceName("/Users/x/proj/")).toBe("proj")
  })
  test("falls back to 'session' for empty input", () => {
    expect(deriveWorkspaceName("")).toBe("session")
  })
})

describe("openSessionById", () => {
  test("navigates to an existing workspace on the owning device", async () => {
    const { calls, deps } = harness({
      listDevices: async () => [device("db-1", "dev-1"), device("db-2", "dev-2")],
      probeSession: async (d) => (d.id === "db-2" ? { directory: "/p/workdir" } : null),
      listWorkspaces: async () => [workspace("w2", { deviceUniqueId: "dev-2" })],
    })
    await openSessionById("sess-1", deps)
    expect(calls.navigated).toEqual({ workspaceId: "w2", sessionId: "sess-1" })
    expect(calls.created).toBeUndefined()
    expect(calls.error).toBeUndefined()
  })

  test("creates a workspace on the owning device when none exists", async () => {
    const { calls, deps } = harness({
      listDevices: async () => [device("db-1", "dev-1")],
      probeSession: async () => ({ directory: "/p/multica_workspaces/x/workdir" }),
      listWorkspaces: async () => [],
    })
    await openSessionById("sess-1", deps)
    expect(calls.created).toEqual({
      name: "workdir",
      deviceId: "db-1",
      directory: "/p/multica_workspaces/x/workdir",
    })
    expect(calls.navigated).toEqual({ workspaceId: "ws-new", sessionId: "sess-1" })
  })

  test("skips offline devices when probing", async () => {
    const probed: string[] = []
    const { calls, deps } = harness({
      listDevices: async () => [device("db-1", "dev-1", "offline"), device("db-2", "dev-2", "online")],
      probeSession: async (d) => {
        probed.push(d.id)
        return d.id === "db-2" ? { directory: "/p/workdir" } : null
      },
      listWorkspaces: async () => [workspace("w2", { deviceUniqueId: "dev-2" })],
    })
    await openSessionById("sess-1", deps)
    expect(probed).toEqual(["db-2"])
    expect(calls.navigated?.workspaceId).toBe("w2")
  })

  test("reports not_found when no device has the session", async () => {
    const { calls, deps } = harness({
      listDevices: async () => [device("db-1", "dev-1")],
      probeSession: async () => null,
    })
    await openSessionById("sess-1", deps)
    expect(calls.error).toBe("not_found")
    expect(calls.navigated).toBeUndefined()
  })

  test("a probe that throws does not abort the search", async () => {
    const { calls, deps } = harness({
      listDevices: async () => [device("db-1", "dev-1"), device("db-2", "dev-2")],
      probeSession: async (d) => {
        if (d.id === "db-1") throw new Error("proxy down")
        return { directory: "/p/workdir" }
      },
      listWorkspaces: async () => [workspace("w2", { deviceUniqueId: "dev-2" })],
    })
    await openSessionById("sess-1", deps)
    expect(calls.navigated?.workspaceId).toBe("w2")
    expect(calls.error).toBeUndefined()
  })

  test("reports failed when device listing throws", async () => {
    const { calls, deps } = harness({
      listDevices: async () => {
        throw new Error("network")
      },
    })
    await openSessionById("sess-1", deps)
    expect(calls.error).toBe("failed")
  })

  test("no-ops on empty session id", async () => {
    const { calls, deps } = harness()
    await openSessionById("", deps)
    expect(calls.error).toBeUndefined()
    expect(calls.navigated).toBeUndefined()
  })
})
