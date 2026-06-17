// Shared virtual file-tree primitives.
//
// These pure helpers build and normalize a GitHub-style nested directory tree
// from a flat list of slash-delimited paths. They are consumed by:
//   - the capability editor (pages/console/capability-editor-page.tsx) to render
//     the editable plugin/skill workspace tree, and
//   - the store detail "work tree" (pages/store/components/sub-item-tree.tsx) to
//     render a read-only mirror of a plugin's bundled children.
//
// Keep this module side-effect free (no SolidJS, no DOM) so it stays unit-testable.

export type VirtualTreeNode = {
  id: string
  name: string
  kind: "directory" | "file"
  path: string
  iconPath?: string
  children?: VirtualTreeNode[]
}

/**
 * Build a nested directory tree from a flat list of paths.
 *
 * Each path is split on "/"; intermediate segments become `directory` nodes and
 * the final segment becomes a `file` node. Paths that share a prefix are merged
 * into the same directory branch. Empty segments (leading/trailing/double
 * slashes) are ignored.
 */
export function buildTreeFromPaths(paths: string[]): VirtualTreeNode[] {
  const root: VirtualTreeNode[] = []

  for (const fullPath of paths) {
    const parts = fullPath.split("/").filter(Boolean)
    let currentLevel = root
    let currentPath = ""

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLast = i === parts.length - 1
      let existing = currentLevel.find((node) => node.path === currentPath)

      if (!existing) {
        existing = {
          id: currentPath,
          name: part,
          kind: isLast ? "file" : "directory",
          path: currentPath,
          iconPath: isLast ? part : undefined,
          children: isLast ? undefined : [],
        }
        currentLevel.push(existing)
      }

      if (existing.kind === "directory") {
        existing.children ??= []
        currentLevel = existing.children
      }
    }
  }

  return root
}

/**
 * Stable-sort a tree (directories first, then natural-locale by name) and drop
 * duplicate paths. Returns a new tree; the input is not mutated.
 */
export function dedupeTreeNodes(nodes: VirtualTreeNode[]): VirtualTreeNode[] {
  const seen = new Set<string>()

  const sortNodes = (items: VirtualTreeNode[]) =>
    [...items].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    })

  const visit = (items: VirtualTreeNode[]): VirtualTreeNode[] => {
    const result: VirtualTreeNode[] = []
    for (const node of sortNodes(items)) {
      if (seen.has(node.path)) continue
      seen.add(node.path)
      result.push({
        ...node,
        children: node.children ? visit(node.children) : node.children,
      })
    }
    return result
  }

  return visit(nodes)
}
