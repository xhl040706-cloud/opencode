import { describe, expect, test } from "bun:test"
import { resolveWorkspaceByWorkDir } from "./resolve-workspace-by-dir"
import type { Workspace } from "@/pages/workspace/types"

function ws(id: string, paths: string[]): Workspace {
  return {
    id,
    name: id,
    userId: "u",
    isDefault: false,
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
