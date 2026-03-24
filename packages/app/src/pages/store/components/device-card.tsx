import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import type { UpdateDeviceRequest, Device } from "@/pages/workspace/types"
import { DeviceEditDialog } from "./device-edit-dialog"

const STATUS_META = {
  online: {
    dotClass: "bg-icon-success-base",
    title: "在线",
  },
  offline: {
    dotClass: "bg-icon-critical-base",
    title: "离线",
  },
  unknown: {
    dotClass: "bg-border-weak-base",
    title: "未知",
  },
} as const

type DeviceCardProps = {
  device: Device
  onUpdate: (payload: { deviceId: string; data: UpdateDeviceRequest }) => Promise<void> | void
}

export function DeviceCard(props: DeviceCardProps) {
  const dialog = useDialog()

  const handleEdit = () => {
    dialog.show(() => (
      <DeviceEditDialog
        device={props.device}
        onSaved={(data) => props.onUpdate({ deviceId: props.device.id, data })}
      />
    ))
  }

  const statusInfo = () => {
    switch (props.device.status) {
      case "online":
        return STATUS_META.online
      case "offline":
        return STATUS_META.offline
      default:
        return STATUS_META.unknown
    }
  }

  return (
    <div class="group flex flex-col overflow-hidden rounded-xl border border-border-weak-base bg-background-base transition-shadow duration-150 hover:shadow-sm">
      <div class="flex shrink-0 items-start justify-between px-4 py-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-medium text-text-strong">{props.device.displayName}</span>
            {props.device.label ? (
              <span class="rounded-full bg-surface-info-base/20 px-2 py-0.5 text-11-medium text-text-weak">
                {props.device.label}
              </span>
            ) : null}
          </div>
          <div class="mt-1 text-xs text-text-weak">ID: {props.device.deviceId}</div>
        </div>
        <span
          class={`size-2.5 shrink-0 rounded-full ${statusInfo().dotClass}`}
          title={statusInfo().title}
          aria-label={statusInfo().title}
        />
      </div>

      <div class="flex flex-1 flex-col gap-2 px-4 pb-3">
        <div class="flex items-center gap-2">
          {props.device.workspaceId ? <span class="text-xs text-text-weak">工作空间: {props.device.workspaceId}</span> : null}
        </div>
        <div class="text-xs text-text-weak">{props.device.platform || "未知平台"}{props.device.version ? ` · v${props.device.version}` : ""}</div>
        <p class="min-h-10 text-xs leading-relaxed text-text-weak">
          {props.device.description?.trim() || "暂无设备描述"}
        </p>
      </div>

      <div class="flex shrink-0 justify-end border-t border-border-weak-base px-4 py-2">
        <Button size="small" variant="ghost" class="h-7 px-2 text-xs" onClick={handleEdit}>
          编辑
        </Button>
      </div>
    </div>
  )
}
