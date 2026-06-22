import { describe, expect, test } from "bun:test"
import { buildTreeFromPaths, dedupeTreeNodes, type VirtualTreeNode } from "./virtual-tree"

const findChild = (nodes: VirtualTreeNode[], name: string): VirtualTreeNode | undefined =>
  nodes.find((n) => n.name === name)

describe("buildTreeFromPaths", () => {
  test("builds a single-file leaf", () => {
    const tree = buildTreeFromPaths(["skills/requirement-analysis/SKILL.md"])
    const skills = findChild(tree, "skills")
    expect(skills?.kind).toBe("directory")
    const skill = findChild(skills?.children ?? [], "requirement-analysis")
    expect(skill?.kind).toBe("directory")
    const file = findChild(skill?.children ?? [], "SKILL.md")
    expect(file?.kind).toBe("file")
    expect(file?.path).toBe("skills/requirement-analysis/SKILL.md")
    expect(file?.iconPath).toBe("SKILL.md")
  })

  test("merges siblings sharing a prefix into one directory branch", () => {
    const tree = buildTreeFromPaths([
      "rules/coding-standards/go-checklist.md",
      "rules/coding-standards/安全.md",
      "rules/dfx/reliability.md",
    ])
    const rules = findChild(tree, "rules")
    expect(rules?.children).toHaveLength(2) // coding-standards + dfx
    const coding = findChild(rules?.children ?? [], "coding-standards")
    expect(coding?.kind).toBe("directory")
    expect(coding?.children).toHaveLength(2)
    // non-ASCII filenames round-trip unchanged
    const security = findChild(coding?.children ?? [], "安全.md")
    expect(security?.kind).toBe("file")
    expect(security?.path).toBe("rules/coding-standards/安全.md")
  })

  test("ignores empty segments from leading/trailing/double slashes", () => {
    const tree = buildTreeFromPaths(["/templates//x.md/"])
    const templates = findChild(tree, "templates")
    expect(templates?.kind).toBe("directory")
    const file = findChild(templates?.children ?? [], "x.md")
    expect(file?.kind).toBe("file")
    expect(file?.path).toBe("templates/x.md")
  })

  test("handles a flat top-level file (no directory)", () => {
    const tree = buildTreeFromPaths([".mcp.json"])
    expect(tree).toHaveLength(1)
    expect(tree[0]?.kind).toBe("file")
    expect(tree[0]?.name).toBe(".mcp.json")
  })
})

describe("dedupeTreeNodes", () => {
  test("sorts directories before files, then natural-locale by name", () => {
    const tree = dedupeTreeNodes(buildTreeFromPaths(["templates/z.md", "skills/a/SKILL.md", "rules/r/r.md", "top.md"]))
    // directories (rules, skills, templates) first — sorted by name — then the file `top.md`
    expect(tree.map((n) => n.name)).toEqual(["rules", "skills", "templates", "top.md"])
    expect(tree.at(-1)?.kind).toBe("file")
  })

  test("numeric segments sort naturally (item2 before item10)", () => {
    const tree = dedupeTreeNodes(buildTreeFromPaths(["commands/item10.md", "commands/item2.md"]))
    const commands = findChild(tree, "commands")
    expect(commands?.children?.map((n) => n.name)).toEqual(["item2.md", "item10.md"])
  })

  test("drops duplicate paths and does not mutate the input", () => {
    const input = buildTreeFromPaths(["rules/a.md", "rules/a.md"])
    const before = JSON.stringify(input)
    const deduped = dedupeTreeNodes(input)
    const rules = findChild(deduped, "rules")
    expect(rules?.children).toHaveLength(1)
    expect(JSON.stringify(input)).toBe(before)
  })
})
