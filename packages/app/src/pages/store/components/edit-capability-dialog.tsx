import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { itemApi, type CapabilityItem } from "../lib/api"

const CATEGORIES = [
  "developer-tools",
  "database",
  "file-system",
  "cloud-infrastructure",
  "productivity",
  "ai-task-management",
  "web-search",
  "browser-automation",
  "version-control",
  "api-development",
  "utilities",
  "other",
] as const

const inputClass =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none focus:border-border-strong"

const textAreaClass =
  "w-full rounded-md border border-border-weak-base bg-background-base px-3 py-2 text-sm text-text-strong outline-none focus:border-border-strong resize-y"

const TYPE_LABEL: Record<string, string> = {
  skill: "store.capability.type.skill",
  subagent: "store.capability.type.subagent",
  command: "store.capability.type.command",
  mcp: "store.capability.type.mcp",
}

const CATEGORY_LABEL: Record<string, string> = {
  "developer-tools": "store.capability.category.developerTools",
  database: "store.capability.category.database",
  "file-system": "store.capability.category.fileSystem",
  "cloud-infrastructure": "store.capability.category.cloudInfrastructure",
  productivity: "store.capability.category.productivity",
  "ai-task-management": "store.capability.category.aiTaskManagement",
  "web-search": "store.capability.category.webSearch",
  "browser-automation": "store.capability.category.browserAutomation",
  "version-control": "store.capability.category.versionControl",
  "api-development": "store.capability.category.apiDevelopment",
  utilities: "store.capability.category.utilities",
  other: "store.capability.category.other",
}

type EditCapabilityDialogProps = {
  item: CapabilityItem
  onSaved?: (item: CapabilityItem) => void
}

export function EditCapabilityDialog(props: EditCapabilityDialogProps) {
  const dialog = useDialog()
  const language = useLanguage()
  const [store, setStore] = createStore({
    name: props.item.name,
    description: props.item.description || "",
    category: props.item.category || "utilities",
    visibility: props.item.visibility || "public",
    content: props.item.content || "",
    saving: false,
    error: "",
  })

  const typeLabel = createMemo(() => language.t(TYPE_LABEL[props.item.itemType] ?? props.item.itemType))
  const categoryLabel = (category: string) => language.t(CATEGORY_LABEL[category] ?? category)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!store.name.trim()) return

    setStore("saving", true)
    setStore("error", "")

    try {
      const updated = await itemApi.update(props.item.id, {
        name: store.name.trim(),
        description: store.description.trim(),
        category: store.category,
        visibility: store.visibility,
        content: store.content,
      })
      props.onSaved?.(updated)
      showToast({ title: language.t("store.capabilityDialog.toast.updated", { type: typeLabel() }) })
      dialog.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStore("error", message)
      showToast({
        title: language.t("store.capabilityDialog.toast.updateFailed", { type: typeLabel() }),
        description: message,
      })
    } finally {
      setStore("saving", false)
    }
  }

  return (
    <Dialog
      title={language.t("store.capabilityDialog.edit.title", { type: typeLabel() })}
      class="w-full max-w-[760px] mx-auto"
    >
      <form onSubmit={handleSubmit} class="flex max-h-[calc(100vh-120px)] flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-6 pb-6 pt-2 space-y-4">
          <div>
            <label class="mb-2 block text-12-medium text-text-strong">
              {language.t("store.capabilityDialog.field.displayName")}
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
              {language.t("store.capabilityDialog.field.description")}
            </label>
            <input
              value={store.description}
              onInput={(e) => setStore("description", e.currentTarget.value)}
              class={inputClass}
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-12-medium text-text-strong">
                {language.t("store.capabilityDialog.field.category")}
              </label>
              <select
                value={store.category}
                onInput={(e) => setStore("category", e.currentTarget.value)}
                class={inputClass}
              >
                {CATEGORIES.map((category) => (
                  <option value={category}>{categoryLabel(category)}</option>
                ))}
              </select>
            </div>

            <div>
              <label class="mb-2 block text-12-medium text-text-strong">
                {language.t("store.capabilityDialog.field.visibility")}
              </label>
              <select
                value={store.visibility}
                onInput={(e) => setStore("visibility", e.currentTarget.value)}
                class={inputClass}
              >
                <option value="public">{language.t("store.capabilityDialog.visibility.public")}</option>
                <option value="private">{language.t("store.capabilityDialog.visibility.private")}</option>
                <option value="repo">{language.t("store.capabilityDialog.visibility.repository")}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-12-medium text-text-strong">
              {language.t("store.capabilityDialog.field.content")}
            </label>
            <textarea
              value={store.content}
              onInput={(e) => setStore("content", e.currentTarget.value)}
              rows={14}
              class={textAreaClass}
            />
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
