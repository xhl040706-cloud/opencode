import { Icon } from "@opencode-ai/ui/icon"
import { Show, createSignal } from "solid-js"
import { useLanguage } from "@/context/language"
import { cn } from "@/lib/utils"
import type { WecomChannel } from "@/context/settings"
import type { WeComAppChannel } from "../lib/channel-service"

// 统一的通知渠道类型
export type UnifiedNotificationChannel =
  | { type: "wecom-bot"; data: WecomChannel }
  | { type: "wecom-app"; data: WeComAppChannel }

type NotificationChannelListItemProps = {
  channel: UnifiedNotificationChannel
  onToggle: (channel: UnifiedNotificationChannel, enabled: boolean) => Promise<void> | void
  onEdit: (channel: UnifiedNotificationChannel) => void
}

export function NotificationChannelListItem(props: NotificationChannelListItemProps) {
  const language = useLanguage()
  const [toggling, setToggling] = createSignal(false)

  const enabled = () => props.channel.data.enabled
  const name = () => {
    if (props.channel.type === "wecom-bot") {
      return `${language.t("console.wecomBot.title")} — ${props.channel.data.name}`
    } else {
      return `${language.t("console.wecomApp.title")} — ${props.channel.data.name}`
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      await props.onToggle(props.channel, !enabled())
    } finally {
      setToggling(false)
    }
  }

  const handleEdit = () => {
    props.onEdit(props.channel)
  }

  const getIcon = () => {
    return props.channel.type === "wecom-bot" ? "comment" : "message-square"
  }

  const getTypeLabel = () => {
    return props.channel.type === "wecom-bot"
      ? language.t("console.wecomBot.title")
      : language.t("console.wecomApp.title")
  }

  const getStatusColor = () => {
    return enabled() ? "#22c55e" : "var(--native-muted)"
  }

  const getDescription = () => {
    if (props.channel.type === "wecom-bot") {
      const bot = props.channel.data
      const events: string[] = []
      if (bot.events.permission) events.push(language.t("store.notificationChannels.event.permission"))
      if (bot.events.question) events.push(language.t("store.notificationChannels.event.question"))
      if (bot.events.idle) events.push(language.t("store.notificationChannels.event.idle"))
      return events.length > 0 ? events.join(", ") : language.t("store.notificationChannels.none")
    } else {
      const app = props.channel.data
      return `User ID: ${app.config.userId}`
    }
  }

  return (
    <div class="flex items-center gap-3 rounded-lg border border-[color:color-mix(in_oklab,var(--native-border)_32%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_80%,var(--native-bg-subtle))] p-3 transition-colors hover:border-[color:color-mix(in_oklab,var(--native-border)_48%,transparent)]">
      {/* Icon */}
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color:color-mix(in_oklab,var(--native-primary)_8%,transparent)]">
        <Icon name={getIcon()} size="small" class="text-[var(--native-primary)]" />
      </div>

      {/* Content */}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium text-[var(--native-muted)]">{getTypeLabel()}</span>
          <span class="text-sm font-medium text-[var(--native-foreground)]">{name()}</span>
          <span
            class="flex h-5 items-center rounded-full px-2 text-xs font-medium"
            style={{
              background: enabled() ? "color-mix(in srgb, #22c55e 12%, transparent)" : "color-mix(in srgb, var(--native-muted) 12%, transparent)",
              color: getStatusColor(),
            }}
          >
            {enabled() ? language.t("store.notificationChannels.enabled") : language.t("store.notificationChannels.disabled")}
          </span>
        </div>
        <div class="mt-0.5 text-xs text-[var(--native-muted)]">
          {getDescription()}
        </div>
      </div>

      {/* Actions */}
      <div class="flex items-center gap-2">
        <button
          type="button"
          class={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
            enabled()
              ? "bg-[color:color-mix(in_oklab,var(--native-primary)_8%,transparent)] text-[var(--native-primary)] hover:bg-[color:color-mix(in_oklab,var(--native-primary)_12%,transparent)]"
              : "bg-[color:color-mix(in_oklab,var(--native-muted)_8%,transparent)] text-[var(--native-muted)] hover:bg-[color:color-mix(in_oklab,var(--native-muted)_12%,transparent)]"
          )}
          disabled={toggling()}
          onClick={handleToggle}
        >
          {toggling() ? (
            <>
              <Icon name="loader-2" size="small" class="animate-spin" />
              {language.t("common.saving")}
            </>
          ) : (
            <>
              <Icon name={enabled() ? "toggle-right" : "toggle-left"} size="small" />
              {enabled() ? language.t("common.disable") : language.t("common.enable")}
            </>
          )}
        </button>

        <button
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-md bg-[color:color-mix(in_oklab,var(--native-border)_8%,transparent)] px-3 text-xs font-medium text-[var(--native-foreground)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--native-border)_16%,transparent)]"
          onClick={handleEdit}
        >
          <Icon name="settings" size="small" />
          {language.t("common.configure")}
        </button>
      </div>
    </div>
  )
}
