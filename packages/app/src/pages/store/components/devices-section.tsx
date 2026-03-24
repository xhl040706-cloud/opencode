import { showToast } from "@opencode-ai/ui/toast"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { Device } from "@/pages/workspace/types"
import { DeviceCard } from "./device-card"
import { deviceManagementService } from "../lib/device-management-service"

export function DevicesSection() {
  const language = useLanguage()
  const [deviceSearch, setDeviceSearch] = createSignal("")
  const [reloadKey, setReloadKey] = createSignal(0)

  const [devices, { mutate }] = createResource(
    reloadKey,
    async () => {
      return deviceManagementService.list()
    },
  )

  const filteredDevices = createMemo(() => {
    const search = deviceSearch().toLowerCase().trim()
    const list = devices() ?? []
    if (!search) return list
    return list.filter(
      (d) =>
        d.displayName.toLowerCase().includes(search) ||
        d.deviceId.toLowerCase().includes(search) ||
        d.platform.toLowerCase().includes(search),
    )
  })

  const handleUpdateDevice = async (payload: { deviceId: string; data: { displayName?: string; workspaceId?: string } }) => {
    const current = devices() ?? []
    const target = current.find((item) => item.id === payload.deviceId)
    if (!target) return

    const optimistic: Device = {
      ...target,
      displayName: payload.data.displayName ?? target.displayName,
      workspaceId: payload.data.workspaceId ?? target.workspaceId,
      updatedAt: new Date().toISOString(),
    }

    mutate((items) => (items ?? []).map((item) => (item.id === payload.deviceId ? optimistic : item)))

    try {
      const updated = await deviceManagementService.update(payload.deviceId, payload.data)
      mutate((items) => (items ?? []).map((item) => (item.id === payload.deviceId ? updated : item)))
      showToast({ variant: "success", icon: "circle-check", title: "设备信息已更新" })
    } catch (error) {
      mutate(current)
      showToast({
        variant: "error",
        icon: "circle-x",
        title: language.t("store.console.capabilities.toast.loadFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <section class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-5">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-text-strong">设备管理</h2>
          <p class="mt-1 text-sm text-text-weak">管理您的注册设备</p>
        </div>
        <div class="w-48">
          <input
            value={deviceSearch()}
            onInput={(e) => setDeviceSearch(e.currentTarget.value)}
            placeholder="搜索设备..."
            class="w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none focus:border-border-strong"
          />
        </div>
      </div>

      <Show when={!devices.loading} fallback={<div class="text-sm text-text-weak">加载设备中...</div>}>
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
      </Show>
    </section>
  )
}
