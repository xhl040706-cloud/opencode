import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { Modal } from "@/components/modal"
import { Button } from "@/components/ui/button"
import type { WeComAppChannel } from "../lib/channel-service"
import type { WeComAppConfig } from "../lib/channel-service"

type EditWecomAppDialogProps = {
  channel: WeComAppChannel
  onSaved: (id: string, patch: Partial<{ name: string; config: WeComAppConfig; enabled: boolean }>) => Promise<void> | void
}

export function EditWecomAppDialog(props: EditWecomAppDialogProps) {
  const dialog = useDialog()
  const language = useLanguage()
  const [form, setForm] = createStore({
    name: props.channel.name,
    userId: props.channel.config.userId,
    enabled: props.channel.enabled,
    error: "",
    saving: false,
  })

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setForm("error", language.t("console.wecomApp.dialog.error.nameRequired"))
      return
    }
    if (!form.userId.trim()) {
      setForm("error", language.t("console.wecomApp.dialog.error.userIdRequired"))
      return
    }
    setForm("error", "")
    setForm("saving", true)
    try {
      const patch: Partial<{ name: string; config: WeComAppConfig; enabled: boolean }> = {}
      if (form.name.trim() !== props.channel.name) {
        patch.name = form.name.trim()
      }
      if (form.userId.trim() !== props.channel.config.userId) {
        patch.config = { userId: form.userId.trim() }
      }
      if (form.enabled !== props.channel.enabled) {
        patch.enabled = form.enabled
      }
      await props.onSaved(props.channel.id, patch)
      dialog.close()
    } finally {
      setForm("saving", false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title={language.t("console.wecomApp.dialog.editTitle")}
        maxWidth="480px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => dialog.close()}
            >
              {language.t("common.cancel")}
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={form.saving}
            >
              {form.saving ? language.t("common.saving") : language.t("common.save")}
            </Button>
          </>
        }
      >
        <div class="modal-section">
          <div class="modal-field">
            <label class="modal-label">
              {language.t("console.wecomApp.dialog.name")} <span class="req">*</span>
            </label>
            <input
              autofocus
              value={form.name}
              onInput={(e) => setForm("name", e.currentTarget.value)}
              placeholder={language.t("console.wecomApp.dialog.namePlaceholder")}
              class="modal-input"
            />
          </div>
          <div class="modal-field">
            <label class="modal-label">
              {language.t("console.wecomApp.dialog.userId")} <span class="req">*</span>
            </label>
            <input
              value={form.userId}
              onInput={(e) => setForm("userId", e.currentTarget.value)}
              placeholder={language.t("console.wecomApp.dialog.userIdPlaceholder")}
              class="modal-input"
              autocomplete="off"
            />
            <p class="modal-hint">
              {language.t("console.wecomApp.dialog.userIdHint")}
            </p>
          </div>
          <div class="modal-field">
            <label class="modal-checkbox">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm("enabled", e.currentTarget.checked)}
              />
              {language.t("console.wecomApp.dialog.enabled")}
            </label>
          </div>
        </div>

        {form.error && <p class="modal-error">{form.error}</p>}
      </Modal>
    </form>
  )
}
