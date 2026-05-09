import type { PermissionRequest } from "@opencode-ai/sdk/v2/client"
import { createSimpleContext } from "@opencode-ai/ui/context"

type PermissionRespondFn = (input: {
  sessionID: string
  permissionID: string
  response: "once" | "always" | "reject"
  directory?: string
}) => void

export type PermissionValue = {
  ready: () => boolean
  respond: PermissionRespondFn
  autoResponds: (permission?: PermissionRequest) => boolean
  isAutoAccepting: (sessionID?: string) => boolean
  toggleAutoAccept: (sessionID?: string, directory?: string) => void
  enableAutoAccept: (sessionID?: string, directory?: string) => void
  disableAutoAccept: (sessionID?: string) => void
  permissionsEnabled: () => boolean
}

const stub: PermissionValue = {
  ready: () => true,
  respond: () => {},
  autoResponds: () => false,
  isAutoAccepting: () => false,
  toggleAutoAccept: () => {},
  enableAutoAccept: () => {},
  disableAutoAccept: () => {},
  permissionsEnabled: () => false,
}

export const { use: usePermission, provider: PermissionProvider, context: PermissionContext } = createSimpleContext({
  name: "Permission",
  init: () => stub,
})
