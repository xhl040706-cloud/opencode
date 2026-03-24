import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { createEffect, createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useAuth } from "../hooks/use-auth"
import { getLoginUrl } from "../lib/auth"
import { itemApi, repoApi, type CapabilityItem, type Repository } from "../lib/api"
import { ConfirmDialog } from "../components/confirm-dialog"
import { CreateRepoDialog } from "../components/create-repo-dialog"
import { CreateCapabilityDialog } from "../components/create-capability-dialog"
import { EditCapabilityDialog } from "../components/edit-capability-dialog"
import { EditRepoDialog } from "../components/edit-repo-dialog"
import { InviteDialog } from "../components/invite-dialog"
import { MoveCapabilityDialog } from "../components/move-capability-dialog"
import { RepoSyncTab } from "../components/repo-sync-tab"
import { useRepoFilter } from "../context/repo-filter"
import { typeKey } from "../lib/constants"

const PAGE_SIZE = 10

export default function Dashboard() {
  const dialog = useDialog()
  const language = useLanguage()
  const { user, loading } = useAuth()
  const { repos, setRepos, loading: loadingRepos, refresh: refreshRepos } = useRepoFilter()
  const [state, setState] = createStore({
    items: [] as CapabilityItem[],
    totalItems: 0,
    loadingItems: false,
    itemTypeFilter: "all",
    itemPage: 1,
    expandedSyncRepo: null as string | null,
    filtersShown: false,
  })

  const userId = createMemo(() => user()?.sub ?? "")
  const username = createMemo(() => user()?.preferred_username || user()?.name || "")

  const loadItems = async (page = state.itemPage, type = state.itemTypeFilter) => {
    if (!userId()) return
    if (state.loadingItems) return
    setState("loadingItems", true)
    try {
      const res = await itemApi.listMy(userId(), {
        type: type === "all" ? undefined : type,
        page,
        pageSize: PAGE_SIZE,
      })
      setState("items", res.items ?? [])
      setState("totalItems", res.total ?? 0)
    } catch (error) {
      showToast({
        title: language.t("store.console.capabilities.toast.loadFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setState("loadingItems", false)
    }
  }

  let loaded = false
  createEffect(() => {
    if (!userId() || loaded) return
    loaded = true
    void loadItems()
  })

  const totalPages = createMemo(() => Math.max(1, Math.ceil(state.totalItems / PAGE_SIZE)))

  const pages = createMemo(() => {
    const total = totalPages()
    const cur = state.itemPage
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const set = new Set([1, 2, cur - 1, cur, cur + 1, total - 1, total])
    const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
    const result: (number | "...")[] = []
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...")
      result.push(sorted[i])
    }
    return result
  })

  const openCreateRepo = () => {
    if (!userId()) return
    dialog.show(() => (
      <CreateRepoDialog
        userId={userId()}
        onCreated={(repo) => {
          setRepos((prev) => [repo, ...prev])
          void refreshRepos()
        }}
      />
    ))
  }

  const openCreateCapability = () => {
    if (!userId()) return
    dialog.show(() => (
      <CreateCapabilityDialog
        userId={userId()}
        username={username()}
        repositories={repos()}
        onCreated={() => void loadItems()}
      />
    ))
  }

  const openEditRepo = (repo: Repository) => {
    dialog.show(() => (
      <EditRepoDialog
        repo={repo}
        onSaved={(updated) => setRepos((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))}
      />
    ))
  }

  const openInvite = (repo: Repository) => {
    dialog.show(() => <InviteDialog repoId={repo.id} />)
  }

  const openEditCapability = (item: CapabilityItem) => {
    dialog.show(() => <EditCapabilityDialog item={item} onSaved={() => void loadItems()} />)
  }

  const openMoveCapability = (item: CapabilityItem) => {
    dialog.show(() => <MoveCapabilityDialog item={item} repositories={repos()} onMoved={() => void loadItems()} />)
  }

  const handleDeleteRepo = (id: string) => {
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("store.console.repositories.delete")}
        description={language.t("store.console.confirmDeleteRepository")}
        confirm={language.t("common.delete")}
        onConfirm={async () => {
          await repoApi.delete(id)
          setRepos((prev) => prev.filter((item) => item.id !== id))
          showToast({ title: language.t("store.console.repositories.toast.deleteSuccess") })
        }}
      />
    ))
  }

  const handleDeleteItem = (id: string) => {
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("store.console.capabilities.delete")}
        description={language.t("store.console.confirmDeleteCapability")}
        confirm={language.t("common.delete")}
        onConfirm={async () => {
          await itemApi.delete(id)
          showToast({ title: language.t("store.console.capabilities.toast.deleteSuccess") })
          void loadItems()
        }}
      />
    ))
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
                <Button
                  class="mt-4"
                  onClick={() => {
                    window.location.href = getLoginUrl("/store/dashboard")
                  }}
                >
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
                  when={!loadingRepos()}
                  fallback={
                    <div class="text-sm text-text-weak">{language.t("store.console.repositories.loading")}</div>
                  }
                >
                  <Show
                    when={repos().length > 0}
                    fallback={
                      <div class="rounded-xl border border-dashed border-border-weak-base px-8 py-10 text-center text-sm text-text-weak">
                        {language.t("store.console.repositories.empty")}
                      </div>
                    }
                  >
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <For each={repos()}>
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
                                  onClick={() => openInvite(repo)}
                                  title={language.t("store.console.repositories.invite")}
                                >
                                  <Icon name="plus-small" size="small" />
                                </Button>
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
                                  onClick={() => handleDeleteRepo(repo.id)}
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

                <Show when={state.filtersShown || state.items.length > 0 || state.totalItems > 0}>
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
                            setState("filtersShown", true)
                            void loadItems(1, type)
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
                    when={state.totalItems > 0 || state.items.length > 0}
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
                          <For each={state.items}>
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
                                      <Icon name="share" size="small" />
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
                                      onClick={() => handleDeleteItem(item.id)}
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
                            to: Math.min(state.itemPage * PAGE_SIZE, state.totalItems),
                            total: state.totalItems,
                          })}
                        </p>
                        <div class="flex items-center gap-1">
                          <Button
                            size="small"
                            variant="ghost"
                            class="h-8 px-2 text-xs"
                            disabled={state.itemPage <= 1}
                            onClick={() => {
                              const p = Math.max(1, state.itemPage - 1)
                              setState("itemPage", p)
                              void loadItems(p)
                            }}
                          >
                            <Icon name="chevron-left" size="small" />
                          </Button>
                          <For each={pages()}>
                            {(p) => (
                              <Show
                                when={p !== "..."}
                                fallback={
                                  <span class="flex h-8 min-w-8 items-center justify-center text-xs text-text-weak">
                                    ...
                                  </span>
                                }
                              >
                                <button
                                  class="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs transition-colors"
                                  classList={{
                                    "bg-bg-muted text-text-strong font-medium": state.itemPage === p,
                                    "text-text-weak hover:text-text-strong hover:bg-bg-muted": state.itemPage !== p,
                                  }}
                                  onClick={() => {
                                    setState("itemPage", p as number)
                                    void loadItems(p as number)
                                  }}
                                >
                                  {p}
                                </button>
                              </Show>
                            )}
                          </For>
                          <Button
                            size="small"
                            variant="ghost"
                            class="h-8 px-2 text-xs"
                            disabled={state.itemPage >= totalPages()}
                            onClick={() => {
                              const p = Math.min(totalPages(), state.itemPage + 1)
                              setState("itemPage", p)
                              void loadItems(p)
                            }}
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
