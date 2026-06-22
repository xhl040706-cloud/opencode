import { createMemo, createSignal, For, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { buildTreeFromPaths, dedupeTreeNodes, type VirtualTreeNode } from "@/lib/virtual-tree"
import type { CapabilityItem } from "../lib/api"
import { TYPE_META } from "./item-detail-content"

// A plugin's "work tree": the flat list of bundled child items (skills, evaluators,
// commands, agents, rules, templates, MCP servers) rendered as a GitHub-style nested
// directory tree keyed off each child's `sourcePath`. Read-only; leaves link to the
// child's detail page. The backend returns `sourcePath` verbatim (api.ts CapabilityItem),
// so no extra fetch is needed — see research/frontend-tree.md.

/**
 * Resolve the tree path for a bundled child item.
 *
 * - MCP children carry a synthetic `sourcePath` of `<path>#<key>` (e.g.
 *   `.mcp.json#github`); the real on-disk path is the part before `#`, and the
 *   key becomes the leaf name. We normalize to `<path>/<key>` so the MCP server
 *   appears as a leaf under its config file.
 * - Items without a `sourcePath` (legacy/incomplete data) fall back to
 *   `<itemType>s/<slug|id>/SKILL.md`, mirroring the editor's fallback so the tree
 *   never collapses to a single anonymous node.
 */
export function resolveSubItemPath(item: Pick<CapabilityItem, "itemType" | "sourcePath" | "slug" | "id">): string {
  const raw = item.sourcePath?.trim()
  if (raw) {
    const hashIndex = raw.indexOf("#")
    if (hashIndex >= 0) {
      const base = raw.slice(0, hashIndex)
      const key = raw.slice(hashIndex + 1)
      if (base && key) return `${base}/${key}`
      if (base) return base
    }
    return raw
  }
  return `${item.itemType}s/${item.slug || item.id}/SKILL.md`
}

export type SubItemTreeResult = {
  nodes: VirtualTreeNode[]
  /** path → child item, for the leaves only (directories have no backing item). */
  itemByPath: Record<string, CapabilityItem>
}

/**
 * Pure builder: turn a flat list of bundled children into a deduped, sorted
 * nested tree plus a path→item lookup for the leaves. Exported for unit testing.
 */
export function buildSubItemTree(items: CapabilityItem[]): SubItemTreeResult {
  const itemByPath: Record<string, CapabilityItem> = {}
  const paths: string[] = []
  for (const item of items) {
    const path = resolveSubItemPath(item)
    // First writer wins on path collision; record the path once for tree-building.
    if (itemByPath[path] === undefined) {
      itemByPath[path] = item
      paths.push(path)
    }
  }
  return { nodes: dedupeTreeNodes(buildTreeFromPaths(paths)), itemByPath }
}

function SubItemTreeNodes(props: {
  nodes: VirtualTreeNode[]
  itemByPath: Record<string, CapabilityItem>
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
  onSelect: (itemId: string) => void
  level?: number
}) {
  const level = () => props.level ?? 0

  return (
    <div class="min-w-0">
      <For each={props.nodes}>
        {(node) => {
          const isDirectory = () => node.kind === "directory"
          const isExpanded = () => props.expanded[node.path] ?? true
          const childItem = () => props.itemByPath[node.path]
          const leafMeta = () => {
            const it = childItem()
            return (it && TYPE_META[it.itemType]) ?? TYPE_META.skill
          }
          const rowPaddingLeft = () => `${8 + level() * 12}px`

          return (
            <div>
              <button
                type="button"
                onClick={() => {
                  if (isDirectory()) {
                    props.onToggle(node.path)
                    return
                  }
                  const it = childItem()
                  if (it) props.onSelect(it.id)
                }}
                class="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-[var(--native-radius-md)] px-1.5 text-left text-[13px] transition-colors hover:bg-bg-muted/50"
                style={{ "padding-left": rowPaddingLeft() }}
                title={node.name}
              >
                <Show
                  when={isDirectory()}
                  fallback={
                    <div
                      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.375rem]"
                      style={{ "background-color": leafMeta().bg, color: leafMeta().accent }}
                    >
                      <Icon name={leafMeta().icon} size="small" />
                    </div>
                  }
                >
                  <span class="flex w-4 shrink-0 items-center justify-center text-[var(--native-muted)]">
                    <Icon name={isExpanded() ? "chevron-down" : "chevron-right"} size="small" />
                  </span>
                  <Icon name="folder" size="small" class="shrink-0 text-[var(--native-muted)]" />
                </Show>

                <span
                  classList={{
                    "min-w-0 flex-1 truncate": true,
                    "font-semibold text-text-strong": !isDirectory(),
                    "text-text-weak": isDirectory(),
                  }}
                >
                  {node.name}
                </span>

                <Show when={!isDirectory()}>
                  <Icon name="chevron-right" size="small" class="shrink-0 text-[var(--native-muted)]" />
                </Show>
              </button>

              <Show when={isDirectory() && isExpanded() && node.children?.length}>
                <SubItemTreeNodes
                  nodes={node.children ?? []}
                  itemByPath={props.itemByPath}
                  expanded={props.expanded}
                  onToggle={props.onToggle}
                  onSelect={props.onSelect}
                  level={level() + 1}
                />
              </Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}

export function SubItemTree(props: { items: CapabilityItem[]; onSelect: (itemId: string) => void }) {
  // Memoized so the tree is built once per items change, not twice per render
  // (nodes + itemByPath are both read in the JSX below).
  const tree = createMemo(() => buildSubItemTree(props.items))
  const [collapsed, setCollapsed] = createSignal<Record<string, boolean>>({})
  const expanded = () => {
    // Default every directory to expanded; only paths explicitly collapsed flip to false.
    const out: Record<string, boolean> = {}
    for (const [path, isCollapsed] of Object.entries(collapsed())) {
      out[path] = !isCollapsed
    }
    return out
  }
  const toggle = (path: string) => {
    setCollapsed((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  return (
    <SubItemTreeNodes
      nodes={tree().nodes}
      itemByPath={tree().itemByPath}
      expanded={expanded()}
      onToggle={toggle}
      onSelect={props.onSelect}
    />
  )
}
