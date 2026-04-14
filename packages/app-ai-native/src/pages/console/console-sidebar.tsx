import { A, useLocation } from "@solidjs/router"
import { createResource, For, Show } from "solid-js"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { LocalIcon, type LocalIconName } from "@/components/local-icon"
import { useLanguage } from "@/context/language"
import { appPath } from "@/lib/router"
import { deviceManagementService } from "./lib/device-management-service"
import { notificationChannelService } from "./lib/notification-channel-service"

const NAV = [
  { href: "/console", labelKey: "store.dashboard.nav.repositories", localIcon: "repo" as LocalIconName, color: "#2E6CC4", exact: true },
  { href: "/console/capabilities", labelKey: "store.dashboard.nav.capabilities", icon: "sparkles" as IconProps["name"], color: "#F59E0B" },
  { href: "/console/devices", labelKey: "store.dashboard.nav.devices", icon: "server" as IconProps["name"], color: "#22c55e", badge: "devices" as const },
  { href: "/console/notifications", labelKey: "store.dashboard.nav.notifications", localIcon: "bell" as LocalIconName, color: "#a855f7", badge: "channels" as const },
] as const

export default function ConsoleSidebar() {
  const location = useLocation()
  const language = useLanguage()
  const path = () => appPath(location.pathname)

  const [devices] = createResource(async () => deviceManagementService.list())
  const [channels] = createResource(async () => notificationChannelService.listWecom())

  const counts = () => ({
    devices: devices()?.length ?? 0,
    channels: channels()?.length ?? 0,
  })

  const active = (href: string, exact?: boolean) => {
    const p = path()
    if (exact) return p === href || p === href + "/"
    return p === href || p.startsWith(href + "/")
  }

  return (
    <aside class="flex w-[15.5rem] shrink-0 flex-col overflow-hidden border-r border-[color:color-mix(in_srgb,var(--native-border)_20%,transparent)] bg-[var(--native-panel)]">
      <div class="border-b border-[color:color-mix(in_srgb,var(--native-border)_12%,transparent)] px-4 pt-3.5 pb-2.5">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold tracking-[-0.01em] text-[var(--native-foreground)]">{language.t("store.dashboard.title")}</span>
        </div>
      </div>

      <nav class="custom-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-2.5">
        <div>
          <div class="flex flex-col gap-px">
            <For each={NAV}>
              {(item) => {
                const on = () => active(item.href, "exact" in item ? item.exact : false)
                return (
                  <A
                    href={item.href}
                    class={[
                      "relative flex w-full items-center gap-2.5 rounded-[var(--native-radius-sm)] px-2 py-[0.4375rem] text-left text-[0.8125rem] font-medium transition-all",
                      on()
                        ? "bg-[color-mix(in_srgb,var(--native-primary)_8%,transparent)] text-[var(--native-primary)] font-semibold before:absolute before:top-[0.3rem] before:bottom-[0.3rem] before:left-[-0.5rem] before:w-[3px] before:rounded-r-[3px] before:bg-[var(--native-primary)] before:content-['']"
                        : "bg-transparent text-[var(--native-muted)] hover:bg-[var(--native-hover)] hover:text-[var(--native-foreground)]",
                    ].join(" ")}
                  >
                    <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--native-radius-sm)] text-[var(--native-muted)] transition-all [&_[data-slot=icon-svg]]:h-[15px] [&_[data-slot=icon-svg]]:w-[15px] [&_[data-component=icon]]:h-[15px] [&_[data-component=icon]]:w-[15px]">
                      {"localIcon" in item
                        ? <LocalIcon name={item.localIcon} size="small" />
                        : <Icon name={item.icon} size="small" />}
                    </span>
                    {language.t(item.labelKey)}
                    <Show when={"badge" in item && !devices.loading && !channels.loading}>
                      <span class="ml-auto rounded-[var(--native-radius-full)] bg-[color-mix(in_srgb,var(--native-primary)_8%,transparent)] px-[0.4375rem] text-[0.625rem] font-semibold leading-[1.625] text-[var(--native-primary)]">
                        {counts()[(item as any).badge]}
                      </span>
                    </Show>
                  </A>
                )
              }}
            </For>
          </div>
        </div>
      </nav>
    </aside>
  )
}
