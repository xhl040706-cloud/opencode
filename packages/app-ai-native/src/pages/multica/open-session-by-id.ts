import type { Device, Workspace } from "@/pages/workspace/types"

/**
 * Open a csc session by id when the owning workspace is unknown.
 *
 * multica reports only a session id. The session lives on some device, but its
 * working directory is an isolated per-task dir that belongs to no CoStrict
 * workspace, so we cannot resolve the workspace from a path. Instead we:
 *   1. enumerate the user's devices,
 *   2. probe each ONLINE device for the session id (lookup is directory-
 *      independent on the device side),
 *   3. once found, reuse an existing workspace on that device, or create one
 *      on demand for the session's directory,
 *   4. navigate to /workspace/<id>?session=<sessionId>.
 *
 * All I/O is injected so the orchestration is unit-testable.
 */
export interface OpenSessionDeps {
  listDevices: () => Promise<Device[]>
  /** Probe one device for the session; resolve its directory if present, else null. */
  probeSession: (device: Device, sessionId: string) => Promise<{ directory: string } | null>
  listWorkspaces: () => Promise<Workspace[]>
  /** Create a workspace on the device for the directory; resolve the new workspace id. */
  createWorkspace: (input: { name: string; deviceId: string; directory: string }) => Promise<string>
  navigateToSession: (workspaceId: string, sessionId: string) => void
  onError: (reason: "not_found" | "failed") => void
}

export async function openSessionById(sessionId: string, deps: OpenSessionDeps): Promise<void> {
  if (!sessionId) return
  try {
    const devices = await deps.listDevices()
    const online = devices.filter((d) => d.status === "online")

    // Probe concurrently; pick the first device (in list order) that has it.
    const probes = await Promise.all(
      online.map(async (device) => {
        try {
          const found = await deps.probeSession(device, sessionId)
          return found ? { device, directory: found.directory } : null
        } catch {
          return null
        }
      }),
    )
    const hit = probes.find((p): p is { device: Device; directory: string } => p !== null)
    if (!hit) {
      deps.onError("not_found")
      return
    }

    const workspaces = await deps.listWorkspaces()
    const existing = findWorkspaceForDevice(workspaces, hit.device)
    if (existing) {
      deps.navigateToSession(existing, sessionId)
      return
    }

    const newWorkspaceId = await deps.createWorkspace({
      name: deriveWorkspaceName(hit.directory),
      deviceId: hit.device.id,
      directory: hit.directory,
    })
    deps.navigateToSession(newWorkspaceId, sessionId)
  } catch {
    deps.onError("failed")
  }
}

/**
 * Find an existing workspace bound to the given device. Matches on the routing
 * id (`Workspace.deviceUniqueId` === `Device.deviceId`) first, then the DB id
 * (`Workspace.deviceId` === `Device.id`).
 */
export function findWorkspaceForDevice(workspaces: Workspace[], device: Device): string | undefined {
  const match = workspaces.find(
    (w) =>
      (!!w.deviceUniqueId && w.deviceUniqueId === device.deviceId) ||
      (!!w.deviceId && w.deviceId === device.id),
  )
  return match?.id
}

/** Last path segment of the session's directory, used to name an auto-created workspace. */
export function deriveWorkspaceName(directory: string): string {
  const trimmed = (directory ?? "").replace(/[/\\]+$/, "")
  const base = trimmed.split(/[/\\]/).pop()
  return base || "session"
}
