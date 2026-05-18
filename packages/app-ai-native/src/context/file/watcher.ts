import type { FileNode } from "@opencode-ai/sdk/v2"

type WatcherEvent = {
  type: string
  properties: unknown
}

type WatcherOps = {
  normalize: (input: string) => string
  hasFile: (path: string) => boolean
  isOpen?: (path: string) => boolean
  loadFile: (path: string) => void
  node: (path: string) => FileNode | undefined
  isDirLoaded: (path: string) => boolean
  refreshDir: (path: string) => void
}

// cs-cloud host event handler
export function invalidateFromHostWatcher(event: WatcherEvent, ops: WatcherOps) {
  if (!event.type.startsWith("host.file.")) return

  const props =
    typeof event.properties === "object" && event.properties ? (event.properties as Record<string, unknown>) : undefined
  const rawPath = typeof props?.file === "string" ? props.file : undefined
  if (!rawPath) return

  const path = ops.normalize(rawPath)
  if (!path) return
  if (path.startsWith(".git/")) return

  // Handle different cs-cloud event types
  switch (event.type) {
    case "host.file.created":
    case "host.file.updated":
      // Reload file content if it's currently loaded or open
      if (ops.hasFile(path) || ops.isOpen?.(path)) {
        ops.loadFile(path)
      }
      // Refresh parent directory to show new/updated files
      const parent = path.split("/").slice(0, -1).join("/")
      if (parent && ops.isDirLoaded(parent)) {
        ops.refreshDir(parent)
      }
      break

    case "host.file.deleted":
      // Refresh parent directory to remove the deleted file
      const parentDir = path.split("/").slice(0, -1).join("/")
      if (parentDir && ops.isDirLoaded(parentDir)) {
        ops.refreshDir(parentDir)
      }
      break

    case "host.file.renamed":
      // Refresh both old and new parent directories
      const oldParent = path.split("/").slice(0, -1).join("/")
      if (oldParent && ops.isDirLoaded(oldParent)) {
        ops.refreshDir(oldParent)
      }
      // Note: We'd need the new path to refresh its parent, but cs-cloud events
      // currently only provide the old path in 'file' field
      break
  }
}
