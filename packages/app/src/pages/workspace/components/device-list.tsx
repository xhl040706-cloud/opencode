import { createMemo, For, Show, createSelector } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import type { Device, DeviceStatus } from "../types"

export type DeviceListProps = {
  devices: () => Device[]
  selectedDeviceId: () => string | undefined
  onSelectDevice: (deviceId: string) => void
  onCreateWorkspace: (device: Device) => void
  searchQuery: () => string
  onSearchChange: (query: string) => void
  isCollapsed: () => boolean
  onToggleCollapse: () => void
}

function getStatusText(status: DeviceStatus): string {
  switch (status) {
    case "online":
      return "在线"
    case "offline":
      return "离线"
    case "":
    default:
      return "离线"
  }
}

export function DeviceList(props: DeviceListProps) {
  const filteredDevices = createMemo(() => {
    const query = props.searchQuery().toLowerCase()
    if (!query) return props.devices()
    return props.devices().filter(
      (device) =>
        device.displayName.toLowerCase().includes(query) ||
        device.deviceId.toLowerCase().includes(query) ||
        device.platform.toLowerCase().includes(query)
    )
  })

  const isSelected = createSelector(() => props.selectedDeviceId())

  return (
    <Collapsible open={!props.isCollapsed()}>
      <div class="flex flex-col gap-1 p-2">
        <Collapsible.Trigger
          class="flex items-center gap-1 px-1 py-0.5 w-full rounded-md hover:bg-surface-base-hover transition-colors cursor-pointer"
          onClick={props.onToggleCollapse}
        >
          <Icon
            name={props.isCollapsed() ? "chevron-right" : "chevron-down"}
            size="small"
            class="size-4 text-icon-weak shrink-0"
          />
          <span class="text-12-medium text-text-weak">设备列表</span>
          <span class="text-11-regular text-text-weaker">{filteredDevices().length}</span>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div class="flex flex-col gap-2 px-2">
              <div class="flex items-center gap-2 h-8 px-2 bg-surface-base rounded-md border border-border-weak-base focus-within:border-border-strong-base">
                <Icon name="magnifying-glass" class="size-4 text-text-weak shrink-0" />
                <input
                  type="text"
                  placeholder="搜索设备..."
                  value={props.searchQuery()}
                  onInput={(e: Event) => props.onSearchChange((e.target as HTMLInputElement).value)}
                  class="flex-1 text-13-regular bg-transparent placeholder:text-text-weak focus:outline-none"
                />
            </div>

            <div class="flex flex-col gap-1 max-h-60 overflow-y-auto">
              <For each={filteredDevices()}>
                {(device) => (
                  <div
                    class={`group flex items-center rounded-md transition-colors duration-150 ${isSelected(device.id) ? "bg-surface-base-active" : ""} ${device.status === "offline" ? "opacity-60" : ""}`}
                  >
                    <div class="flex-1 min-w-0 flex flex-col gap-1 p-2 cursor-default">
                      <div class="flex items-center gap-2">
                        <div
                          classList={{
                            "size-1.5 rounded-full shrink-0": true,
                            "bg-icon-success-base": device.status === "online",
                            "bg-icon-critical-base": device.status === "offline",
                            "bg-border-weak-base": device.status === "",
                          }}
                        />
                        <span class="text-13-medium text-text-strong truncate">
                          {device.displayName}
                        </span>
                      </div>
                      <div class="flex flex-col gap-0.5 pl-4">
                        <span class="text-11-regular text-text-weak truncate">
                          ID: {device.deviceId}
                        </span>
                        <span class="text-11-regular text-text-weaker truncate">
                          {device.platform} • {device.version}
                        </span>
                      </div>
                    </div>

                    <Tooltip
                      placement="top"
                      value={device.status === "offline" ? "设备离线，无法创建工作空间" : "创建工作空间"}
                      class="self-stretch"
                    >
                      <div
                        class="flex items-center justify-center w-10 h-full cursor-pointer rounded-r-md transition-colors hover:bg-surface-raised-base-hover"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation()
                          if (device.status !== "offline") props.onCreateWorkspace(device)
                        }}
                      >
                        <Icon name="plus" class="size-4 text-icon-weak" />
                      </div>
                    </Tooltip>
                  </div>
                )}
              </For>

              <Show when={filteredDevices().length === 0}>
                <div class="flex flex-col items-center justify-center py-4 text-text-weak">
                  <Icon name="magnifying-glass" class="size-8 mb-2 opacity-50" />
                  <span class="text-12-regular">未找到设备</span>
                </div>
              </Show>
            </div>
          </div>
        </Collapsible.Content>
      </div>
    </Collapsible>
  )
}
