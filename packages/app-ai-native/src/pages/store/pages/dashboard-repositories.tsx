import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useLanguage } from "@/context/language"
import { createEffect, createMemo, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useAuth } from "../hooks/use-auth"
import { getLoginUrl } from "../lib/auth"
import { repoApi, syncApi, type Repository, type SyncStatus } from "../lib/api"
import { ConfirmDialog } from "../components/confirm-dialog"
import { CreateRepoDialog } from "../components/create-repo-dialog"
import { EditRepoDialog } from "../components/edit-repo-dialog"
import { InviteDialog } from "../components/invite-dialog"
import { RepoSyncTab } from "../components/repo-sync-tab"

export default function DashboardRepositories() {
  const dialog = useDialog()
  const language = useLanguage()
  const { user, loading } = useAuth()
  const [state, setState] = createStore({
    repos: [] as Repository[],
    loadingRepos: false,
    expandedSyncRepo: null as string | null,
    syncingRepoId: null as string | null,
    syncStatuses: {} as Record<string, SyncStatus | undefined>,
  })

  const userId = createMemo(() => user()?.sub ?? "")

  const loadRepos = async () => {
    if (!userId()) return
    setState("loadingRepos", true)
    try {
      const res = await repoApi.listMy(userId())
      setState("repos", res.repositories ?? [])
    } finally {
      setState("loadingRepos", false)
    }
  }

  let loaded = false
  createEffect(() => {
    if (!userId() || loaded) return
    loaded = true
    void loadRepos()
  })

  let statusTimer: ReturnType<typeof setInterval> | undefined
  const loadSyncStatuses = async () => {
    const syncRepoIds = state.repos.filter((r) => r.repoType === "sync").map((r) => r.id)
    if (syncRepoIds.length === 0) return
    const results = await Promise.allSettled(
      syncRepoIds.map((id) => syncApi.getRepoSyncStatus(id).then((r) => ("registries" in r ? r.registries : [r]))),
    )
    const map: Record<string, SyncStatus> = {}
    syncRepoIds.forEach((id, i) => {
      const res = results[i]
      if (res.status === "fulfilled" && res.value.length > 0) {
        const reg = res.value[0]
        map[id] = {
          syncStatus: reg.syncStatus ?? "idle",
          lastSyncedAt: "lastSyncedAt" in reg ? reg.lastSyncedAt : undefined,
          lastSyncSha: reg.lastSyncSha ?? "",
          pendingJobs: reg.pendingJobs ?? 0,
        }
      }
    })
    setState("syncStatuses", map)
  }

  createEffect(() => {
    if (state.repos.length === 0) return
    void loadSyncStatuses()
    statusTimer = setInterval(() => void loadSyncStatuses(), 15000)
    onCleanup(() => clearInterval(statusTimer))
  })

  const openCreateRepo = () => {
    if (!userId()) return
    dialog.show(() => (
      <CreateRepoDialog
        userId={userId()}
        onCreated={(repo) => {
          setState("repos", (prev) => [repo, ...prev])
          void loadRepos()
        }}
      />
    ))
  }

  const openEditRepo = (repo: Repository) => {
    dialog.show(() => (
      <EditRepoDialog
        repo={repo}
        onSaved={(updated) => {
          setState("repos", (prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
        }}
      />
    ))
  }

  const openInvite = (repo: Repository) => {
    dialog.show(() => <InviteDialog repoId={repo.id} currentUserId={userId()} />)
  }

  const handleDeleteRepo = (id: string) => {
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("store.console.repositories.delete")}
        description={language.t("store.console.confirmDeleteRepository")}
        confirm={language.t("common.delete")}
        onConfirm={async () => {
          await repoApi.delete(id)
          setState("repos", (prev) => prev.filter((item) => item.id !== id))
          showToast({ title: language.t("store.console.repositories.toast.deleteSuccess") })
        }}
      />
    ))
  }

  const syncNow = async (id: string) => {
    if (state.syncingRepoId) return
    setState("syncingRepoId", id)
    try {
      await syncApi.triggerRepoSync(id)
      showToast({ title: language.t("store.sync.toast.started") })
    } catch (err) {
      showToast({
        title: language.t("store.sync.toast.startFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setState("syncingRepoId", null)
    }
  }

  const visibilityLabel = (visibility?: string | null) => {
    if (!visibility || visibility === "public") return language.t("store.capabilityDialog.visibility.public")
    if (visibility === "private") return language.t("store.capabilityDialog.visibility.private")
    if (visibility === "repo") return language.t("store.capabilityDialog.visibility.repository")
    return visibility
  }

  const syncStatusLabel = (status?: string) => {
    if (!status || status === "idle") return language.t("store.sync.status.idle")
    if (status === "running" || status === "pending") return language.t("store.sync.status.running")
    if (status === "success") return language.t("store.sync.status.success")
    if (status === "failed") return language.t("store.sync.status.failed")
    return status
  }

  const syncStatusColor = (status?: string) => {
    if (!status || status === "idle") return "var(--color-text-weak)"
    if (status === "running" || status === "pending") return "#3b82f6"
    if (status === "success") return "#22c55e"
    if (status === "failed") return "#ef4444"
    return "var(--color-text-weak)"
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
                    window.location.href = getLoginUrl("/store/dashboard/repositories")
                  }}
                >
                  {language.t("store.console.login")}
                </Button>
              </div>
            </div>
          }
        >
          <section class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-5">
            <div class="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 class="text-lg font-semibold text-text-strong">{language.t("store.console.repositories.title")}</h2>
                <p class="mt-1 text-sm text-text-weak">{language.t("store.console.repositories.description")}</p>
              </div>
              <Button
                size="small"
                variant="ghost"
                class="border border-border-weak-base cursor-pointer"
                onClick={openCreateRepo}
              >
                <Icon name="plus" class="size-4" />
                {language.t("store.console.newRepository")}
              </Button>
            </div>

            <Show
              when={!state.loadingRepos}
              fallback={<div class="text-sm text-text-weak">{language.t("store.console.repositories.loading")}</div>}
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
                      <div class="group flex flex-col rounded-md border border-border-weak-base bg-background-base px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:shadow-xs-border-base">
                        <div class="mb-2 min-w-0 overflow-hidden">
                          <div class="flex items-center gap-2 flex-nowrap justify-between">
                            <Tooltip value={repo.displayName || repo.name} placement="top" class="max-w-[60%]">
                              <div class="truncate text-sm font-medium text-text-strong transition-colors group-hover:text-text-strong">
                                {repo.displayName || repo.name}
                              </div>
                            </Tooltip>
                            <span
                              class="inline-flex shrink-0 items-center gap-1 rounded-[10px] px-2.5 py-[3px] text-xs font-medium"
                              style={{
                                "background-color":
                                  repo.visibility === "public"
                                    ? "color-mix(in srgb, #22c55e 12%, transparent)"
                                    : repo.visibility === "private"
                                      ? "color-mix(in srgb, #f59e0b 12%, transparent)"
                                      : "rgba(156,163,175,0.12)",
                                color:
                                  repo.visibility === "public"
                                    ? "#22c55e"
                                    : repo.visibility === "private"
                                      ? "#f59e0b"
                                      : "var(--color-text-weak)",
                              }}
                            >
                              <Icon name={repo.visibility === "private" ? "eye" : "sparkles"} size="small" />
                              {visibilityLabel(repo.visibility)}
                            </span>
                          </div>
                          <div class="mt-1 truncate text-xs text-text-weak">{repo.name}</div>
                        </div>

                        <p class="mb-3 text-xs text-text-weak line-clamp-2 min-h-8 flex-1">{repo.description || ""}</p>

                        <Show when={repo.repoType === "sync"}>
                          {(() => {
                            const s = state.syncStatuses[repo.id]
                            const status = s?.syncStatus
                            const isRunning = status === "running" || status === "pending"
                            return (
                              <div
                                class="mb-3 flex items-center gap-1.5 text-xs"
                                style={{ color: syncStatusColor(status) }}
                              >
                                <span
                                  class={`inline-block size-1.5 rounded-full${isRunning ? " animate-pulse" : ""}`}
                                  style={{ "background-color": syncStatusColor(status) }}
                                />
                                {syncStatusLabel(status)}
                                <Show when={s?.lastSyncedAt}>
                                  <span class="text-text-weak">· {new Date(s!.lastSyncedAt!).toLocaleString()}</span>
                                </Show>
                              </div>
                            )
                          })()}
                        </Show>

                        <div class="flex items-center justify-between gap-2 border-t border-border-weak-base pt-3">
                          <div class="ml-auto flex items-center gap-1">
                            <Show when={repo.repoType === "sync"}>
                              <Button
                                size="small"
                                variant="ghost"
                                class="h-7 px-2 cursor-pointer text-xs"
                                disabled={state.syncingRepoId === repo.id}
                                onClick={() => void syncNow(repo.id)}
                                title={language.t("store.sync.syncNow")}
                              >
                                <Icon name="reset" size="small" />
                                {language.t("store.sync.syncNow")}
                              </Button>
                              <Button
                                size="small"
                                variant="ghost"
                                class="h-7 w-7 p-0 cursor-pointer"
                                onClick={() =>
                                  setState("expandedSyncRepo", state.expandedSyncRepo === repo.id ? null : repo.id)
                                }
                                title={
                                  state.expandedSyncRepo === repo.id
                                    ? language.t("store.console.repositories.hideSync")
                                    : language.t("store.console.repositories.syncSettings")
                                }
                              >
                                <Icon name="settings-gear" size="small" />
                              </Button>
                            </Show>
                            <Button
                              size="small"
                              variant="ghost"
                              class="h-7 w-7 p-0 cursor-pointer"
                              onClick={() => openInvite(repo)}
                              title={language.t("store.console.repositories.invite")}
                            >
                              <Icon name="plus-small" size="small" />
                            </Button>
                            <Button
                              size="small"
                              variant="ghost"
                              class="h-7 w-7 p-0 cursor-pointer"
                              onClick={() => openEditRepo(repo)}
                              title={language.t("store.console.repositories.edit")}
                            >
                              <Icon name="edit" size="small" />
                            </Button>
                            <Button
                              size="small"
                              variant="ghost"
                              class="h-7 w-7 p-0 cursor-pointer"
                              onClick={() => handleDeleteRepo(repo.id)}
                              title={language.t("store.console.repositories.delete")}
                            >
                              <Icon name="trash" size="small" />
                            </Button>
                          </div>
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
        </Show>
      </Show>
    </div>
  )
}
