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
  type CapabilityItem,
  type Repository,
} from "../lib/api"
import { CreateRepoDialog } from "../components/create-repo-dialog"
import { CreateCapabilityDialog } from "../components/create-capability-dialog"
import { EditCapabilityDialog } from "../components/edit-capability-dialog"
import { EditRepoDialog } from "../components/edit-repo-dialog"
import { MoveCapabilityDialog } from "../components/move-capability-dialog"
import { RepoSyncTab } from "../components/repo-sync-tab"
import { typeKey } from "../lib/constants"

const PAGE_SIZE = 10

export default function Dashboard() {
  const dialog = useDialog()
  const language = useLanguage()
  const { user, loading } = useAuth()
  const [state, setState] = createStore({
    repos: [] as Repository[],
    items: [] as CapabilityItem[],
    loadingRepos: false,
    loadingItems: false,
    itemTypeFilter: "all",
    itemPage: 1,
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

  createEffect(() => {
    if (!userId()) return
    void loadRepos()
    void loadItems()
  })

  const filteredItems = createMemo(() =>
    state.itemTypeFilter === "all" ? state.items : state.items.filter((item) => item.itemType === state.itemTypeFilter),
  )

  const totalPages = createMemo(() => Math.max(1, Math.ceil(filteredItems().length / PAGE_SIZE)))

  const pagedItems = createMemo(() => {
    const start = (state.itemPage - 1) * PAGE_SIZE
    return filteredItems().slice(start, start + PAGE_SIZE)
  })

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

  const openMoveCapability = (item: CapabilityItem) => {
    dialog.show(() => (
      <MoveCapabilityDialog
        item={item}
        repositories={state.repos}
        onMoved={(updated) =>
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

  const typeLabel = (type: string) => language.t(typeKey(type))

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
                <Button class="mt-4" onClick={() => { window.location.href = getLoginUrl("/store/dashboard") }}>
                  {language.t("store.console.login")}
                </Button>
              </div>
            </div>
          }
        >
          <div class="flex flex-col gap-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h1 class="text-2xl font-semibold text-text-strong">{language.t("store.console")}</h1>
                {/* <p class="mt-1 text-sm text-text-weak">{language.t("store.console.manageDescription")}</p> */}
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
                  <Button size="small" variant="ghost" class="border border-border-weak-base" onClick={openCreateRepo}>
                    <Icon name="plus" class="size-4" />
                    {language.t("store.console.new")}
                  </Button>
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
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <For each={state.repos}>
                        {(repo) => (
                          <div class="group rounded-md border border-border-weak-base bg-background-base px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:shadow-xs-border-base">
                            <div class="mb-3 flex items-start justify-between gap-3">
                              <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                  <div class="truncate text-sm font-medium text-text-strong transition-colors group-hover:text-text-strong">
                                    {repo.displayName || repo.name}
                                  </div>
                                  <span
                                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-11-medium"
                                    classList={{
                                      "bg-surface-success-base/15 text-text-success-base": repo.visibility === "public",
                                      "bg-surface-warning-base/15 text-text-warning-base":
                                        repo.visibility === "private",
                                      "bg-surface-selected-base text-text-weak":
                                        repo.visibility !== "public" && repo.visibility !== "private",
                                    }}
                                  >
                                    <Icon name={repo.visibility === "private" ? "eye" : "sparkles"} size="small" />
                                    {visibilityLabel(repo.visibility)}
                                  </span>
                                  <Show when={repo.repoType === "sync"}>
                                    <span class="rounded-full bg-surface-info-base/20 px-2 py-0.5 text-11-medium text-text-strong">
                                      {language.t("store.console.repositories.sync")}
                                    </span>
                                  </Show>
                                </div>
                                <div class="mt-1 truncate text-xs text-text-weak">{repo.name}</div>
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

                            <p class="mb-4 text-xs text-text-weak line-clamp-2 min-h-10">{repo.description || ""}</p>

                            <div class="mt-auto flex items-center gap-2 border-t border-border-weak-base pt-3">
                              <Show when={repo.repoType === "sync"}>
                                <Button
                                  size="small"
                                  variant="ghost"
                                  class="px-2 py-1 text-xs"
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
                  <Button
                    size="small"
                    variant="ghost"
                    class="border border-border-weak-base"
                    onClick={openCreateCapability}
                  >
                    <Icon name="plus" class="size-4" />
                    {language.t("store.console.new")}
                  </Button>
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
                          onClick={() => {
                            setState("itemTypeFilter", type)
                            setState("itemPage", 1)
                          }}
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
                              {language.t("store.console.capabilities.visibility")}
                            </th>
                            <th class="px-4 py-3 text-left text-12-medium text-text-weak">
                              {language.t("store.console.capabilities.source")}
                            </th>
                            <th class="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          <For each={pagedItems()}>
                            {(item) => (
                              <tr class="border-b border-border-weak-base last:border-0">
                                <td class="px-4 py-3">
                                  <div class="text-13-medium text-text-strong">{item.name}</div>
                                  <div class="mt-1 text-12-regular text-text-weak">{item.slug}</div>
                                </td>
                                <td class="px-4 py-3">
                                  <span class="rounded py-0.5 text-xs bg-bg-muted text-text-weak">
                                    {typeLabel(item.itemType)}
                                  </span>
                                </td>
                                <td class="px-4 py-3 text-12-regular capitalize text-text-weak">
                                  {visibilityLabel(item.visibility || "public")}
                                </td>
                                <td class="px-4 py-3 text-12-regular text-text-weak">{item.repoName || "—"}</td>
                                <td class="px-4 py-3">
                                  <div class="flex items-center justify-end gap-1">
                                    <Button
                                      size="small"
                                      variant="ghost"
                                      class="h-8 w-8 p-0"
                                      onClick={() => openMoveCapability(item)}
                                      title={language.t("store.console.capabilities.move")}
                                    >
                                      <Icon name="folder" size="small" />
                                    </Button>
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

                    <Show when={totalPages() > 1}>
                      <div class="mt-4 flex items-center justify-between">
                        <p class="text-xs text-text-weak">
                          {language.t("store.console.capabilities.showing", {
                            from: (state.itemPage - 1) * PAGE_SIZE + 1,
                            to: Math.min(state.itemPage * PAGE_SIZE, filteredItems().length),
                            total: filteredItems().length,
                          })}
                        </p>
                        <div class="flex items-center gap-1">
                          <Button
                            size="small"
                            variant="ghost"
                            class="h-8 px-2 text-xs"
                            disabled={state.itemPage <= 1}
                            onClick={() => setState("itemPage", (p) => Math.max(1, p - 1))}
                          >
                            <Icon name="chevron-left" size="small" />
                          </Button>
                          <For each={Array.from({ length: totalPages() }, (_, i) => i + 1)}>
                            {(p) => (
                              <button
                                class="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs transition-colors"
                                classList={{
                                  "bg-bg-muted text-text-strong font-medium": state.itemPage === p,
                                  "text-text-weak hover:text-text-strong hover:bg-bg-muted": state.itemPage !== p,
                                }}
                                onClick={() => setState("itemPage", p)}
                              >
                                {p}
                              </button>
                            )}
                          </For>
                          <Button
                            size="small"
                            variant="ghost"
                            class="h-8 px-2 text-xs"
                            disabled={state.itemPage >= totalPages()}
                            onClick={() => setState("itemPage", (p) => Math.min(totalPages(), p + 1))}
                          >
                            <Icon name="chevron-right" size="small" />
                          </Button>
                        </div>
                      </div>
                    </Show>
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
