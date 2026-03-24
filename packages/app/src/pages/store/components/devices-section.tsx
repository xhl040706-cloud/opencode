import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { TextField } from "@opencode-ai/ui/text-field"
import { createMemo, createSignal, For, Show } from "solid-js"
import type { Device } from "@/pages/workspace/types"
import { DeviceCard } from "./device-card"

// Mock 设备数据
const MOCK_DEVICES: Device[] = [
  {
    id: "dev-001",
    deviceId: "mac-abc123",
    displayName: "My Mac",
    platform: "macOS",
    version: "1.2.0",
    userId: "user-001",
    status: "online",
    description: "Personal development machine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dev-002",
    deviceId: "win-def456",
    displayName: "Office PC",
    platform: "Windows",
    version: "1.1.0",
    userId: "user-001",
    status: "offline",
    description: "Work computer in office",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dev-003",
    deviceId: "linux-ghi789",
    displayName: "Server",
    platform: "Linux",
    version: "1.2.0",
    userId: "user-001",
    status: "online",
    description: "Production server for deployment",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dev-004",
    deviceId: "mac-jkl012",
    displayName: "MacBook Pro",
    platform: "macOS",
    version: "1.2.0",
    userId: "user-001",
    status: "online",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export function DevicesSection() {
  const [devices, setDevices] = createSignal<Device[]>(MOCK_DEVICES)
  const [deviceSearch, setDeviceSearch] = createSignal("")

  const filteredDevices = createMemo(() => {
    const search = deviceSearch().toLowerCase().trim()
    if (!search) return devices()
    return devices().filter(
      (d) =>
        d.displayName.toLowerCase().includes(search) ||
        d.deviceId.toLowerCase().includes(search) ||
        d.platform.toLowerCase().includes(search)
    )
  })

  const handleUpdateDevice = (updated: Device) => {
    setDevices((list) => list.map((d) => (d.id === updated.id ? updated : d)))
  }

  return (
    <section class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-5">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-text-strong">设备管理</h2>
          <p class="mt-1 text-sm text-text-weak">管理您的注册设备</p>
        </div>
        <div class="w-48">
          <TextField
            value={deviceSearch()}
            onChange={setDeviceSearch}
            placeholder="搜索设备..."
          />
        </div>
      </div>

      <Show
        when={filteredDevices().length > 0}
        fallback={
          <div class="rounded-xl border border-dashed border-border-weak-base px-8 py-10 text-center text-sm text-text-weak">
            {deviceSearch() ? "未找到匹配的设备" : "暂无注册设备"}
          </div>
        }
      >
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <For each={filteredDevices()}>
            {(device) => <DeviceCard device={device} onUpdate={handleUpdateDevice} />}
          </For>
        </div>
      </Show>
    </section>
  )
}
