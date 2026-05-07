import { createMemo, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import type { PermissionRequest } from "@opencode-ai/sdk/v2/client"
import { Persist, persisted } from "@/utils/persist"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "./global-sync"
import { acceptKey, autoRespondsPermission } from "./permission-auto-respond"
import { useActiveWorkspace } from "@/pages/workspace/active-workspace"

type PermissionRespondFn = (input: {
  sessionID: string
  permissionID: string
  response: "once" | "always" | "reject"
  directory?: string
}) => void

export const { use: usePermission, provider: PermissionProvider, context: PermissionContext } = createSimpleContext({
  name: "Permission",
  init: () => {
    const globalSDK = useGlobalSDK()
    const globalSync = useGlobalSync()
    const active = useActiveWorkspace()

    const permissionsEnabled = createMemo(() => {
      return !!active?.workspace?.directories?.length
    })

    const [store, setStore, _, ready] = persisted(
      {
        ...(active?.id
          ? Persist.device(active.id, "permission", ["permission.v3"])
          : Persist.global("permission", ["permission.v3"])),
        migrate(value) {
          if (!value || typeof value !== "object" || Array.isArray(value)) return value

          const data = value as Record<string, unknown>
          if (data.autoAccept) return value

          return {
            ...data,
            autoAccept:
              typeof data.autoAcceptEdits === "object" && data.autoAcceptEdits && !Array.isArray(data.autoAcceptEdits)
                ? data.autoAcceptEdits
                : {},
          }
        },
      },
      createStore({
        autoAccept: {} as Record<string, boolean>,
      }),
    )

    const MAX_RESPONDED = 1000
    const RESPONDED_TTL_MS = 60 * 60 * 1000
    const responded = new Map<string, number>()
    const enableVersion = new Map<string, number>()

    function pruneResponded(now: number) {
      for (const [id, ts] of responded) {
        if (now - ts < RESPONDED_TTL_MS) break
        responded.delete(id)
      }

      for (const id of responded.keys()) {
        if (responded.size <= MAX_RESPONDED) break
        responded.delete(id)
      }
    }

    const respond: PermissionRespondFn = (input) => {
      globalSDK.client.permission.respond(input.permissionID, input).catch(() => {
        responded.delete(input.permissionID)
      })
    }

    function respondOnce(permission: PermissionRequest, directory?: string) {
      const now = Date.now()
      const hit = responded.has(permission.id)
      responded.delete(permission.id)
      responded.set(permission.id, now)
      pruneResponded(now)
      if (hit) return
      respond({
        sessionID: permission.sessionID,
        permissionID: permission.id,
        response: "once",
        directory,
      })
    }

    function defaultDirectory() {
      const dirs = active?.workspace?.directories
      if (!dirs?.length) return undefined
      return dirs.find((d) => d.isDefault)?.path ?? dirs[0].path
    }

    function isAutoAccepting(sessionID: string) {
      const wid = active?.id
      const dir = defaultDirectory()
      const session = dir ? globalSync.child(dir, { bootstrap: false })[0].session : []
      return autoRespondsPermission(store.autoAccept, session, { sessionID }, wid)
    }

    function shouldAutoRespond(permission: PermissionRequest) {
      const wid = active?.id
      const dir = defaultDirectory()
      const session = dir ? globalSync.child(dir, { bootstrap: false })[0].session : []
      return autoRespondsPermission(store.autoAccept, session, permission, wid)
    }

    function bumpEnableVersion(sessionID: string) {
      const key = acceptKey(sessionID, active?.id)
      const next = (enableVersion.get(key) ?? 0) + 1
      enableVersion.set(key, next)
      return next
    }

    const unsubscribe = globalSDK.event.listen((e) => {
      const event = e.details
      if (event?.type !== "permission.asked") return

      const perm = event.properties
      if (!shouldAutoRespond(perm)) return

      respondOnce(perm, e.name)
    })
    onCleanup(unsubscribe)

    function enable(sessionID: string, directory: string) {
      const key = acceptKey(sessionID, active?.id)
      const version = bumpEnableVersion(sessionID)
      setStore(
        produce((draft) => {
          draft.autoAccept[key] = true
          delete draft.autoAccept[sessionID]
        }),
      )

      globalSDK.client.interaction
        .permissions(directory)
        .then((x) => {
          if (enableVersion.get(key) !== version) return
          if (!isAutoAccepting(sessionID)) return
          for (const perm of (x as PermissionRequest[] | undefined) ?? []) {
            if (!perm?.id) continue
            if (!shouldAutoRespond(perm)) continue
            respondOnce(perm, directory)
          }
        })
        .catch(() => undefined)
    }

    function disable(sessionID: string) {
      bumpEnableVersion(sessionID)
      const key = active?.id ? acceptKey(sessionID, active.id) : sessionID
      setStore(
        produce((draft) => {
          draft.autoAccept[key] = false
        }),
      )
    }

    return {
      ready,
      respond,
      autoResponds(permission: PermissionRequest) {
        return shouldAutoRespond(permission)
      },
      isAutoAccepting,
      toggleAutoAccept(sessionID: string, directory: string) {
        if (isAutoAccepting(sessionID)) {
          disable(sessionID)
          return
        }

        enable(sessionID, directory)
      },
      enableAutoAccept(sessionID: string, directory: string) {
        if (isAutoAccepting(sessionID)) return
        enable(sessionID, directory)
      },
      disableAutoAccept(sessionID: string) {
        disable(sessionID)
      },
      permissionsEnabled,
    }
  },
})
