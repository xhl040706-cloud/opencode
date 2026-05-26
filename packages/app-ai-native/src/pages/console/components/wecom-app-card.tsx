import { Icon } from "@opencode-ai/ui/icon"
import { createSignal, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { cn } from "@/lib/utils"
import { sx } from "@/pages/store/lib/styles"
import type { WeComAppChannel } from "../lib/channel-service"

type WecomAppCardProps = {
  channel: WeComAppChannel
  onEdit: (channel: WeComAppChannel) => void
  onUpdate: (id: string, patch: Partial<{ name: string; config: { userId: string }; enabled: boolean }>) => Promise<void> | void
  onRemove: (id: string) => Promise<void> | void
  onTest: (id: string) => Promise<void> | void
}

export function WecomAppCard(props: WecomAppCardProps) {
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
      ? { bg: "color-mix(in srgb, #22c55e 12%, transparent)", c: "#22c55e", label: language.t("console.wecomApp.enabled") }
      : { bg: "rgba(156,163,175,0.12)", c: "var(--native-muted)", label: language.t("console.wecomApp.disabled") }

  return (
    <div class={sx.dashCard}>
      <div class={sx.dashHead}>
        <span class={cn(sx.dashName, "flex items-center gap-1.5")}>
          <Icon name="message-square" size="small" />
          {language.t("console.wecomApp.title")} — {props.channel.name}
        </span>
        <span
          class={sx.pill}
          style={{ background: enabledStyle().bg, color: enabledStyle().c }}
        >
          {enabledStyle().label}
        </span>
      </div>

      <div class={sx.notifField}>
        <strong>{language.t("console.wecomApp.userId")}:</strong>{" "}
        <span style={{ flex: 1, "min-width": "0", "font-size": "12px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
          {props.channel.config.userId || "—"}
        </span>
      </div>

      <Show when={props.channel.webhookVerified}>
        <div class={sx.notifField}>
          <strong style={{ color: "#22c55e" }}>✓ {language.t("console.wecomApp.verified")}</strong>
        </div>
      </Show>

      <Show when={props.channel.lastError}>
        <div class={sx.notifField}>
          <strong style={{ color: "#ef4444" }}>{language.t("console.wecomApp.error")}:</strong>{" "}
          <span style={{ flex: 1, "min-width": "0", "font-size": "12px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", color: "#ef4444" }}>
            {props.channel.lastError}
          </span>
        </div>
      </Show>

      <div class={cn(sx.dashFoot, "gap-1 [&>button]:cursor-pointer")}>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer transition-colors hover:opacity-80"
          style={{ background: !props.channel.enabled || testing() ? "var(--native-muted)" : "var(--native-primary)", opacity: (!props.channel.enabled || testing()) ? 0.5 : 1 }}
          aria-label={testing() ? language.t("console.wecomApp.testing") : language.t("console.wecomApp.test")}
          title={testing() ? language.t("console.wecomApp.testing") : language.t("console.wecomApp.test")}
          disabled={!props.channel.enabled || testing()}
          onClick={handleTest}
        >
          <Icon name="bell" size="small" style={{ color: "white" }} />
        </button>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer text-[var(--native-muted)] transition-colors hover:bg-[var(--native-primary-soft)] hover:text-[var(--native-foreground)]"
          aria-label={language.t("common.edit")}
          title={language.t("common.edit")}
          onClick={() => props.onEdit(props.channel)}
        >
          <Icon name="edit" size="small" />
        </button>
        <button
          type="button"
          class="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer text-[var(--native-muted)] transition-colors"
          style={{ "background-color": "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)"
            e.currentTarget.querySelector("svg")?.style.setProperty("color", "#ef4444")
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = ""
            e.currentTarget.querySelector("svg")?.style.removeProperty("color")
          }}
          aria-label={language.t("common.delete")}
          title={language.t("common.delete")}
          onClick={() => void props.onRemove(props.channel.id)}
        >
          <Icon name="trash" size="small" />
        </button>
      </div>
    </div>
  )
}
