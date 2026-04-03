import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { projectsApi } from "../lib/project-api"
import type { Project } from "../lib/project-types"

const inputClass =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none focus:border-border-strong"

const textAreaClass =
  "w-full min-h-[96px] rounded-md border border-border-weak-base bg-background-base px-3 py-2 text-sm text-text-strong outline-none focus:border-border-strong resize-y"

type Props = {
  onCreated?: (project: Project) => void
}

export default function CreateProjectDialog(props: Props) {
  const dialog = useDialog()
  const language = useLanguage()
  const [store, setStore] = createStore({
    name: "",
    description: "",
    saving: false,
    error: "",
  })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!store.name.trim()) return

    setStore("saving", true)
    setStore("error", "")

    try {
      const res = await projectsApi.create({
        name: store.name.trim(),
        description: store.description.trim(),
      })
      showToast({
        variant: "success",
        title: language.t("projects.createDialog.toast.success"),
      })
      props.onCreated?.(res.project)
      dialog.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStore("error", message)
      showToast({
        variant: "error",
        title: language.t("projects.createDialog.toast.failed"),
        description: message,
      })
    } finally {
      setStore("saving", false)
    }
  }

  return (
    <Dialog title={language.t("projects.createDialog.title")} class="w-full max-w-[640px] mx-auto">
      <form onSubmit={handleSubmit} class="flex max-h-[calc(100vh-40px)] flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          <div class="rounded-xl border border-border-weak-base bg-surface-raised-base">
            <div class="border-b border-border-weak-base px-4 py-4">
              <div class="text-14-medium text-text-strong">{language.t("projects.createDialog.info")}</div>
              <div class="mt-1 text-12-regular text-text-weak">{language.t("projects.createDialog.infoDescription")}</div>
            </div>

            <div class="grid gap-4 px-4 py-4">
              <div>
                <label class="mb-2 block text-12-medium text-text-strong">
                  {language.t("projects.createDialog.field.name")} <span class="text-icon-info-base">*</span>
                </label>
                <input
                  autofocus
                  value={store.name}
                  onInput={(e) => setStore("name", e.currentTarget.value)}
                  placeholder={language.t("projects.createDialog.field.namePlaceholder")}
                  class={inputClass}
                  required
                />
              </div>

              <div>
                <label class="mb-2 block text-12-medium text-text-strong">
                  {language.t("projects.createDialog.field.description")}
                </label>
                <textarea
                  value={store.description}
                  onInput={(e) => setStore("description", e.currentTarget.value)}
                  placeholder={language.t("projects.createDialog.field.descriptionPlaceholder")}
                  class={textAreaClass}
                />
              </div>
            </div>
          </div>

          {store.error ? <div class="mt-4 text-sm text-red-500">{store.error}</div> : null}
        </div>

        <div class="flex items-center justify-end gap-2 border-t border-border-weak-base px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button type="submit" loading={store.saving} disabled={!store.name.trim() || store.saving}>
            {language.t("projects.createDialog.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
