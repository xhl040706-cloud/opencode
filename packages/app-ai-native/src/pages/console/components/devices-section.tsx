import { showToast } from "@opencode-ai/ui/toast"
import { Icon } from "@opencode-ai/ui/icon"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { Device, UpdateDeviceRequest } from "@/pages/workspace/types"
import { DeviceCard } from "./device-card"
import { deviceManagementService } from "../lib/device-management-service"
import { sx } from "@/pages/store/lib/styles"

type DevicesSectionProps = {
  devices?: () => Device[] | undefined
  loading?: () => boolean
  setDevices?: (fn: (items: Device[] | undefined) => Device[] | undefined) => void
}

export function DevicesSection(props: DevicesSectionProps = {}) {
  const language = useLanguage()
  const [deviceSearch, setDeviceSearch] = createSignal("")
  const local = !props.devices
    ? createResource(async () => deviceManagementService.list())
    : undefined

  const devices = () => props.devices?.() ?? local?.[0]()
  const loading = () => props.loading?.() ?? local?.[0].loading ?? false
  const mutate = props.setDevices ?? local?.[1].mutate ?? (() => undefined)

  const filteredDevices = createMemo(() => {
    const search = deviceSearch().toLowerCase().trim()
    const list = devices() ?? []
    if (!search) return list
    return list.filter((d) => {
      const displayName = d.displayName.toLowerCase()
      const deviceId = d.deviceId.toLowerCase()
      const platform = d.platform.toLowerCase()
      const description = d.description?.toLowerCase() ?? ""
      const label = d.label?.toLowerCase() ?? ""

      return (
        displayName.includes(search) ||
        deviceId.includes(search) ||
        platform.includes(search) ||
        description.includes(search) ||
        label.includes(search)
      )
    })
  })

  const handleUpdateDevice = async (payload: { deviceId: string; data: UpdateDeviceRequest }) => {
    const current = devices() ?? []
    const target = current.find((item) => item.deviceId === payload.deviceId)
    if (!target) return

    const optimistic: Device = {
      ...target,
      displayName: payload.data.displayName ?? target.displayName,
      workspaceId: payload.data.workspaceId ?? target.workspaceId,
      description: payload.data.description ?? target.description,
      label: payload.data.label ?? target.label,
      updatedAt: new Date().toISOString(),
    }

    mutate((items) => (items ?? []).map((item) => (item.deviceId === payload.deviceId ? optimistic : item)))

    try {
      const updated = await deviceManagementService.update(payload.deviceId, payload.data)
      mutate((items) => (items ?? []).map((item) => (item.deviceId === payload.deviceId ? updated : item)))
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("store.devices.toast.updated"),
      })
    } catch (error) {
      mutate(() => current)
      showToast({
        variant: "error",
        icon: "circle-x",
        title: language.t("store.devices.toast.updateFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <section class={sx.cshell}>
      <div class={sx.toolbar}>
        <div>
          <h2 class={sx.toolbarTitle}>{language.t("store.devices.title")}</h2>
          <p class={sx.toolbarSub}>{language.t("store.devices.description")}</p>
        </div>
        <div class={sx.toolbarActs}>
          <div class={sx.searchWrap}>
            <Icon name="magnifying-glass" size="small" class={sx.searchIcon} />
            <input
              class={sx.search}
              type="search"
              value={deviceSearch()}
              onInput={(e) => setDeviceSearch(e.currentTarget.value)}
              placeholder={language.t("store.devices.searchPlaceholder")}
            />
          </div>
        </div>
      </div>

      <Show
        when={!loading()}
        fallback={<div class={sx.empty}>{language.t("store.devices.loading")}</div>}
      >
        <Show
          when={filteredDevices().length > 0}
          fallback={
            <div class={sx.empty}>
              {deviceSearch() ? language.t("store.devices.empty.search") : language.t("store.devices.empty.default")}
            </div>
          }
        >
          <div class={sx.dashGrid}>
            <For each={filteredDevices()}>
              {(device) => <DeviceCard device={device} onUpdate={handleUpdateDevice} />}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  )
}
