import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { adminNotificationChannelApi, type SystemNotificationChannel } from "@/pages/store/lib/api"

// Backend sender.Get() currently registers these channel types
// (server/internal/notification/service.go). The type is immutable after create
// (only name/enabled/systemConfig are updatable), so the selector is create-only.
const CHANNEL_TYPES = ["wecom", "webhook"] as const

type Props = {
  mode: "create" | "edit"
  channel?: SystemNotificationChannel
  onSaved: () => void
}

export function ChannelFormDialog(props: Props) {
  const dialog = useDialog()
  const language = useLanguage()

  const [store, setStore] = createStore({
    type: props.channel?.type ?? CHANNEL_TYPES[0],
    name: props.channel?.name ?? "",
    // systemConfig is free-form JSON; edit as raw text and validate on submit.
    config: props.channel?.systemConfig ? JSON.stringify(props.channel.systemConfig, null, 2) : "{}",
    enabled: props.channel?.enabled ?? true,
    saving: false,
  })

  function parseConfig(): Record<string, unknown> | null {
    const raw = store.config.trim()
    if (!raw) return {}
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
      return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const name = store.name.trim()
    if (!name) {
      showToast({ variant: "error", title: language.t("admin.ops.channels.toast.nameRequired") })
      return
    }
    const config = parseConfig()
    if (config === null) {
      showToast({ variant: "error", title: language.t("admin.ops.channels.toast.configInvalid") })
      return
    }

    setStore("saving", true)
    try {
      if (props.mode === "edit" && props.channel) {
        await adminNotificationChannelApi.update(props.channel.id, {
          name,
          enabled: store.enabled,
          systemConfig: config,
        })
      } else {
        await adminNotificationChannelApi.create({
          type: store.type,
          name,
          systemConfig: config,
        })
      }
      showToast({
        variant: "success",
        title: language.t(
          props.mode === "edit" ? "admin.ops.channels.toast.updateSuccess" : "admin.ops.channels.toast.createSuccess",
        ),
      })
      props.onSaved()
      dialog.close()
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.ops.channels.toast.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
      setStore("saving", false)
    }
  }

  return (
    <Dialog
      title={language.t(
        props.mode === "edit" ? "admin.ops.channels.dialog.editTitle" : "admin.ops.channels.dialog.createTitle",
      )}
      class="w-full max-w-[480px] mx-auto"
    >
      <form onSubmit={handleSubmit} class="flex flex-col gap-6 p-6 pt-0">
        <div class="flex flex-col gap-4">
          <Show when={props.mode === "create"}>
            <div class="flex flex-col gap-1.5">
              <label
                for="admin-channel-type"
                class="text-12-medium text-text-weak"
              >
                {language.t("admin.ops.channels.form.type")}
              </label>
              <select
                id="admin-channel-type"
                class="h-9 cursor-pointer rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 text-sm text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                value={store.type}
                onChange={(e) => setStore("type", e.currentTarget.value)}
              >
                {CHANNEL_TYPES.map((t) => (
                  <option value={t}>{language.t(`admin.ops.channels.type.${t}` as "admin.ops.channels.type.wecom")}</option>
                ))}
              </select>
            </div>
          </Show>
          <Show when={props.mode === "edit"}>
            <div class="flex flex-col gap-1.5">
              <span class="text-12-medium text-text-weak">{language.t("admin.ops.channels.form.type")}</span>
              <span class="text-sm text-[var(--native-foreground)]">
                {language.t(`admin.ops.channels.type.${store.type}` as "admin.ops.channels.type.wecom")}
              </span>
            </div>
          </Show>

          <TextField
            autofocus
            type="text"
            label={language.t("admin.ops.channels.form.name")}
            placeholder={language.t("admin.ops.channels.form.namePlaceholder")}
            value={store.name}
            onChange={(v) => setStore("name", v)}
          />

          <TextField
            multiline
            label={language.t("admin.ops.channels.form.config")}
            description={language.t("admin.ops.channels.form.configHint")}
            placeholder='{"key":"value"}'
            value={store.config}
            onChange={(v) => setStore("config", v)}
            class="max-h-40 w-full overflow-y-auto font-mono text-xs"
          />

          <Show when={props.mode === "edit"}>
            <label class="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                class="size-4 cursor-pointer accent-[var(--native-primary)]"
                checked={store.enabled}
                onChange={(e) => setStore("enabled", e.currentTarget.checked)}
              />
              <span class="text-sm text-[var(--native-foreground)]">{language.t("admin.ops.channels.form.enabled")}</span>
            </label>
          </Show>
        </div>

        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="large" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" size="large" disabled={store.saving}>
            {store.saving ? language.t("common.saving") : language.t("common.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
