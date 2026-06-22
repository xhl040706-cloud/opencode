import { beforeAll, describe, expect, mock, test } from "bun:test"
import type { CapabilityItem } from "../lib/api"

let resolveSubItemPath: typeof import("./sub-item-tree").resolveSubItemPath
let buildSubItemTree: typeof import("./sub-item-tree").buildSubItemTree

beforeAll(async () => {
  // sub-item-tree.tsx imports TYPE_META from item-detail-content.tsx, which transitively
  // pulls in heavy editor/markdown deps. The pure helpers under test don't use TYPE_META,
  // so we stub the module to keep this a fast, dependency-free unit test.
  mock.module("./item-detail-content", () => ({ TYPE_META: {} }))
  mock.module("@opencode-ai/ui/icon", () => ({ Icon: () => null }))
  const mod = await import("./sub-item-tree")
  resolveSubItemPath = mod.resolveSubItemPath
  buildSubItemTree = mod.buildSubItemTree
})

const makeItem = (over: Partial<CapabilityItem>): CapabilityItem =>
  ({
    id: over.id ?? "id-" + (over.slug ?? over.itemType ?? "x"),
    registryId: "reg",
    slug: over.slug ?? "slug",
    itemType: over.itemType ?? "skill",
    name: over.name ?? "Item",
    description: "",
    category: "",
    version: "1",
    content: "",
    visibility: "public",
    status: "active",
    createdBy: "u",
    ...over,
  }) as CapabilityItem

describe("resolveSubItemPath", () => {
  test("uses sourcePath verbatim for normal files", () => {
    expect(resolveSubItemPath({ itemType: "rule", sourcePath: "rules/dfx/安全.md", slug: "s", id: "i" })).toBe(
      "rules/dfx/安全.md",
    )
  })

  test("normalizes MCP `<path>#<key>` to `<path>/<key>`", () => {
    expect(resolveSubItemPath({ itemType: "mcp", sourcePath: ".mcp.json#github", slug: "s", id: "i" })).toBe(
      ".mcp.json/github",
    )
  })

  test("keeps base path when MCP key is empty", () => {
    expect(resolveSubItemPath({ itemType: "mcp", sourcePath: ".mcp.json#", slug: "s", id: "i" })).toBe(".mcp.json")
  })

  test("falls back to <type>s/<slug>/SKILL.md when sourcePath is missing", () => {
    expect(resolveSubItemPath({ itemType: "template", sourcePath: undefined, slug: "design", id: "i" })).toBe(
      "templates/design/SKILL.md",
    )
  })

  test("falls back to id when slug is empty", () => {
    expect(resolveSubItemPath({ itemType: "skill", sourcePath: "", slug: "", id: "abc123" })).toBe(
      "skills/abc123/SKILL.md",
    )
  })
})

describe("buildSubItemTree", () => {
  test("builds a nested tree and maps leaf paths back to items", () => {
    const items = [
      makeItem({ id: "s1", itemType: "skill", sourcePath: "skills/requirement-analysis/SKILL.md", name: "Req" }),
      makeItem({ id: "r1", itemType: "rule", sourcePath: "rules/dfx/安全.md", name: "Security" }),
      makeItem({ id: "r2", itemType: "rule", sourcePath: "rules/coding/go.md", name: "Go" }),
      makeItem({ id: "t1", itemType: "template", sourcePath: "templates/x.md", name: "X" }),
      makeItem({ id: "m1", itemType: "mcp", sourcePath: ".mcp.json#github", name: "GitHub MCP" }),
    ]
    const { nodes, itemByPath } = buildSubItemTree(items)

    // top-level dirs sorted alphabetically, .mcp.json file (leading dot) ordering aside
    const names = nodes.map((n) => n.name)
    expect(names).toContain("skills")
    expect(names).toContain("rules")
    expect(names).toContain("templates")

    // rules has two groups (coding, dfx)
    const rules = nodes.find((n) => n.name === "rules")
    expect(rules?.children?.map((c) => c.name).sort()).toEqual(["coding", "dfx"])

    // leaf path → item lookup
    expect(itemByPath["rules/dfx/安全.md"]?.id).toBe("r1")
    expect(itemByPath["templates/x.md"]?.id).toBe("t1")
    // MCP child normalized to a leaf under its config file
    expect(itemByPath[".mcp.json/github"]?.id).toBe("m1")
  })

  test("first writer wins on path collision", () => {
    const items = [
      makeItem({ id: "first", itemType: "skill", sourcePath: "skills/dup/SKILL.md" }),
      makeItem({ id: "second", itemType: "skill", sourcePath: "skills/dup/SKILL.md" }),
    ]
    const { itemByPath } = buildSubItemTree(items)
    expect(itemByPath["skills/dup/SKILL.md"]?.id).toBe("first")
  })

  test("missing sourcePath falls back so the tree never collapses", () => {
    const items = [makeItem({ id: "x", itemType: "command", sourcePath: undefined, slug: "deploy" })]
    const { nodes, itemByPath } = buildSubItemTree(items)
    expect(nodes.find((n) => n.name === "commands")).toBeDefined()
    expect(itemByPath["commands/deploy/SKILL.md"]?.id).toBe("x")
  })
})
