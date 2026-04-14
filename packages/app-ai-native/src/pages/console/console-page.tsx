import { createResource, createSignal, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { Toast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { LocalIcon } from "@/components/local-icon"
import { DevicesSection } from "./components/devices-section"
import { NotificationChannelsSection } from "./components/notification-channels-section"
import { deviceManagementService } from "./lib/device-management-service"
import { notificationChannelService } from "./lib/notification-channel-service"
import DashboardRepositories from "./dashboard-repositories"
import DashboardCapabilities from "./dashboard-capabilities"
import { cn } from "@/lib/utils"
import { st, sx } from "@/pages/store/lib/styles"

type Tab = "repositories" | "capabilities" | "devices" | "notifications"

export default function ConsolePage() {
  const language = useLanguage()
  const [activeTab, setActiveTab] = createSignal<Tab>("repositories")

  const [devices, deviceActs] = createResource(async () => deviceManagementService.list())
  const [channels, channelActs] = createResource(async () => notificationChannelService.listWecom())

  const onlineCount = () => (devices() ?? []).filter((d) => d.status === "online").length

  return (
    <>
      <div class="mx-auto flex max-w-[960px] flex-col gap-6 px-7 pt-6 pb-12 max-[768px]:p-4">
        {/* Header */}
        <div class="flex items-start gap-4 rounded-[var(--native-radius-xl)] border border-[color:color-mix(in_srgb,var(--native-border)_12%,transparent)] bg-[linear-gradient(135deg,var(--native-panel),color-mix(in_srgb,var(--native-primary)_5%,var(--native-panel)))] px-6 py-5 shadow-[var(--native-shadow-sm)]">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--native-radius-lg)] bg-[color-mix(in_srgb,var(--native-primary)_10%,transparent)] text-[var(--native-primary)]">
            <Icon name="sliders" />
          </div>
          <div>
            <h1 class="m-0 text-[1.625rem] leading-[1.15] font-extrabold tracking-[-0.035em] text-[var(--native-foreground)]">{language.t("console.title")}</h1>
            <p class="mt-2 max-w-[38rem] text-[0.8125rem] leading-6 text-[var(--native-muted)]">{language.t("console.description")}</p>
          </div>
        </div>

        {/* Stats */}
        <div class="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          <article
            class={cn(sx.statCard, "cursor-pointer")}
            style={{ "--stat-accent": "#22c55e", "--stat-bg": "#D1FAE5" }}
            onClick={() => setActiveTab("devices")}
          >
            <div class={sx.statIcon}>
              <Icon name="server" />
            </div>
            <div>
              <div class={sx.statLabel}>{language.t("console.stats.devices")}</div>
              <p class={sx.statValue}>
                <Show when={!devices.loading} fallback="—">
                  {devices()?.length ?? 0}
                </Show>
              </p>
            </div>
          </article>

          <article
            class={cn(sx.statCard, "cursor-pointer")}
            style={{ "--stat-accent": "#a855f7", "--stat-bg": "#EDE9FE" }}
            onClick={() => setActiveTab("notifications")}
          >
            <div class={sx.statIcon}>
              <LocalIcon name="bell" size="small" />
            </div>
            <div>
              <div class={sx.statLabel}>{language.t("console.stats.channels")}</div>
              <p class={sx.statValue}>
                <Show when={!channels.loading} fallback="—">
                  {channels()?.length ?? 0}
                </Show>
              </p>
            </div>
          </article>

          <article
            class={sx.statCard}
            style={{ "--stat-accent": "#3b82f6", "--stat-bg": "#DBEAFE" }}
          >
            <div class={sx.statIcon}>
              <Icon name="circle-check" />
            </div>
            <div>
              <div class={sx.statLabel}>{language.t("console.stats.online")}</div>
              <p class={sx.statValue}>
                <Show when={!devices.loading} fallback="—">
                  {onlineCount()}
                </Show>
              </p>
            </div>
          </article>
        </div>

        {/* Tabbed Content inside a card shell */}
        <section class="overflow-hidden rounded-[1.25rem] border border-[color:color-mix(in_srgb,var(--native-border)_12%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
          <div class="border-b border-[color:color-mix(in_srgb,var(--native-border)_12%,transparent)] px-4 pt-4 pb-3">
            <div class={cn(sx.tabs, "w-full")} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab() === "repositories"}
                class={st.tab(activeTab() === "repositories")}
                onClick={() => setActiveTab("repositories")}
              >
                {language.t("console.tab.repositories")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab() === "capabilities"}
                class={st.tab(activeTab() === "capabilities")}
                onClick={() => setActiveTab("capabilities")}
              >
                {language.t("console.tab.capabilities")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab() === "devices"}
                class={st.tab(activeTab() === "devices")}
                onClick={() => setActiveTab("devices")}
              >
                {language.t("console.tab.devices")}
                <Show when={!devices.loading}>
                  <span class="ml-1 inline-flex min-w-5 items-center justify-center rounded-[var(--native-radius-full)] bg-black/8 px-1.5 text-[11px] leading-5 text-current">{devices()?.length ?? 0}</span>
                </Show>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab() === "notifications"}
                class={st.tab(activeTab() === "notifications")}
                onClick={() => setActiveTab("notifications")}
              >
                {language.t("console.tab.notifications")}
                <Show when={!channels.loading}>
                  <span class="ml-1 inline-flex min-w-5 items-center justify-center rounded-[var(--native-radius-full)] bg-black/8 px-1.5 text-[11px] leading-5 text-current">{channels()?.length ?? 0}</span>
                </Show>
              </button>
            </div>
          </div>

          <Show when={activeTab() === "repositories"}>
            <div class="p-3 sm:p-4">
              <DashboardRepositories />
            </div>
          </Show>
          <Show when={activeTab() === "capabilities"}>
            <div class="p-3 sm:p-4">
              <DashboardCapabilities />
            </div>
          </Show>
          <Show when={activeTab() === "devices"}>
            <div class="p-3 sm:p-4">
              <DevicesSection
                devices={devices}
                loading={() => devices.loading}
                setDevices={deviceActs.mutate}
              />
            </div>
          </Show>
          <Show when={activeTab() === "notifications"}>
            <div class="p-3 sm:p-4">
              <NotificationChannelsSection
                channels={channels}
                loading={() => channels.loading}
                setChannels={channelActs.mutate}
              />
            </div>
          </Show>
        </section>
      </div>
      <Toast.Region />
    </>
  )
}
