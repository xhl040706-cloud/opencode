import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { Show } from "solid-js"
import type { Device } from "@/pages/workspace/types"
import { DeviceEditDialog } from "./device-edit-dialog"

type DeviceCardProps = {
  device: Device
  onUpdate: (updated: Device) => void
}

export function DeviceCard(props: DeviceCardProps) {
  const dialog = useDialog()

  const handleEdit = () => {
    dialog.show(() => <DeviceEditDialog device={props.device} onSaved={props.onUpdate} />)
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
    <div class="group flex flex-col rounded-xl border border-border-weak-base bg-background-base overflow-hidden transition-shadow duration-150 hover:shadow-sm">
      {/* 卡片头部：名称 */}
      <div class="flex items-start justify-between px-4 py-3 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm font-medium text-text-strong truncate">{props.device.displayName}</span>
        </div>
        <button
          class="text-text-weak hover:text-text-strong transition-colors opacity-0 group-hover:opacity-100"
          onClick={handleEdit}
          title="编辑设备"
        >
          <Icon name="edit" size="small" />
        </button>
      </div>

      {/* 设备信息 - flex-1 撑开 */}
      <div class="flex-1 px-4 pb-2 flex flex-col gap-1.5">
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
        {/* 描述区域 - 始终占位 */}
        <p class="text-xs text-text-weak line-clamp-2 min-h-8 mt-1">
          {props.device.description || ""}
        </p>
      </div>

      {/* 底部操作栏 */}
      <div class="border-t border-border-weak-base px-4 py-2 flex justify-end shrink-0">
        <Button size="small" variant="ghost" class="h-7 px-2 text-xs" onClick={handleEdit}>
          编辑
        </Button>
      </div>
    </div>
  )
}
