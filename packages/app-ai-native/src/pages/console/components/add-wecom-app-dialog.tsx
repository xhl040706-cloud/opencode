import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { Modal } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { channelService, type WeComAppConfig } from "../lib/channel-service"

type AddWecomAppDialogProps = {
  onCreated: (config: { name: string; config: WeComAppConfig }) => Promise<void> | void
}

export function AddWecomAppDialog(props: AddWecomAppDialogProps) {
  const dialog = useDialog()
  const language = useLanguage()
  const [form, setForm] = createStore({
    name: "",
    userId: "",
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
      await props.onCreated({
        name: form.name.trim(),
        config: {
          userId: form.userId.trim(),
        },
      })
      dialog.close()
    } finally {
      setForm("saving", false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title={language.t("console.wecomApp.dialog.addTitle")}
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
              {form.saving
                ? language.t("console.wecomApp.dialog.adding")
                : language.t("console.wecomApp.dialog.confirmAdd")}
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
            <p class="modal-hint">
              {language.t("console.wecomApp.dialog.nameHint")}
            </p>
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
        </div>

        {form.error && <p class="modal-error">{form.error}</p>}
      </Modal>
    </form>
  )
}
