import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { createStore } from "solid-js/store"
import { repoApi, type Repository } from "../lib/api"

const inputClass =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none focus:border-border-strong"

const textAreaClass =
  "w-full min-h-[84px] rounded-md border border-border-weak-base bg-background-base px-3 py-2 text-sm text-text-strong outline-none focus:border-border-strong resize-y"

type EditRepoDialogProps = {
  repo: Repository
  onSaved?: (repo: Repository) => void
}

export function EditRepoDialog(props: EditRepoDialogProps) {
  const dialog = useDialog()
  const language = useLanguage()
  const [store, setStore] = createStore({
    name: props.repo.name,
    displayName: props.repo.displayName || props.repo.name,
    description: props.repo.description || "",
    visibility: props.repo.visibility,
    saving: false,
    error: "",
  })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!store.name.trim()) return

    setStore("saving", true)
    setStore("error", "")

    try {
      const updated = await repoApi.update(props.repo.id, {
        name: store.name.trim(),
        displayName: store.displayName.trim() || store.name.trim(),
        description: store.description.trim(),
        visibility: store.visibility,
      })
      props.onSaved?.(updated)
      showToast({ title: language.t("store.repoDialog.toast.updated") })
      dialog.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStore("error", message)
      showToast({ title: language.t("store.repoDialog.toast.updateFailed"), description: message })
    } finally {
      setStore("saving", false)
    }
  }

  return (
    <Dialog title={language.t("store.repoDialog.edit.title")} class="w-full max-w-[640px] mx-auto">
      <form onSubmit={handleSubmit} class="flex max-h-[calc(100vh-120px)] flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-6 pb-6 pt-2 space-y-4">
          <div>
            <label class="mb-2 block text-12-medium text-text-strong">
              {language.t("store.repoDialog.field.name")}
            </label>
            <input
              autofocus
              value={store.name}
              onInput={(e) => setStore("name", e.currentTarget.value)}
              class={inputClass}
              required
            />
          </div>

          <div>
            <label class="mb-2 block text-12-medium text-text-strong">
              {language.t("store.repoDialog.field.displayName")}
            </label>
            <input
              value={store.displayName}
              onInput={(e) => setStore("displayName", e.currentTarget.value)}
              class={inputClass}
            />
          </div>

          <div>
            <label class="mb-2 block text-12-medium text-text-strong">
              {language.t("store.repoDialog.field.description")}
            </label>
            <textarea
              value={store.description}
              onInput={(e) => setStore("description", e.currentTarget.value)}
              class={textAreaClass}
            />
          </div>

          <div>
            <label class="mb-2 block text-12-medium text-text-strong">
              {language.t("store.repoDialog.field.visibility")}
            </label>
            <select
              value={store.visibility}
              onInput={(e) => setStore("visibility", e.currentTarget.value as "public" | "private")}
              class={inputClass}
            >
              <option value="private">{language.t("store.capabilityDialog.visibility.private")}</option>
              <option value="public">{language.t("store.capabilityDialog.visibility.public")}</option>
            </select>
          </div>

          {store.error ? <p class="text-12-regular text-icon-critical-base">{store.error}</p> : null}
        </div>

        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-border-weak-base bg-surface-base px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button type="submit" disabled={store.saving || !store.name.trim()}>
            {store.saving ? language.t("common.saving") : language.t("store.capabilityDialog.edit.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
