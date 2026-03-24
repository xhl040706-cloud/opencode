import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import type { UpdateDeviceRequest, Device } from "@/pages/workspace/types"
import { DeviceEditDialog } from "./device-edit-dialog"

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
        return { label: "在线", colorClass: "bg-green-500 text-green-600" }
      case "offline":
        return { label: "离线", colorClass: "bg-red-500 text-red-600" }
      default:
        return { label: "未知", colorClass: "bg-gray-400 text-gray-500" }
    }
  }

  return (
    <div class="group flex flex-col overflow-hidden rounded-xl border border-border-weak-base bg-background-base transition-shadow duration-150 hover:shadow-sm">
      <div class="shrink-0 px-4 py-3 flex items-start justify-between">
        <div class="min-w-0 flex items-center gap-2">
          <span class="truncate text-sm font-medium text-text-strong">{props.device.displayName}</span>
        </div>
        <button
          class="text-text-weak transition-colors opacity-0 group-hover:opacity-100 hover:text-text-strong"
          onClick={handleEdit}
          title="编辑设备"
        >
          <Icon name="edit" size="small" />
        </button>
      </div>

      <div class="flex flex-1 flex-col gap-1.5 px-4 pb-2">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-11-medium"
            classList={{
              "bg-green-100 text-green-700": props.device.status === "online",
              "bg-red-100 text-red-700": props.device.status === "offline",
              "bg-gray-100 text-gray-600": props.device.status === "",
            }}
          >
            <span
              class="size-1.5 rounded-full"
              classList={{
                "bg-green-500": props.device.status === "online",
                "bg-red-500": props.device.status === "offline",
                "bg-gray-400": props.device.status === "",
              }}
            />
            {statusInfo().label}
          </span>
        </div>
        <div class="text-xs text-text-weak">ID: {props.device.deviceId}</div>
        <div class="text-xs text-text-weak">
          {props.device.platform} · v{props.device.version}
        </div>
        <p class="mt-1 min-h-8 line-clamp-2 text-xs text-text-weak">{props.device.description || ""}</p>
      </div>

      <div class="shrink-0 border-t border-border-weak-base px-4 py-2 flex justify-end">
        <Button size="small" variant="ghost" class="h-7 px-2 text-xs" onClick={handleEdit}>
          编辑
        </Button>
      </div>
    </div>
  )
}
