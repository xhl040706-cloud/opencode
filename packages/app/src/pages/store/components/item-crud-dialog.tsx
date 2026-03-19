import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Select } from "@opencode-ai/ui/select"
import { showToast } from "@opencode-ai/ui/toast"
import { createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useAuth } from "../hooks/use-auth"
import { useLanguage } from "@/context/language"
import { useRepoFilter } from "../context/repo-filter"
import { itemApi, repoApi, registryApi, registryApi2 } from "../lib/api"

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

const TYPE_PREFIX: Record<string, string> = {
  skill: "skill-",
  subagent: "agent-",
  command: "cmd-",
  mcp: "mcp-",
}

const TYPE_CONTENT_PLACEHOLDER: Record<string, string> = {
  skill: "# Skill Instructions\n\nDescribe what this skill does...",
  subagent: "# Subagent\n\nDescribe the subagent behavior...",
  command: "# Command\n\nDescribe the command behavior...",
  mcp: "# MCP Server\n\nDescribe the MCP server...",
}

const TYPE_LABEL: Record<string, string> = {
  skill: "store.capability.type.skill",
  subagent: "store.capability.type.subagent",
  command: "store.capability.type.command",
  mcp: "store.capability.type.mcp",
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

type NamespaceOption = {
  value: string
  label: string
  sublabel: string
  visibility: "public" | "private" | "repo"
}

type ItemCrudDialogProps = {
  itemType: "skill" | "subagent" | "command" | "mcp"
  onCreated?: () => void
}

const inputClass =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none transition-colors focus:border-border-strong"

const textAreaClass =
  "w-full rounded-md border border-border-weak-base bg-background-base px-3 py-2 text-sm font-mono text-text-strong outline-none transition-colors focus:border-border-strong resize-y"

export function ItemCrudDialog(props: ItemCrudDialogProps) {
  const dialog = useDialog()
  const { user } = useAuth()
  const { selectedRepo } = useRepoFilter()
  const language = useLanguage()

  const currentUser = createMemo(() => user())
  const typeLabel = createMemo(() => language.t(TYPE_LABEL[props.itemType] ?? props.itemType))
  const slugPrefix = createMemo(() => TYPE_PREFIX[props.itemType] ?? "")

  const [store, setStore] = createStore({
    namespace: selectedRepo()?.id ? `repo:${selectedRepo()!.id}` : "public",
    name: "",
    slug: "",
    slugManual: false,
    description: "",
    category: "utilities",
    content: TYPE_CONTENT_PLACEHOLDER[props.itemType] ?? "",
    saving: false,
    error: "",
  })

  const namespaceOptions = createMemo<NamespaceOption[]>(() => {
    const options: NamespaceOption[] = [
      {
        value: "public",
        label: "public",
        sublabel: language.t("store.capabilityDialog.namespace.publicDescription"),
        visibility: "public",
      },
    ]
    const u = currentUser()
    const username = u?.preferred_username || u?.name
    if (u?.sub && username) {
      options.push({
        value: "personal",
        label: `@${username}`,
        sublabel: language.t("store.capabilityDialog.namespace.personalDescription"),
        visibility: "private",
      })
    }
    const repo = selectedRepo()
    if (repo) {
      options.push({
        value: `repo:${repo.id}`,
        label: `@${repo.displayName || repo.name}`,
        sublabel: language.t("store.capabilityDialog.namespace.repositoryDescription"),
        visibility: "repo",
      })
    }
    return options
  })

  const selectedNamespace = createMemo(
    () => namespaceOptions().find((option) => option.value === store.namespace) ?? namespaceOptions()[0],
  )

  const visibilityLabel = createMemo(() => {
    if (selectedNamespace()?.visibility === "private") return language.t("store.capabilityDialog.visibility.private")
    if (selectedNamespace()?.visibility === "repo") return language.t("store.capabilityDialog.visibility.repository")
    return language.t("store.capabilityDialog.visibility.public")
  })

  function handleNameInput(value: string) {
    setStore("name", value)
    if (!store.slugManual) setStore("slug", `${slugPrefix()}${slugify(value)}`)
  }

  async function resolveRegistryId() {
    const namespace = selectedNamespace()?.value
    const u = currentUser()

    if (namespace === "public") return (await registryApi2.getPublic()).id

    if (namespace === "personal") {
      if (!u?.sub) throw new Error("Please sign in first")
      const username = u.preferred_username || u.name
      return (await registryApi.ensurePersonal(u.sub, username)).id
    }

    if (namespace?.startsWith("repo:")) {
      return (await repoApi.getRegistry(namespace.slice(5))).id
    }

    return undefined
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const u = currentUser()
    if (!u?.sub) {
      setStore("error", language.t("store.itemCrud.signInRequired"))
      return
    }

    if (!store.name.trim() || !store.slug.trim()) return

    setStore("saving", true)
    setStore("error", "")

    try {
      const registryId = await resolveRegistryId()
      await itemApi.createDirect({
        itemType: props.itemType,
        name: store.name.trim(),
        slug: store.slug.trim(),
        description: store.description.trim(),
        category: store.category,
        content: store.content.trim(),
        visibility: selectedNamespace()?.visibility,
        registryId,
        createdBy: u.sub,
      })
      showToast({ title: language.t("store.capabilityDialog.toast.created", { type: typeLabel() }) })
      props.onCreated?.()
      dialog.close()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStore("error", message)
      showToast({
        title: language.t("store.capabilityDialog.toast.createFailed", { type: typeLabel() }),
        description: message,
      })
    } finally {
      setStore("saving", false)
    }
  }

  return (
    <Dialog title={language.t("store.itemCrud.title", { type: typeLabel() })} class="mx-auto w-full max-w-[760px]">
      <form onSubmit={handleSubmit} class="flex max-h-[calc(100vh-96px)] flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto px-6 pb-6 pt-3">
          <div class="mb-4 px-1">
            <p class="text-13-medium text-text-strong">
              {language.t("store.itemCrud.subtitle", { type: typeLabel() })}
            </p>
            <p class="mt-1 text-12-regular text-text-weak">{language.t("store.itemCrud.description")}</p>
          </div>

          <div class="overflow-hidden rounded-2xl border border-border-weak-base bg-surface-raised-base">
            <div class="border-b border-border-weak-base px-5 py-5">
              <div class="flex items-center gap-1 text-14-medium text-text-strong">
                <span>{language.t("store.capabilityDialog.field.ownerPackage")}</span>
                <span class="text-icon-info-base">*</span>
              </div>
              <div class="mt-1 text-12-regular text-text-weak">{language.t("store.itemCrud.namespaceDescription")}</div>
              <div class="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
                <div>
                  <Select
                    options={namespaceOptions()}
                    current={selectedNamespace()}
                    value={(option) => option.value}
                    label={(option) => option.label}
                    onSelect={(option) => option && setStore("namespace", option.value)}
                    variant="secondary"
                    size="small"
                    triggerVariant="settings"
                  />
                </div>
                <input
                  value={store.slug}
                  onInput={(e) => {
                    setStore("slug", e.currentTarget.value)
                    setStore("slugManual", true)
                  }}
                  placeholder={`${slugPrefix()}my-${props.itemType}`}
                  class={`${inputClass} font-mono`}
                  required
                />
              </div>
              <p class="mt-3 text-12-regular text-text-weak">
                {language.t("store.itemCrud.fullIdentifier")}{" "}
                {(selectedNamespace()?.label ?? "public") + "/" + (store.slug || `${slugPrefix()}my-${props.itemType}`)}
              </p>
            </div>

            <div class="border-b border-border-weak-base px-5 py-5">
              <label class="mb-2 flex items-center gap-1 text-12-medium text-text-strong">
                <span>{language.t("store.capabilityDialog.field.displayName")}</span>
                <span class="text-icon-info-base">*</span>
              </label>
              <input
                autofocus
                value={store.name}
                onInput={(e) => handleNameInput(e.currentTarget.value)}
                placeholder={language.t("store.capabilityDialog.field.displayNamePlaceholder", { type: typeLabel() })}
                class={inputClass}
                required
              />
            </div>

            <div class="border-b border-border-weak-base px-5 py-5">
              <label class="mb-2 block text-12-medium text-text-strong">
                {language.t("store.capabilityDialog.field.description")}
              </label>
              <input
                value={store.description}
                onInput={(e) => setStore("description", e.currentTarget.value)}
                placeholder={language.t("store.itemCrud.descriptionPlaceholder", { type: typeLabel() })}
                class={inputClass}
              />
            </div>

            <div class="grid gap-5 border-b border-border-weak-base px-5 py-5 md:grid-cols-2">
              <div>
                <label class="mb-2 flex items-center gap-1 text-12-medium text-text-strong">
                  <span>{language.t("store.capabilityDialog.field.category")}</span>
                  <span class="text-icon-info-base">*</span>
                </label>
                <Select
                  options={[...CATEGORIES]}
                  current={store.category}
                  label={(option) => option}
                  onSelect={(option) => option && setStore("category", option)}
                  variant="secondary"
                  size="small"
                  triggerVariant="settings"
                />
                <p class="mt-2 text-12-regular text-text-weak">{language.t("store.itemCrud.categoryHint")}</p>
              </div>

              <div>
                <label class="mb-2 block text-12-medium text-text-strong">
                  {language.t("store.capabilityDialog.field.visibility")}
                </label>
                <div class="flex h-9 items-center rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-weak">
                  {visibilityLabel()}
                </div>
                <p class="mt-2 text-12-regular text-text-weak">{language.t("store.itemCrud.visibilityHint")}</p>
              </div>
            </div>

            <div class="px-5 py-5">
              <label class="mb-2 block text-12-medium text-text-strong">
                {language.t("store.capabilityDialog.field.content")}
              </label>
              <textarea
                value={store.content}
                onInput={(e) => setStore("content", e.currentTarget.value)}
                rows={10}
                class={textAreaClass}
              />
            </div>
          </div>

          {store.error ? <p class="mt-4 px-1 text-12-regular text-icon-critical-base">{store.error}</p> : null}
        </div>

        <div class="flex shrink-0 items-center justify-between gap-3 border-t border-border-weak-base bg-surface-base px-6 py-4">
          <p class="text-12-regular text-text-weak">{language.t("store.itemCrud.publishHint")}</p>
          <div class="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => dialog.close()}>
              {language.t("common.cancel")}
            </Button>
            <Button type="submit" disabled={store.saving || !store.name.trim() || !store.slug.trim()}>
              {store.saving
                ? language.t("store.capabilityDialog.create.submitting")
                : language.t("store.itemCrud.submit", { type: typeLabel() })}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

export function CreateSkillDialog(props: { onCreated?: () => void }) {
  return <ItemCrudDialog itemType="skill" onCreated={props.onCreated} />
}
