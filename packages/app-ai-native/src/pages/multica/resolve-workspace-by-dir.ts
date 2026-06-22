import type { Workspace } from "@/pages/workspace/types"

/**
 * Resolve which workspace owns a csc working directory.
 *
 * multica reports the absolute `workDir` a csc session ran in. A CoStrict
 * workspace owns one or more directories; a session belongs to the workspace
 * whose directory path is the longest prefix of `workDir` (so a session that
 * ran in a subdirectory or git worktree under a workspace directory still
 * resolves). Exact matches win naturally because they are the longest prefix.
 *
 * Returns the workspace id, or undefined when no directory matches.
 */
export function resolveWorkspaceByWorkDir(
  workspaces: Workspace[],
  workDir: string,
): string | undefined {
  const target = normalize(workDir)
  if (!target) return undefined

  let bestId: string | undefined
  let bestLen = -1

  for (const ws of workspaces) {
    for (const dir of ws.directories ?? []) {
      const base = normalize(dir.path)
      if (!base) continue
      if (isPrefixDir(base, target) && base.length > bestLen) {
        bestLen = base.length
        bestId = ws.id
      }
    }
  }

  return bestId
}

/** Strip trailing slashes so prefix comparison is boundary-accurate. */
function normalize(path: string): string {
  return (path ?? "").replace(/[/\\]+$/, "")
}

/**
 * True when `base` is `target` itself or a parent directory of `target`.
 * The trailing-separator check prevents `/a/foo` from matching `/a/foobar`.
 */
function isPrefixDir(base: string, target: string): boolean {
  if (base === target) return true
  return target.startsWith(base + "/") || target.startsWith(base + "\\")
}

/**
 * Pick the workspace to land in when opening a csc session by id.
 *
 * We open the session by its id regardless of which workspace owns it (the
 * session view loads its content on demand), so this only chooses a sensible
 * landing workspace:
 *   1. the workspace whose directory owns `workDir`, when that resolves
 *      (best — the session shows in its own workspace context);
 *   2. otherwise the default workspace;
 *   3. otherwise the first workspace.
 *
 * Returns undefined only when there are no workspaces at all.
 */
export function pickLandingWorkspaceId(
  workspaces: Workspace[],
  workDir?: string,
): string | undefined {
  if (!workspaces.length) return undefined
  const matched = workDir ? resolveWorkspaceByWorkDir(workspaces, workDir) : undefined
  if (matched) return matched
  const fallback = workspaces.find((w) => w.isDefault) ?? workspaces[0]
  return fallback.id
}
