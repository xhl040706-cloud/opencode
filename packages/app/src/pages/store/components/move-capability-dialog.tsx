import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { itemApi, repoApi, registryApi2, type CapabilityItem, type Repository } from "../lib/api"

type MoveCapabilityDialogProps = {
  item: CapabilityItem
  userId: string
  username?: string
  repositories: Repository[]
  onMoved?: (item: CapabilityItem) => void
}

type NamespaceOption = {
  value: string
  label: string
  hint: string
  visibility: "public" | "private" | "repo"
}

const inputClass =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none focus:border-border-strong"

export function MoveCapabilityDialog(props: MoveCapabilityDialogProps) {
  const dialog = useDialog()
  const language = useLanguage()
  const [store, setStore] = createStore({
    namespace: props.item.registry?.repoId
      ? `repo:${props.item.registry.repoId}`
      : "public",
    saving: false,
    error: "",
  })

  const namespaceOptions = createMemo<NamespaceOption[]>(() => {
    const options: NamespaceOption[] = [
      {
        value: "public",
        label: language.t("store.capabilityDialog.namespace.publicLabel"),
        hint: language.t("store.capabilityDialog.namespace.publicDescription"),
        visibility: "public",
      },
    ]
    // if (props.username) {
    //   options.push({
    //     value: "personal",
    //     label: `@${props.username}`,
    //     hint: language.t("store.capabilityDialog.namespace.personalDescription"),
    //     visibility: "private",
    //   })
    // }
    for (const repo of props.repositories) {
      options.push({
        value: `repo:${repo.id}`,
        label: `@${repo.displayName || repo.name}`,
        hint: language.t("store.capabilityDialog.namespace.repositoryDescription"),
        visibility: "repo",
      })
    }
    return options
  })

  const selectedNamespace = createMemo(
    () => namespaceOptions().find((option) => option.value === store.namespace) ?? namespaceOptions()[0],
  )

  const currentLocation = createMemo(() => {
    if (props.item.registry?.repoId) {
      const repo = props.repositories.find((item) => item.id === props.item.registry?.repoId)
      return `@${repo?.displayName || repo?.name || props.item.registry?.name || props.item.registry?.repoId}`
    }
    if (props.item.visibility === "private" && props.username) return `@${props.username}`
    return "public"
  })

  async function resolveRegistryId() {
    const namespace = selectedNamespace()?.value
    if (namespace === "public") return (await registryApi2.getPublic()).id
    if (namespace?.startsWith("repo:")) return (await repoApi.getRegistry(namespace.slice(5))).id
    return props.item.registryId
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    setStore("saving", true)
    setStore("error", "")
    try {
      const registryId = await resolveRegistryId()
      const updated = await itemApi.update(props.item.id, {
        registryId,
        visibility: selectedNamespace()?.visibility,
      })
      props.onMoved?.(updated)
      showToast({ title: language.t("store.capabilityDialog.toast.moved") })
      dialog.close()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStore("error", message)
      showToast({ title: language.t("store.capabilityDialog.toast.moveFailed"), description: message })
    } finally {
      setStore("saving", false)
    }
  }

  return (
    <Dialog title={language.t("store.capabilityDialog.move.title")} class="w-full max-w-[640px] mx-auto">
      <form onSubmit={handleSubmit} class="flex max-h-[calc(100vh-120px)] flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-6 pb-6 pt-2 space-y-4">
          <div class="rounded-xl border border-border-weak-base bg-surface-raised-base p-4 space-y-4">
            <div>
              <div class="text-12-medium text-text-strong">{language.t("store.capabilityDialog.move.currentCapability")}</div>
              <div class="mt-2 flex items-center gap-2 text-sm text-text-strong">
                <span>{props.item.name}</span>
                <span class="text-text-weak">/</span>
                <span class="font-mono text-text-weak">{props.item.slug}</span>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <div class="rounded-lg border border-border-weak-base bg-background-base px-3 py-3">
                <div class="text-12-medium text-text-strong">{language.t("store.capabilityDialog.move.currentRepository")}</div>
                <div class="mt-1 text-sm text-text-weak">{currentLocation()}</div>
              </div>
              <div class="flex justify-center text-icon-weak-base">
                <Icon name="chevron-right" size="small" />
              </div>
              <div>
                <label class="mb-2 block text-12-medium text-text-strong">
                  {language.t("store.capabilityDialog.move.targetRepository")} <span class="text-icon-info-base">*</span>
                </label>
                <select
                  value={store.namespace}
                  onInput={(e) => setStore("namespace", e.currentTarget.value)}
                  class={inputClass}
                >
                  {namespaceOptions().map((option) => (
                    <option value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p class="mt-2 text-12-regular text-text-weak">{selectedNamespace()?.hint}</p>
              </div>
            </div>
          </div>

          {store.error ? <p class="text-12-regular text-icon-critical-base">{store.error}</p> : null}
        </div>

        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-border-weak-base bg-surface-base px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button type="submit" disabled={store.saving}>
            {store.saving ? language.t("store.capabilityDialog.move.submitting") : language.t("store.capabilityDialog.move.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
