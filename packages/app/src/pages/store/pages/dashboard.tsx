import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { createEffect, createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useAuth } from "../hooks/use-auth"
import { getLoginUrl } from "../lib/auth"
import {
  itemApi,
  repoApi,
  registryApi,
  type CapabilityItem,
  type CapabilityRegistry,
  type Repository,
} from "../lib/api"
import { CreateRepoDialog } from "../components/create-repo-dialog"
import { CreateCapabilityDialog } from "../components/create-capability-dialog"
import { EditCapabilityDialog } from "../components/edit-capability-dialog"
import { EditRepoDialog } from "../components/edit-repo-dialog"
import { RepoSyncTab } from "../components/repo-sync-tab"

const ITEM_TYPE_COLORS: Record<string, string> = {
  skill: "bg-surface-info-base/20 text-text-info-base",
  subagent: "bg-surface-warning-base/20 text-text-warning-base",
  command: "bg-surface-success-base/20 text-text-success-base",
  mcp: "bg-surface-selected-base/40 text-text-strong",
}

const ITEM_TYPE_LABEL: Record<string, string> = {
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

export default function Dashboard() {
  const dialog = useDialog()
  const language = useLanguage()
  const { user, loading } = useAuth()
  const [state, setState] = createStore({
    repos: [] as Repository[],
    items: [] as CapabilityItem[],
    personalRegistry: null as CapabilityRegistry | null,
    loadingRepos: false,
    loadingItems: false,
    itemTypeFilter: "all",
    expandedSyncRepo: null as string | null,
  })

  const userId = createMemo(() => user()?.sub ?? "")
  const username = createMemo(() => user()?.preferred_username || user()?.name || "")

  const loadRepos = async () => {
    if (!userId()) return
    setState("loadingRepos", true)
    try {
      const res = await repoApi.listMy(userId())
      setState("repos", res.repositories ?? [])
    } catch (error) {
      showToast({
        title: language.t("store.console.repositories.toast.loadFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setState("loadingRepos", false)
    }
  }

  const loadItems = async () => {
    if (!userId()) return
    setState("loadingItems", true)
    try {
      const res = await itemApi.listMy(userId())
      setState("items", res.items ?? [])
    } catch (error) {
      showToast({
        title: language.t("store.console.capabilities.toast.loadFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setState("loadingItems", false)
    }
  }

  const ensureRegistry = async () => {
    if (!userId()) return
    try {
      const registry = await registryApi.ensurePersonal(userId(), username())
      setState("personalRegistry", registry)
    } catch {}
  }

  createEffect(() => {
    if (!userId()) return
    void loadRepos()
    void loadItems()
    void ensureRegistry()
  })

  const filteredItems = createMemo(() =>
    state.itemTypeFilter === "all" ? state.items : state.items.filter((item) => item.itemType === state.itemTypeFilter),
  )

  const publicRepoCount = createMemo(() => state.repos.filter((repo) => repo.visibility === "public").length)
  const syncRepoCount = createMemo(() => state.repos.filter((repo) => repo.repoType === "sync").length)
  const totalCapabilityCount = createMemo(() => state.items.length)
  const visibleCapabilityCount = createMemo(() => filteredItems().length)

  const openCreateRepo = () => {
    if (!userId()) return
    dialog.show(() => (
      <CreateRepoDialog userId={userId()} onCreated={(repo) => setState("repos", (items) => [repo, ...items])} />
    ))
  }

  const openCreateCapability = () => {
    if (!userId()) return
    dialog.show(() => (
      <CreateCapabilityDialog
        userId={userId()}
        username={username()}
        repositories={state.repos}
        onCreated={(item) => setState("items", (items) => [item, ...items])}
      />
    ))
  }

  const openEditRepo = (repo: Repository) => {
    dialog.show(() => (
      <EditRepoDialog
        repo={repo}
        onSaved={(updated) =>
          setState("repos", (items) => items.map((item) => (item.id === updated.id ? updated : item)))
        }
      />
    ))
  }

  const openEditCapability = (item: CapabilityItem) => {
    dialog.show(() => (
      <EditCapabilityDialog
        item={item}
        onSaved={(updated) =>
          setState("items", (items) => items.map((current) => (current.id === updated.id ? updated : current)))
        }
      />
    ))
  }

  const handleDeleteRepo = async (id: string) => {
    if (!window.confirm(language.t("store.console.confirmDeleteRepository"))) return
    try {
      await repoApi.delete(id)
      setState("repos", (items) => items.filter((item) => item.id !== id))
      showToast({ title: language.t("store.console.repositories.toast.deleteSuccess") })
    } catch (error) {
      showToast({
        title: language.t("store.console.repositories.toast.deleteFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm(language.t("store.console.confirmDeleteCapability"))) return
    try {
      await itemApi.delete(id)
      setState("items", (items) => items.filter((item) => item.id !== id))
      showToast({ title: language.t("store.console.capabilities.toast.deleteSuccess") })
    } catch (error) {
      showToast({
        title: language.t("store.console.capabilities.toast.deleteFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const typeLabel = (type: string) => {
    if (type in ITEM_TYPE_LABEL) return language.t(ITEM_TYPE_LABEL[type])
    return type
  }

  const categoryLabel = (category?: string | null) => {
    if (!category) return "—"
    if (category in CATEGORY_LABEL) return language.t(CATEGORY_LABEL[category])
    return category
  }

  const visibilityLabel = (visibility?: string | null) => {
    if (!visibility || visibility === "public") return language.t("store.capabilityDialog.visibility.public")
    if (visibility === "private") return language.t("store.capabilityDialog.visibility.private")
    if (visibility === "repo") return language.t("store.capabilityDialog.visibility.repository")
    return visibility
  }

  return (
    <div class="min-h-full px-6 py-6">
      <Show
        when={!loading()}
        fallback={<div class="flex justify-center py-16 text-text-weak">{language.t("store.loading")}</div>}
      >
        <Show
          when={user()}
          fallback={
            <div class="flex min-h-[60vh] items-center justify-center">
              <div class="rounded-xl border border-border-weak-base bg-surface-raised-base px-8 py-10 text-center">
                <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface-info-base/20 text-text-strong">
                  <Icon name="console" />
                </div>
                <h1 class="text-lg font-semibold text-text-strong">{language.t("store.console")}</h1>
                <p class="mt-2 text-sm text-text-weak">{language.t("store.console.authDescription")}</p>
                <a href={getLoginUrl("/store/dashboard")}>
                  <Button class="mt-4">{language.t("store.console.login")}</Button>
                </a>
              </div>
            </div>
          }
        >
          <div class="flex flex-col gap-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h1 class="text-2xl font-semibold text-text-strong">{language.t("store.console")}</h1>
                <p class="mt-1 text-sm text-text-weak">{language.t("store.console.manageDescription")}</p>
              </div>
              <div class="flex gap-2">
                <Button variant="ghost" onClick={openCreateRepo}>
                  <Icon name="plus" class="size-4" />
                  {language.t("store.console.repositories.create")}
                </Button>
                <Button onClick={openCreateCapability} disabled={!state.personalRegistry && state.repos.length === 0}>
                  <Icon name="plus" class="size-4" />
                  {language.t("store.console.capabilities.create")}
                </Button>
              </div>
            </div>

            <div class="flex flex-col gap-6">
              <section class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-5">
                <div class="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 class="text-lg font-semibold text-text-strong">
                      {language.t("store.console.repositories.title")}
                    </h2>
                    <p class="mt-1 text-sm text-text-weak">{language.t("store.console.repositories.description")}</p>
                  </div>
                  <Button size="small" variant="ghost" onClick={openCreateRepo}>
                    <Icon name="plus" class="size-4" />
                    {language.t("store.console.new")}
                  </Button>
                </div>

                <div class="mb-5 grid gap-3 sm:grid-cols-3">
                  <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
                    <div class="text-12-medium text-text-weak">{language.t("store.console.repositories.total")}</div>
                    <div class="mt-1 text-xl font-semibold text-text-strong">{state.repos.length}</div>
                  </div>
                  <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
                    <div class="text-12-medium text-text-weak">{language.t("store.console.repositories.public")}</div>
                    <div class="mt-1 text-xl font-semibold text-text-strong">{publicRepoCount()}</div>
                  </div>
                  <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
                    <div class="text-12-medium text-text-weak">{language.t("store.console.repositories.sync")}</div>
                    <div class="mt-1 text-xl font-semibold text-text-strong">{syncRepoCount()}</div>
                  </div>
                </div>

                <Show
                  when={!state.loadingRepos}
                  fallback={
                    <div class="text-sm text-text-weak">{language.t("store.console.repositories.loading")}</div>
                  }
                >
                  <Show
                    when={state.repos.length > 0}
                    fallback={
                      <div class="rounded-xl border border-dashed border-border-weak-base px-8 py-10 text-center text-sm text-text-weak">
                        {language.t("store.console.repositories.empty")}
                      </div>
                    }
                  >
                    <div class="space-y-4">
                      <For each={state.repos}>
                        {(repo) => (
                          <div class="rounded-xl border border-border-weak-base bg-surface-base p-4">
                            <div class="flex items-start justify-between gap-3">
                              <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                  <div class="truncate text-14-medium text-text-strong">
                                    {repo.displayName || repo.name}
                                  </div>
                                  <span class="rounded-full bg-surface-selected-base px-2 py-0.5 text-11-medium text-text-weak">
                                    {visibilityLabel(repo.visibility)}
                                  </span>
                                  <Show when={repo.repoType === "sync"}>
                                    <span class="rounded-full bg-surface-info-base/20 px-2 py-0.5 text-11-medium text-text-strong">
                                      {language.t("store.console.repositories.sync")}
                                    </span>
                                  </Show>
                                </div>
                                <div class="mt-1 truncate text-12-regular text-text-weak">{repo.name}</div>
                              </div>
                              <div class="flex items-center gap-1">
                                <Button
                                  size="small"
                                  variant="ghost"
                                  class="h-8 w-8 p-0"
                                  onClick={() => openEditRepo(repo)}
                                  title={language.t("store.console.repositories.edit")}
                                >
                                  <Icon name="edit" size="small" />
                                </Button>
                                <Button
                                  size="small"
                                  variant="ghost"
                                  class="h-8 w-8 p-0"
                                  onClick={() => void handleDeleteRepo(repo.id)}
                                  title={language.t("store.console.repositories.delete")}
                                >
                                  <Icon name="trash" size="small" />
                                </Button>
                              </div>
                            </div>

                            <p class="mt-3 text-12-regular text-text-weak">
                              {repo.description || language.t("store.console.repositories.descriptionFallback")}
                            </p>

                            <div class="mt-4 flex items-center gap-2">
                              <Show when={repo.repoType === "sync"}>
                                <Button
                                  size="small"
                                  variant="ghost"
                                  onClick={() =>
                                    setState("expandedSyncRepo", state.expandedSyncRepo === repo.id ? null : repo.id)
                                  }
                                >
                                  {state.expandedSyncRepo === repo.id
                                    ? language.t("store.console.repositories.hideSync")
                                    : language.t("store.console.repositories.syncSettings")}
                                </Button>
                              </Show>
                            </div>

                            <Show when={repo.repoType === "sync" && state.expandedSyncRepo === repo.id}>
                              <div class="mt-4 border-t border-border-weak-base pt-4">
                                <RepoSyncTab repoId={repo.id} />
                              </div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </section>

              <section class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-5">
                <div class="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 class="text-lg font-semibold text-text-strong">
                      {language.t("store.console.capabilities.title")}
                    </h2>
                    <p class="mt-1 text-sm text-text-weak">{language.t("store.console.capabilities.description")}</p>
                  </div>
                  <Button size="small" variant="ghost" onClick={openCreateCapability}>
                    <Icon name="plus" class="size-4" />
                    {language.t("store.console.new")}
                  </Button>
                </div>

                <div class="mb-5 grid gap-3 sm:grid-cols-2">
                  <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
                    <div class="text-12-medium text-text-weak">{language.t("store.console.capabilities.total")}</div>
                    <div class="mt-1 text-xl font-semibold text-text-strong">{totalCapabilityCount()}</div>
                  </div>
                  <div class="rounded-xl border border-border-weak-base bg-surface-base p-3">
                    <div class="text-12-medium text-text-weak">
                      {language.t("store.console.capabilities.visibleAfterFilter")}
                    </div>
                    <div class="mt-1 text-xl font-semibold text-text-strong">{visibleCapabilityCount()}</div>
                  </div>
                </div>

                <Show when={state.items.length > 0}>
                  <div class="mb-4 flex flex-wrap gap-2">
                    <For each={["all", "skill", "subagent", "command", "mcp"]}>
                      {(type) => (
                        <button
                          class="rounded-md border px-3 py-1.5 text-sm transition-colors"
                          classList={{
                            "border-border-strong bg-surface-info-base/20 text-text-strong":
                              state.itemTypeFilter === type,
                            "border-border-weak-base text-text-weak hover:text-text-strong":
                              state.itemTypeFilter !== type,
                          }}
                          onClick={() => setState("itemTypeFilter", type)}
                        >
                          {type === "all" ? language.t("store.console.filters.all") : typeLabel(type)}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                <Show
                  when={!state.loadingItems}
                  fallback={
                    <div class="text-sm text-text-weak">{language.t("store.console.capabilities.loading")}</div>
                  }
                >
                  <Show
                    when={filteredItems().length > 0}
                    fallback={
                      <div class="rounded-xl border border-dashed border-border-weak-base px-8 py-10 text-center text-sm text-text-weak">
                        {language.t("store.console.capabilities.empty")}
                      </div>
                    }
                  >
                    <div class="overflow-hidden rounded-xl border border-border-weak-base bg-surface-base">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="border-b border-border-weak-base bg-surface-base">
                            <th class="px-4 py-3 text-left text-12-medium text-text-weak">
                              {language.t("store.console.capabilities.name")}
                            </th>
                            <th class="px-4 py-3 text-left text-12-medium text-text-weak">
                              {language.t("store.console.capabilities.type")}
                            </th>
                            <th class="px-4 py-3 text-left text-12-medium text-text-weak">
                              {language.t("store.console.capabilities.category")}
                            </th>
                            <th class="px-4 py-3 text-left text-12-medium text-text-weak">
                              {language.t("store.console.capabilities.visibility")}
                            </th>
                            <th class="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          <For each={filteredItems()}>
                            {(item) => (
                              <tr class="border-b border-border-weak-base last:border-0">
                                <td class="px-4 py-3">
                                  <div class="text-13-medium text-text-strong">{item.name}</div>
                                  <div class="mt-1 text-12-regular text-text-weak">{item.slug}</div>
                                </td>
                                <td class="px-4 py-3">
                                  <span
                                    class={`rounded-full px-2 py-1 text-11-medium ${ITEM_TYPE_COLORS[item.itemType] ?? "bg-surface-selected-base text-text-strong"}`}
                                  >
                                    {typeLabel(item.itemType)}
                                  </span>
                                </td>
                                <td class="px-4 py-3 text-12-regular text-text-weak">{categoryLabel(item.category)}</td>
                                <td class="px-4 py-3 text-12-regular text-text-weak">
                                  {visibilityLabel(item.visibility || "public")}
                                </td>
                                <td class="px-4 py-3">
                                  <div class="flex items-center justify-end gap-1">
                                    <Button
                                      size="small"
                                      variant="ghost"
                                      class="h-8 w-8 p-0"
                                      onClick={() => openEditCapability(item)}
                                      title={language.t("store.console.capabilities.edit")}
                                    >
                                      <Icon name="edit" size="small" />
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="ghost"
                                      class="h-8 w-8 p-0"
                                      onClick={() => void handleDeleteItem(item.id)}
                                      title={language.t("store.console.capabilities.delete")}
                                    >
                                      <Icon name="trash" size="small" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </Show>
                </Show>
              </section>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  )
}
