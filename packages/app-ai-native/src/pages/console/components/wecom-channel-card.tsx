import { Icon } from "@opencode-ai/ui/icon"
import { LocalIcon } from "@/components/local-icon"
import { createSignal, Show } from "solid-js"
import { type WecomChannel } from "@/context/settings"
import { useLanguage } from "@/context/language"
import { cn } from "@/lib/utils"
import { sx } from "@/pages/store/lib/styles"

type WecomChannelCardProps = {
  channel: WecomChannel
  onEdit: (channel: WecomChannel) => void
  onUpdate: (id: string, patch: Partial<WecomChannel>) => Promise<void> | void
  onRemove: (id: string) => Promise<void> | void
  onTest: (id: string) => Promise<void> | void
}

export function WecomChannelCard(props: WecomChannelCardProps) {
  const [testing, setTesting] = createSignal(false)
  const language = useLanguage()

  const handleTest = async () => {
    setTesting(true)
    try {
      await props.onTest(props.channel.id)
    } finally {
      setTesting(false)
    }
  }

  const enabledStyle = () =>
    props.channel.enabled
      ? { bg: "color-mix(in srgb, #22c55e 12%, transparent)", c: "#22c55e", label: language.t("store.notificationChannels.enabled") }
      : { bg: "rgba(156,163,175,0.12)", c: "var(--native-muted)", label: language.t("store.notificationChannels.disabled") || "Disabled" }

  const events = () => {
    const list: string[] = []
    if (props.channel.events.permission) list.push(language.t("store.notificationChannels.event.permission"))
    if (props.channel.events.question) list.push(language.t("store.notificationChannels.event.question"))
    if (props.channel.events.idle) list.push(language.t("store.notificationChannels.event.idle"))
    return list
  }

  return (
    <div class={sx.dashCard}>
      <div class={sx.dashHead}>
        <span class={cn(sx.dashName, "flex items-center gap-1.5")}>
          <Icon name="comment" size="small" />
          WeCom — {props.channel.name}
        </span>
        <span
          class={sx.pill}
          style={{ background: enabledStyle().bg, color: enabledStyle().c }}
        >
          {enabledStyle().label}
        </span>
      </div>

      <div class={sx.notifField}>
        <strong>Webhook:</strong>{" "}
        <span style={{ flex: 1, "min-width": "0", "font-size": "12px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          {props.channel.webhook || "—"}
        </span>
      </div>

      <div class={cn(sx.notifField, "mb-2")}>
        <strong>Events:</strong>{" "}
        <Show
          when={events().length > 0}
          fallback={<span>{language.t("store.notificationChannels.none")}</span>}
        >
          {events().join(", ")}
        </Show>
      </div>

      <div class={cn(sx.dashFoot, "justify-between")}>
        <button
          class={sx.notifTest}
          disabled={!props.channel.enabled || testing()}
          onClick={handleTest}
        >
          <LocalIcon name="bell" size="small" />
          {testing()
            ? language.t("store.notificationChannels.testing")
            : language.t("store.notificationChannels.test")}
        </button>
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            class={sx.action}
            title={language.t("common.edit")}
            onClick={() => props.onEdit(props.channel)}
          >
            <Icon name="edit" size="small" />
          </button>
          <button
            class={sx.action}
            title={language.t("common.delete")}
            onClick={() => void props.onRemove(props.channel.id)}
          >
            <Icon name="trash" size="small" />
          </button>
        </div>
      </div>
    </div>
  )
}
