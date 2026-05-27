import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { Icon, type IconProps } from "@opencode-ai/ui/icon"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import type { WecomChannel } from "@/context/settings"
import { useLanguage } from "@/context/language"
import { cn } from "@/lib/utils"
import { AddWecomChannelDialog } from "./add-wecom-channel-dialog"
import { EditWecomChannelDialog } from "./edit-wecom-channel-dialog"
import { EditWecomAppDialog } from "./edit-wecom-app-dialog"
import { notificationChannelService } from "../lib/notification-channel-service"
import { channelService, type WeComAppChannel, type WeComAppConfig } from "../lib/channel-service"
import { ConfirmDialog } from "@/pages/store/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { startBind } from "../lib/identity-api"
import type { AuthIdentity } from "../lib/identity-api"

// 通知渠道类型定义
type NotificationChannelType = {
  id: string
  name: string
  description: string
  icon: IconProps["name"]
  addButtonText: string
  addDialogHint: string
}

export function NotificationChannelsSection() {
  const dialog = useDialog()
  const language = useLanguage()

  // Load available channel types
  const [availableTypes] = createResource(async () => channelService.getAvailableTypes())

  // Load WeChat Work group bot channels (notification module)
  const [wecomBotChannels, wecomBotActs] = createResource(async () => notificationChannelService.listWecom())

  // Load WeChat Work app channels (channel module)
  const [wecomAppChannels, wecomAppActs] = createResource(async () => channelService.listWeComApps())

  // 判断企微应用是否可用：从企微应用channels中判断
  const hasIdTrust = () => {
    const apps = wecomAppChannels() ?? []
    return apps.length > 0 && apps.some(app => app.enabled)
  }

  // 动态定义通知渠道类型，基于后端配置
  const channelTypes = (): NotificationChannelType[] => {
    const types = availableTypes()?.channelTypes ?? []
    return types.map((type: any) => {
      const typeId = type.type
      // 根据类型返回对应的配置
      if (typeId === "wecom") {
        return {
          id: "wecom-app",
          name: language.t("console.wecomApp.title"),
          description: language.t("console.wecomApp.typeDescription"),
          icon: "bot",
          addButtonText: language.t("console.wecomApp.add"),
          addDialogHint: language.t("console.wecomApp.addDialogHint"),
        }
      } else if (typeId === "wecom-webhook") {
        return {
          id: "wecom-bot",
          name: language.t("console.wecomBot.title"),
          description: language.t("console.wecomBot.typeDescription"),
          icon: "comment",
          addButtonText: language.t("console.wecomBot.add"),
          addDialogHint: language.t("console.wecomBot.addDialogHint"),
        }
      }
      // 默认配置，用于未知类型
      return {
        id: typeId,
        name: typeId,
        description: `${typeId} notification channel`,
        icon: "bell",
        addButtonText: `Add ${typeId}`,
        addDialogHint: `No ${typeId} configuration yet`,
      }
    })
  }

  const isLoading = () => wecomBotChannels.loading || wecomAppChannels.loading

  //企微群机器人处理函数
  const handleToggleBot = async (id: string, enabled: boolean) => {
    const current = wecomBotChannels() ?? []
    const target = current.find((item) => item.id === id)
    if (!target) return

    const optimistic: WecomChannel = { ...target, enabled }
    wecomBotActs.mutate((list) => (list ?? []).map((item) => (item.id === id ? optimistic : item)))

    try {
      const updated = await notificationChannelService.updateWecom(id, { enabled })
      wecomBotActs.mutate((list) => (list ?? []).map((item) => (item.id === id ? updated : item)))
      showToast({
        variant: "success",
        icon: "circle-check",
        title: enabled ? language.t("console.wecomBot.toast.enabled") : language.t("console.wecomBot.toast.disabled"),
      })
    } catch (error) {
      wecomBotActs.mutate(() => current)
      showToast({
        variant: "error",
        icon: "circle-x",
        title: language.t("console.wecomBot.toast.toggleFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleEditBot = (channel: WecomChannel) => {
    dialog.show(() => (
      <EditWecomChannelDialog
        channel={channel}
        onSaved={async (id, patch) => {
          const current = wecomBotChannels() ?? []
          const target = current.find((item) => item.id === id)
          if (!target) return

          const optimistic: WecomChannel = {
            ...target,
            ...patch,
            events: {
              ...target.events,
              ...(patch.events ?? {}),
            },
          }

          wecomBotActs.mutate((list) => (list ?? []).map((item) => (item.id === id ? optimistic : item)))

          try {
            const updated = await notificationChannelService.updateWecom(id, patch)
            wecomBotActs.mutate((list) => (list ?? []).map((item) => (item.id === id ? updated : item)))
            showToast({
              variant: "success",
              icon: "circle-check",
              title: language.t("console.wecomBot.toast.updated"),
            })
          } catch (error) {
            wecomBotActs.mutate(() => current)
            showToast({
              variant: "error",
              icon: "circle-x",
              title: language.t("console.wecomBot.toast.updateFailed"),
              description: error instanceof Error ? error.message : String(error),
            })
          }
        }}
      />
    ))
  }

  const handleRemoveBot = (id: string) => {
    const target = wecomBotChannels()?.find((item) => item.id === id)
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("common.delete")}
        description={language.t("console.wecomBot.confirmDelete", { name: target?.name ?? "" })}
        onConfirm={async () => {
          const current = wecomBotChannels() ?? []
          wecomBotActs.mutate((list) => (list ?? []).filter((item) => item.id !== id))
          try {
            await notificationChannelService.removeWecom(id)
            showToast({
              variant: "success",
              icon: "circle-check",
              title: language.t("console.wecomBot.toast.deleted"),
            })
          } catch (error) {
            wecomBotActs.mutate(() => current)
            showToast({
              variant: "error",
              icon: "circle-x",
              title: language.t("console.wecomBot.toast.deleteFailed"),
              description: error instanceof Error ? error.message : String(error),
            })
          }
        }}
      />
    ))
  }

  //企微应用处理函数
  const handleToggleApp = async (id: string, enabled: boolean) => {
    const current = wecomAppChannels() ?? []
    const target = current.find((item) => item.id === id)
    if (!target) return

    const optimistic: WeComAppChannel = { ...target, enabled }
    wecomAppActs.mutate((list) => (list ?? []).map((item) => (item.id === id ? optimistic : item)))

    try {
      await channelService.updateWeComApp(id, { enabled })
      // 后端只返回 success/status，不依赖返回的数据
      showToast({
        variant: "success",
        icon: "circle-check",
        title: enabled ? language.t("console.wecomApp.toast.enabled") : language.t("console.wecomApp.toast.disabled"),
      })
    } catch (error) {
      wecomAppActs.mutate(() => current)
      showToast({
        variant: "error",
        icon: "circle-x",
        title: language.t("console.wecomApp.toast.toggleFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleEditApp = (channel: WeComAppChannel) => {
    dialog.show(() => (
      <EditWecomAppDialog
        channel={channel}
        onSaved={async (id, patch) => {
          const current = wecomAppChannels() ?? []
          const target = current.find((item) => item.id === id)
          if (!target) return

          const optimistic: WeComAppChannel = {
            ...target,
            ...patch,
            config: {
              ...target.config,
              ...(patch.config ?? {}),
            } as WeComAppConfig,
          }

          wecomAppActs.mutate((list) => (list ?? []).map((item) => (item.id === id ? optimistic : item)))

          try {
            const updated = await channelService.updateWeComApp(id, patch)
            wecomAppActs.mutate((list) => (list ?? []).map((item) => (item.id === id ? updated : item)))
            showToast({
              variant: "success",
              icon: "circle-check",
              title: language.t("console.wecomApp.toast.updated"),
            })
          } catch (error) {
            wecomAppActs.mutate(() => current)
            showToast({
              variant: "error",
              icon: "circle-x",
              title: language.t("console.wecomApp.toast.updateFailed"),
              description: error instanceof Error ? error.message : String(error),
            })
          }
        }}
      />
    ))
  }

  const handleRemoveApp = (id: string) => {
    const target = wecomAppChannels()?.find((item) => item.id === id)
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("common.delete")}
        description={language.t("console.wecomApp.confirmDelete", { name: target?.name ?? "" })}
        onConfirm={async () => {
          const current = wecomAppChannels() ?? []
          wecomAppActs.mutate((list) => (list ?? []).filter((item) => item.id !== id))
          try {
            await channelService.removeWeComApp(id)
            showToast({
              variant: "success",
              icon: "circle-check",
              title: language.t("console.wecomApp.toast.deleted"),
            })
          } catch (error) {
            wecomAppActs.mutate(() => current)
            showToast({
              variant: "error",
              icon: "circle-x",
              title:language.t("console.wecomApp.toast.deleteFailed"),
              description: error instanceof Error ? error.message : String(error),
            })
          }
        }}
      />
    ))
  }

  return (
    <section class="rounded-[1.25rem] border border-[color:color-mix(in_oklab,var(--native-border)_42%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_84%,var(--native-bg-subtle))] p-3 shadow-[var(--native-shadow-sm)] sm:p-4">
      <div class="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 class="m-0 font-[var(--native-font-display)] text-[0.9875rem] font-semibold tracking-[-0.03em] text-[var(--native-foreground)]">
            {language.t("console.notificationChannels.title")}
          </h2>
          <p class="mt-0.5 max-w-[62ch] text-[0.8125rem] leading-[1.55] text-[var(--native-muted)]">
            {language.t("console.notificationChannels.description")}
          </p>
        </div>
      </div>

      <Show
        when={!isLoading()}
        fallback={<div class="rounded-[var(--native-radius-lg)] border border-dashed border-[color:color-mix(in_srgb,var(--native-border)_20%,transparent)] px-6 py-8 text-center text-[0.8125rem] text-[var(--native-muted)] sm:px-8 sm:py-10">{language.t("console.notificationChannels.loading")}</div>}
      >
        <Show
          when={channelTypes().length > 0}
          fallback={
            <div class="rounded-[var(--native-radius-lg)] border border-dashed border-[color:color-mix(in_srgb,var(--native-border)_20%,transparent)] px-6 py-8 text-center text-[0.8125rem] text-[var(--native-muted)] sm:px-8 sm:py-10">
              <div class="flex flex-col items-center gap-3">
                <div class="font-medium text-[var(--native-fg)]">{language.t("console.notificationChannels.noChannels.title")}</div>
                <div class="text-[var(--native-muted)]">{language.t("console.notificationChannels.noChannels.description")}</div>
              </div>
            </div>
          }
        >
          <div class="flex flex-col gap-6">
            <For each={channelTypes()}>
              {(channelType) => (
                <NotificationChannelTypeSection
                  type={channelType}
                  wecomBots={wecomBotChannels() ?? []}
                  wecomApps={wecomAppChannels() ?? []}
                  hasIdTrust={hasIdTrust()}
                  onToggleBot={handleToggleBot}
                  onEditBot={handleEditBot}
                  onRemoveBot={handleRemoveBot}
                  onToggleApp={handleToggleApp}
                  onEditApp={handleEditApp}
                  onRemoveApp={handleRemoveApp}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  )
}

// 通知渠道类型部分组件
type NotificationChannelTypeSectionProps = {
  type: NotificationChannelType
  wecomBots: WecomChannel[]
  wecomApps: WeComAppChannel[]
  hasIdTrust: boolean
  onToggleBot: (id: string, enabled: boolean) => Promise<void>
  onEditBot: (channel: WecomChannel) => void
  onRemoveBot: (id: string) => void
  onToggleApp: (id: string, enabled: boolean) => Promise<void>
  onEditApp: (channel: WeComAppChannel) => void
  onRemoveApp: (id: string) => void
}

function NotificationChannelTypeSection(props: NotificationChannelTypeSectionProps) {
  const dialog = useDialog()
  const language = useLanguage()
  const navigate = useNavigate()

  const channels = () => {
    if (props.type.id === "wecom-bot") {
      return props.wecomBots
    } else {
      return props.wecomApps
    }
  }

  // 检查企微应用是否可用
  const isWecomAppAvailable = () => {
    return props.type.id === "wecom-app" ? props.hasIdTrust : true
  }

  const handleAdd = () => {
    if (props.type.id === "wecom-bot") {
      dialog.show(() => (
        <AddWecomChannelDialog
          onCreated={async (payload) => {
            try {
              const created = await notificationChannelService.createWecom(payload)
              props.wecomBots.push(created)
              showToast({
                variant: "success",
                icon: "circle-check",
                title: language.t("console.wecomBot.toast.created"),
              })
            } catch (error) {
              showToast({
                variant: "error",
                icon: "circle-x",
                title: language.t("console.wecomBot.toast.createFailed"),
                description: error instanceof Error ? error.message : String(error),
              })
              throw error
            }
          }}
        />
      ))
    }
    // 企微应用不支持用户自行添加
  }

  return (
    <div class="rounded-lg border border-[color:color-mix(in_oklab,var(--native-border)_32%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_80%,var(--native-bg-subtle))] p-4">
      {/* Type Header */}
      <div class="mb-4 flex items-start justify-between">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color:color-mix(in_oklab,var(--native-primary)_8%,transparent)]">
            <Show when={props.type.icon === "comment"}>
              <Icon name={props.type.icon} size="medium" class="text-[var(--native-primary)]" />
            </Show>
            <Show when={props.type.icon === "bot"}>
              <svg class="h-6 w-6" viewBox="0 0 1228 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" style="color: var(--native-primary)">
                <path fill="currentColor" d="M1045.84 747.027a153.563 153.563 0 0 0-53.156 21.515 129.094 129.094 0 0 1-58.092 35.1c2.953-19.828 12.783-37.926 27.633-51.3a191.186 191.186 0 0 0 26.452-62.142 56.953 56.953 0 1 1 57.164 56.827zM941.639 610.634a190.814 190.814 0 0 0-61.932-26.747 56.953 56.953 0 1 1 56.953-56.953 155.266 155.266 0 0 0 21.263 53.325 129.666 129.666 0 0 1 34.762 58.346 85.978 85.978 0 0 1-50.878-27.97h-0.21z m-93.826-200.728c-17.17-143.817-166.092-256.5-346.274-256.5-191.954 0-348.132 127.744-348.132 284.85a266.33 266.33 0 0 0 124.369 216.169 351.762 351.762 0 0 0 37.969 24.384l-15.44 61.636c5.568 2.616 10.968 5.4 16.663 7.805l77.963-38.981c11.39 2.953 23.372 4.851 35.268 6.876 7.594 1.35 15.188 2.742 22.993 3.67a401.119 401.119 0 0 0 145.547-8.353 281.011 281.011 0 0 0 11.474 62.185 481.153 481.153 0 0 1-108.675 12.698 472.5 472.5 0 0 1-97.621-10.758L262.46 846.21a31.219 31.219 0 0 1-33.877-3.543 31.64 31.64 0 0 1-10.926-32.316l25.312-101.925A330.075 330.075 0 0 1 90.125 438.256c0-192.29 184.19-348.131 411.413-348.131 215.746 0 392.428 140.653 409.64 319.444a276.919 276.919 0 0 0-29.91-2.953c-11.18 0.422-22.36 1.476-33.456 3.248zM716.399 634.47c18.943-3.797 36.957-11.053 53.157-21.515a129.094 129.094 0 0 1 58.134-35.016 86.358 86.358 0 0 1-27.675 51.216c-12.445 18.984-21.389 40.078-26.451 62.184a56.953 56.953 0 1 1-57.165-56.869z m102.6 137.025c18.816 12.614 39.741 21.727 61.763 27a56.953 56.953 0 1 1-56.953 56.953 154.406 154.406 0 0 0-21.094-53.409 129.558 129.558 0 0 1-34.51-58.514 85.888 85.888 0 0 1 50.794 28.308v-0.338z"></path>
              </svg>
            </Show>
          </div>
          <div>
            <h3 class="m-0 font-[var(--native-font-display)] text-[1rem] font-semibold tracking-[-0.035em] text-[var(--native-foreground)]">{props.type.name}</h3>
            <p class="mt-1 text-[0.8125rem] text-[var(--native-muted)]">{props.type.description}</p>
          </div>
        </div>
        <Show when={props.type.id === "wecom-bot"}>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
          >
            {props.type.addButtonText}
          </Button>
        </Show>
      </div>

      {/* 企微应用不可用状态 */}
      <Show when={props.type.id === "wecom-app" && !isWecomAppAvailable()}>
        <div class="rounded-md border border-dashed border-[color:color-mix(in_srgb,#ef4444_20%,transparent)] bg-[color:color-mix(in_srgb,#ef4444_5%,transparent)] px-4 py-6 text-center">
          <div class="text-sm font-medium text-[#ef4444]">
            {language.t("console.wecomApp.unavailable.title")}
          </div>
          <div class="mt-2 text-xs text-[var(--native-muted)]">
            {language.t("console.wecomApp.unavailable.description")}
          </div>
          <div class="mt-3">
            <button
              type="button"
              class="rounded-[var(--native-radius-sm)] bg-[color:color-mix(in_oklab,var(--native-primary)_12%,var(--native-panel))] px-4 py-1.5 text-[0.8125rem] font-medium text-[var(--native-primary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--native-primary)_18%,var(--native-panel))]"
              onClick={async () => {
                try {
                  const authUrl = await startBind("idtrust")
                  window.location.href = authUrl
                } catch (error) {
                  showToast({
                    variant: "error",
                    icon: "circle-x",
                    title: language.t("console.wecomApp.bindFailed"),
                    description: error instanceof Error ? error.message : String(error),
                  })
                }
              }}
            >
              {language.t("console.wecomApp.bindButton")}
            </button>
          </div>
        </div>
      </Show>

      {/* Channels List */}
      <Show when={channels().length > 0 || props.type.id === "wecom-bot"}>
        <div class="flex flex-col gap-2">
          <For each={channels()}>
            {(channel) => (
              <NotificationChannelItem
                channel={channel}
                type={props.type.id}
                available={props.type.id === "wecom-bot" || isWecomAppAvailable()}
                onToggle={props.type.id === "wecom-bot" ? props.onToggleBot : props.onToggleApp}
                onEdit={(props.type.id === "wecom-bot" ? props.onEditBot : props.onEditApp) as (channel: WecomChannel | WeComAppChannel) => void}
                onRemove={props.type.id === "wecom-bot" ? props.onRemoveBot : props.onRemoveApp}
              />
            )}
          </For>
          <Show when={channels().length === 0 && props.type.id === "wecom-bot"}>
            <div class="rounded-md border border-dashed border-[color:color-mix(in_srgb,var(--native-border)_20%,transparent)] px-4 py-6 text-center text-sm text-[var(--native-muted)]">
              {props.type.addDialogHint}
            </div>
          </Show>
          {/* 企微应用无channel时的提示 */}
          <Show when={channels().length === 0 && props.type.id === "wecom-app"}>
            <div class="rounded-md border border-dashed border-[color:color-mix(in_srgb,var(--native-primary)_20%,transparent)] bg-[color:color-mix(in_srgb,var(--native-primary)_5%,transparent)] px-4 py-6 text-center">
              <div class="flex items-center justify-center gap-2 text-sm text-[var(--native-primary)]">
                <Icon name="help" size="small" />
                <span>{language.t("console.wecomApp.autoManaged")}</span>
              </div>
              <div class="mt-2 text-xs text-[var(--native-muted)]">
                {language.t("console.wecomApp.autoManagedHint")}
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

// 单个通知渠道项组件
type NotificationChannelItemProps = {
  channel: WecomChannel | WeComAppChannel
  type: string
  available: boolean
  onToggle: (id: string, enabled: boolean) => Promise<void>
  onEdit: (channel: WecomChannel | WeComAppChannel) => void
  onRemove: (id: string) => void
}

function NotificationChannelItem(props: NotificationChannelItemProps) {
  const language = useLanguage()
  const [toggling, setToggling] = createSignal(false)

  const enabled = () => props.channel.enabled

  const getDisplayName = () => {
    return props.type === "wecom-bot"
      ? language.t("console.wecomBot.title")
      : language.t("console.wecomApp.title")
  }

  const isAvailable = () => props.available

  const handleToggle = async () => {
    setToggling(true)
    try {
      await props.onToggle(props.channel.id, !enabled())
    } finally {
      setToggling(false)
    }
  }

  const getDescription = () => {
    if (props.type === "wecom-bot") {
      const bot = props.channel as WecomChannel
      const events: string[] = []
      if (bot.events.permission) events.push(language.t("store.notificationChannels.event.permission"))
      if (bot.events.question) events.push(language.t("store.notificationChannels.event.question"))
      if (bot.events.idle) events.push(language.t("store.notificationChannels.event.idle"))
      return events.length > 0 ? events.join(", ") : language.t("store.notificationChannels.none")
    } else {
      const app = props.channel as WeComAppChannel
      const userId = app.config?.userId
      if (!userId) {
        return "" // 不显示任何内容
      }
      return `${language.t("console.wecomApp.account")}: ${userId}`
    }
  }

  return (
    <div
      class="flex items-center gap-3 rounded-md border border-[color:color-mix(in_oklab,var(--native-border)_20%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_60%,var(--native-bg-subtle))] p-3"
      style={!isAvailable() ? {
        "border-color": "color-mix(in_srgb, #ef4444 20%, transparent)",
        "background-color": "color-mix(in_srgb, #ef4444 5%, transparent)",
        "opacity": 0.7
      } : undefined}
    >
      {/* Content */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-[var(--native-foreground)]">{getDisplayName()}</span>
          <Show when={!isAvailable()}>
            <span
              class="flex h-5 items-center rounded-full px-2 text-xs font-medium"
              style={{
                background: "color-mix(in srgb, #ef4444 12%, transparent)",
                color: "#ef4444",
              }}
            >
              {language.t("console.wecomApp.unavailable.short")}
            </span>
          </Show>
          <Show when={isAvailable()}>
            <span
              class="flex h-5 items-center rounded-full px-2 text-xs font-medium"
              style={{
                background: enabled() ? "color-mix(in srgb, #22c55e 12%, transparent)" : "color-mix(in srgb, var(--native-muted) 12%, transparent)",
                color: enabled() ? "#22c55e" : "var(--native-muted)",
              }}
            >
              {enabled() ? language.t("store.notificationChannels.enabled") : language.t("store.notificationChannels.disabled")}
            </span>
          </Show>
        </div>
        <div class="mt-0.5 text-xs text-[var(--native-muted)]">
          {getDescription()}
          <Show when={!isAvailable()}>
            {getDescription() && " · "}{language.t("console.wecomApp.unavailable.reason")}
          </Show>
        </div>
      </div>

      {/* Actions */}
      <div class="flex items-center gap-2">
        {/* 企微群机器人：显示切换、编辑、删除按钮 */}
        <Show when={props.type === "wecom-bot"}>
          <button
            type="button"
            class={cn(
              "h-8 rounded-md px-3 text-xs font-medium transition-colors",
              enabled()
                ? "bg-[color:color-mix(in_oklab,var(--native-primary)_8%,transparent)] text-[var(--native-primary)] hover:bg-[color:color-mix(in_oklab,var(--native-primary)_12%,transparent)]"
                : "bg-[color:color-mix(in_oklab,var(--native-muted)_8%,transparent)] text-[var(--native-muted)] hover:bg-[color:color-mix(in_oklab,var(--native-muted)_12%,transparent)]"
            )}
            disabled={toggling()}
            onClick={handleToggle}
          >
            {toggling() ? language.t("common.saving") : (enabled() ? language.t("common.disable") : language.t("common.enable"))}
          </button>

          <button
            type="button"
            class="h-8 rounded-md bg-[color:color-mix(in_oklab,var(--native-border)_8%,transparent)] px-3 text-xs font-medium text-[var(--native-foreground)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--native-border)_16%,transparent)]"
            onClick={() => props.onEdit(props.channel)}
          >
            {language.t("common.configure")}
          </button>

          <button
            type="button"
            class="h-8 w-8 rounded-md text-[var(--native-muted)] transition-colors"
            style={{ "background-color": "transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)"
              e.currentTarget.style.color = "#ef4444"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = ""
              e.currentTarget.style.color = ""
            }}
            onClick={() => props.onRemove(props.channel.id)}
          >
            <Icon name="trash" size="small" />
          </button>
        </Show>

        {/* 企微应用：只有可用时才显示切换按钮 */}
        <Show when={props.type === "wecom-app" && isAvailable()}>
          <button
            type="button"
            class={cn(
              "h-8 rounded-md px-3 text-xs font-medium transition-colors",
              enabled()
                ? "bg-[color:color-mix(in_oklab,var(--native-primary)_8%,transparent)] text-[var(--native-primary)] hover:bg-[color:color-mix(in_oklab,var(--native-primary)_12%,transparent)]"
                : "bg-[color:color-mix(in_oklab,var(--native-muted)_8%,transparent)] text-[var(--native-muted)] hover:bg-[color:color-mix(in_oklab,var(--native-muted)_12%,transparent)]"
            )}
            disabled={toggling()}
            onClick={handleToggle}
          >
            {toggling() ? language.t("common.saving") : (enabled() ? language.t("common.disable") : language.t("common.enable"))}
          </button>
        </Show>
      </div>
    </div>
  )
}
