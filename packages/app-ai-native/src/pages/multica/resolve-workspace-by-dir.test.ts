import { describe, expect, test } from "bun:test"
import { pickLandingWorkspaceId, resolveWorkspaceByWorkDir } from "./resolve-workspace-by-dir"
import type { Workspace } from "@/pages/workspace/types"

function ws(id: string, paths: string[], isDefault = false): Workspace {
  return {
    id,
    name: id,
    userId: "u",
    isDefault,
    status: "active",
    directories: paths.map((path, i) => ({
      id: `${id}-d${i}`,
      workspaceId: id,
      name: `d${i}`,
      path,
      isDefault: i === 0,
      orderIndex: i,
      createdAt: "",
      updatedAt: "",
    })),
    createdAt: "",
    updatedAt: "",
  }
}

describe("resolveWorkspaceByWorkDir", () => {
  test("exact directory match", () => {
    const workspaces = [ws("w1", ["/home/user/proj"])]
    expect(resolveWorkspaceByWorkDir(workspaces, "/home/user/proj")).toBe("w1")
  })

  test("session ran in a subdirectory of a workspace directory", () => {
    const workspaces = [ws("w1", ["/home/user/proj"])]
    expect(resolveWorkspaceByWorkDir(workspaces, "/home/user/proj/packages/app")).toBe("w1")
  })

  test("longest prefix wins when directories nest", () => {
    const workspaces = [ws("root", ["/home/user"]), ws("nested", ["/home/user/proj"])]
    expect(resolveWorkspaceByWorkDir(workspaces, "/home/user/proj/sub")).toBe("nested")
  })

  test("trailing slashes are ignored", () => {
    const workspaces = [ws("w1", ["/home/user/proj/"])]
    expect(resolveWorkspaceByWorkDir(workspaces, "/home/user/proj")).toBe("w1")
  })

  test("does not match a sibling with a shared name prefix", () => {
    const workspaces = [ws("w1", ["/home/user/foo"])]
    expect(resolveWorkspaceByWorkDir(workspaces, "/home/user/foobar")).toBeUndefined()
  })

  test("returns undefined when nothing matches", () => {
    const workspaces = [ws("w1", ["/home/user/proj"])]
    expect(resolveWorkspaceByWorkDir(workspaces, "/var/other")).toBeUndefined()
  })

  test("returns undefined for empty workDir", () => {
    const workspaces = [ws("w1", ["/home/user/proj"])]
    expect(resolveWorkspaceByWorkDir(workspaces, "")).toBeUndefined()
  })

  test("handles workspaces without directories", () => {
    const bare: Workspace = {
      id: "empty",
      name: "empty",
      userId: "u",
      isDefault: false,
      status: "active",
      createdAt: "",
      updatedAt: "",
    }
    expect(resolveWorkspaceByWorkDir([bare], "/home/user/proj")).toBeUndefined()
  })
})

describe("pickLandingWorkspaceId", () => {
  test("prefers the workspace owning workDir", () => {
    const workspaces = [ws("def", ["/other"], true), ws("owner", ["/home/user/proj"])]
    expect(pickLandingWorkspaceId(workspaces, "/home/user/proj/sub")).toBe("owner")
  })

  test("falls back to the default workspace when workDir does not match", () => {
    const workspaces = [ws("a", ["/x"]), ws("def", ["/y"], true)]
    expect(pickLandingWorkspaceId(workspaces, "/home/user/isolated/workdir")).toBe("def")
  })

  test("falls back to the default workspace when workDir is absent", () => {
    const workspaces = [ws("a", ["/x"]), ws("def", ["/y"], true)]
    expect(pickLandingWorkspaceId(workspaces)).toBe("def")
  })

  test("falls back to the first workspace when none is default", () => {
    const workspaces = [ws("first", ["/x"]), ws("second", ["/y"])]
    expect(pickLandingWorkspaceId(workspaces, "/no/match")).toBe("first")
  })

  test("returns undefined when there are no workspaces", () => {
    expect(pickLandingWorkspaceId([], "/home/user/proj")).toBeUndefined()
  })
})
