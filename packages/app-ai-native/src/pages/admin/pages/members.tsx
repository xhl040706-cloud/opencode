import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { createMemo, For, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import AvatarDisplay from "@/components/avatar-display"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/context/auth"
import { useLanguage } from "@/context/language"
import { ConfirmDialog } from "@/pages/store/components/confirm-dialog"
import {
  adminUserApi,
  type AdminOrganization,
  type AdminUser,
  type AdminUserProfile,
  type AdminUserStatus,
} from "@/pages/store/lib/api"
import { sx, st } from "../lib/styles"

const STATUS_FILTERS = ["", "active", "disabled", "banned"] as const
const PAGE_SIZE = 20
type Tab = "members" | "organizations"

export default function AdminMembers() {
  const language = useLanguage()
  const dialog = useDialog()
  const auth = useAuth()

  const [state, setState] = createStore<{
    tab: Tab
    users: AdminUser[]
    total: number
    loading: boolean
    status: string
    search: string
    debouncedSearch: string
    page: number
    organizations: AdminOrganization[]
    orgsLoading: boolean
    orgsLoaded: boolean
  }>({
    tab: "members",
    users: [],
    total: 0,
    loading: true,
    status: "",
    search: "",
    debouncedSearch: "",
    page: 1,
    organizations: [],
    orgsLoading: false,
    orgsLoaded: false,
  })

  // Per-row status-action loading guard.
  const [actionLoading, setActionLoading] = createStore<Record<string, boolean>>({})

  // Detail drawer state.
  const [detail, setDetail] = createStore<{
    open: boolean
    user: AdminUser | null
    profile: AdminUserProfile | null
    loading: boolean
  }>({ open: false, user: null, profile: null, loading: false })

  let searchTimer: ReturnType<typeof setTimeout>

  const totalPages = createMemo(() => Math.max(1, Math.ceil(state.total / PAGE_SIZE)))
  const currentSubject = () => auth.user()?.subjectId ?? auth.user()?.sub ?? ""

  async function load() {
    setState("loading", true)
    try {
      const res = await adminUserApi.list({
        search: state.debouncedSearch || undefined,
        status: state.status || undefined,
        page: state.page,
        pageSize: PAGE_SIZE,
      })
      setState("users", res.users ?? [])
      setState("total", res.total ?? 0)
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.members.toast.loadFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setState("loading", false)
    }
  }

  async function loadOrganizations() {
    setState("orgsLoading", true)
    try {
      const res = await adminUserApi.listOrganizations()
      setState("organizations", res.organizations ?? [])
      setState("orgsLoaded", true)
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.members.toast.orgsFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setState("orgsLoading", false)
    }
  }

  onMount(() => void load())

  function switchTab(tab: Tab) {
    setState("tab", tab)
    if (tab === "organizations" && !state.orgsLoaded) void loadOrganizations()
  }

  function setStatusFilter(value: string) {
    setState("status", value)
    setState("page", 1)
    void load()
  }

  function onSearchInput(value: string) {
    setState("search", value)
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      setState("debouncedSearch", value.trim())
      setState("page", 1)
      void load()
    }, 300)
  }

  function gotoPage(p: number) {
    if (p < 1 || p > totalPages()) return
    setState("page", p)
    void load()
  }

  async function openDetail(u: AdminUser) {
    setDetail({ open: true, user: u, profile: null, loading: true })
    try {
      const res = await adminUserApi.getProfile(u.subject_id)
      setDetail("user", res.user)
      setDetail("profile", res.profile)
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.members.toast.profileFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setDetail("loading", false)
    }
  }

  async function applyStatus(u: AdminUser, status: AdminUserStatus) {
    setActionLoading(u.subject_id, true)
    try {
      await adminUserApi.setStatus(u.subject_id, status)
      setState("users", (x) => x.subject_id === u.subject_id, "status", status)
      if (detail.user?.subject_id === u.subject_id) setDetail("user", (d) => (d ? { ...d, status } : d))
      showToast({ variant: "success", title: language.t("admin.members.toast.statusUpdated") })
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.members.toast.statusFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setActionLoading(u.subject_id, false)
    }
  }

  // Banning/disabling are destructive — confirm first with a warning-styled dialog.
  const confirmStatus = (u: AdminUser, status: AdminUserStatus) =>
    dialog.show(() => (
      <ConfirmDialog
        title={language.t(`admin.members.confirm.${status}.title` as "admin.members.confirm.banned.title")}
        description={language.t(`admin.members.confirm.${status}.description` as "admin.members.confirm.banned.description", {
          name: displayName(u),
        })}
        confirm={language.t(`admin.members.actions.${status}` as "admin.members.actions.banned")}
        variant="danger"
        onConfirm={() => applyStatus(u, status)}
      />
    ))

  const displayName = (u: AdminUser) => u.displayName || u.username || u.subject_id

  const statusLabel = (s: string) =>
    language.t(`admin.members.status.${s || "active"}` as "admin.members.status.active")

  // Semantic status colors via native tokens (active=success, banned=error).
  const statusStyle = (s: string) => {
    switch (s) {
      case "banned":
        return "bg-[color:color-mix(in_oklab,var(--native-error)_14%,transparent)] text-[var(--native-error)]"
      case "disabled":
        return "bg-[color:color-mix(in_oklab,var(--native-muted)_18%,transparent)] text-[var(--native-muted)]"
      default:
        return "bg-[color:color-mix(in_oklab,var(--native-success,#16a34a)_14%,transparent)] text-[var(--native-success,#16a34a)]"
    }
  }

  const roleLabel = (role: string) =>
    language.t(`admin.members.roles.${role}` as "admin.members.roles.platform_admin", {}) || role

  const fmtDate = (iso?: string | null) => {
    if (!iso) return "—"
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(language.locale() === "zh" ? "zh-CN" : "en-US")
  }

  return (
    <section class={sx.section}>
      <div class={sx.head}>
        <div>
          <h1 class={sx.title}>{language.t("admin.members.title")}</h1>
          <p class={sx.sub}>{language.t("admin.members.subtitle")}</p>
        </div>
      </div>

      {/* Tabs: members / organizations */}
      <div class="mb-3 flex flex-wrap gap-1" role="tablist" aria-label={language.t("admin.members.title")}>
        <button
          type="button"
          role="tab"
          aria-selected={state.tab === "members"}
          class={st.filter(state.tab === "members")}
          onClick={() => switchTab("members")}
        >
          {language.t("admin.members.tabs.members")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={state.tab === "organizations"}
          class={st.filter(state.tab === "organizations")}
          onClick={() => switchTab("organizations")}
        >
          {language.t("admin.members.tabs.organizations")}
        </button>
      </div>

      <Show when={state.tab === "members"}>
        {/* Filters */}
        <div class="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-wrap gap-1" aria-label={language.t("admin.members.filter.statusGroup")}>
            <For each={STATUS_FILTERS}>
              {(s) => (
                <button
                  type="button"
                  class={st.filter(state.status === s)}
                  aria-pressed={state.status === s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "" ? language.t("admin.members.filter.allStatus") : statusLabel(s)}
                </button>
              )}
            </For>
          </div>
          <div class={sx.searchWrap}>
            <Icon name="magnifying-glass" size="small" class={sx.searchIcon} />
            <input
              class={sx.search}
              placeholder={language.t("admin.members.searchPlaceholder")}
              value={state.search}
              aria-label={language.t("admin.members.searchPlaceholder")}
              onInput={(e) => onSearchInput(e.currentTarget.value)}
            />
          </div>
        </div>

        {/* Members table */}
        <div class={sx.tableShell}>
          <Show when={state.loading}>
            <div class={sx.overlay}>
              <div class={sx.spinner} />
            </div>
          </Show>

          <table class={sx.dtStatic}>
            <thead>
              <tr>
                <th>{language.t("admin.members.columns.user")}</th>
                <th class="w-52">{language.t("admin.members.columns.email")}</th>
                <th class="w-36">{language.t("admin.members.columns.organization")}</th>
                <th class="w-24">{language.t("admin.members.columns.status")}</th>
                <th class="w-40">{language.t("admin.members.columns.roles")}</th>
                <th class="w-56 text-right">{language.t("admin.members.columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              <For each={state.users}>
                {(u) => {
                  const self = () => u.subject_id === currentSubject()
                  const selfHintId = `member-self-hint-${u.subject_id}`
                  return (
                    <tr>
                      <td>
                        <button
                          type="button"
                          class="flex cursor-pointer items-center gap-2.5 text-left"
                          onClick={() => void openDetail(u)}
                        >
                          <AvatarDisplay avatarUrl={u.avatarUrl} username={displayName(u)} size={28} radius={6} />
                          <span class="min-w-0">
                            <span class="block truncate font-semibold text-[var(--native-foreground)] hover:underline">
                              {displayName(u)}
                            </span>
                            <span class="block truncate text-[12px] text-[var(--native-muted)]">{u.username}</span>
                          </span>
                        </button>
                      </td>
                      <td class="truncate text-[var(--native-muted)]">{u.email || "—"}</td>
                      <td class="truncate text-[var(--native-muted)]">{u.organization || "—"}</td>
                      <td>
                        <span class={`inline-flex items-center rounded-[var(--native-radius-sm)] px-1.5 py-0.5 text-[11px] font-medium ${statusStyle(u.status)}`}>
                          {statusLabel(u.status)}
                        </span>
                      </td>
                      <td class="text-[var(--native-muted)]">
                        <Show when={u.roles.length > 0} fallback={<span>—</span>}>
                          <span class="text-[12px]">{u.roles.map(roleLabel).join(", ")}</span>
                        </Show>
                      </td>
                      <td class="text-right">
                        <div class="inline-flex items-center gap-3">
                          <Show when={u.status !== "active"}>
                            <button
                              type="button"
                              class="cursor-pointer text-[var(--native-primary)] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={actionLoading[u.subject_id]}
                              onClick={() => void applyStatus(u, "active")}
                            >
                              {language.t("admin.members.actions.active")}
                            </button>
                          </Show>
                          <Show when={u.status === "active"}>
                            <button
                              type="button"
                              class="cursor-pointer text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={actionLoading[u.subject_id] || self()}
                              aria-describedby={self() ? selfHintId : undefined}
                              onClick={() => confirmStatus(u, "disabled")}
                            >
                              {language.t("admin.members.actions.disabled")}
                            </button>
                          </Show>
                          <Show when={u.status !== "banned"}>
                            <button
                              type="button"
                              class="cursor-pointer text-[var(--native-error)] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={actionLoading[u.subject_id] || self()}
                              aria-describedby={self() ? selfHintId : undefined}
                              onClick={() => confirmStatus(u, "banned")}
                            >
                              {language.t("admin.members.actions.banned")}
                            </button>
                          </Show>
                          <button
                            type="button"
                            class="cursor-pointer text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)] hover:underline"
                            onClick={() => void openDetail(u)}
                          >
                            {language.t("admin.members.actions.detail")}
                          </button>
                        </div>
                        <Show when={self()}>
                          <p id={selfHintId} class="mt-1 text-right text-[11px] text-[var(--native-muted)]">
                            {language.t("admin.members.selfHint")}
                          </p>
                        </Show>
                      </td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>

          <Show when={!state.loading && state.users.length === 0}>
            <div class={sx.state}>{language.t("admin.members.empty")}</div>
          </Show>
        </div>

        {/* Pagination */}
        <Show when={state.total > PAGE_SIZE}>
          <div class={sx.pager}>
            <span class={sx.pagerSum}>
              {language.t("admin.members.pagination.summary", {
                page: String(state.page),
                total: String(totalPages()),
                count: String(state.total),
              })}
            </span>
            <div class={sx.pagerActs}>
              <button
                type="button"
                class={sx.page}
                disabled={state.page <= 1}
                aria-label={language.t("admin.members.pagination.prev")}
                onClick={() => gotoPage(state.page - 1)}
              >
                <Icon name="chevron-left" size="small" />
              </button>
              <button
                type="button"
                class={sx.page}
                disabled={state.page >= totalPages()}
                aria-label={language.t("admin.members.pagination.next")}
                onClick={() => gotoPage(state.page + 1)}
              >
                <Icon name="chevron-right" size="small" />
              </button>
            </div>
          </div>
        </Show>
      </Show>

      {/* Organizations tab */}
      <Show when={state.tab === "organizations"}>
        <div class={sx.tableShell}>
          <Show when={state.orgsLoading}>
            <div class={sx.overlay}>
              <div class={sx.spinner} />
            </div>
          </Show>

          <table class={sx.dtStatic}>
            <thead>
              <tr>
                <th>{language.t("admin.members.org.columns.name")}</th>
                <th class="w-32 text-right">{language.t("admin.members.org.columns.members")}</th>
              </tr>
            </thead>
            <tbody>
              <For each={state.organizations}>
                {(org) => (
                  <tr>
                    <td class="font-semibold text-[var(--native-foreground)]">{org.organization}</td>
                    <td class="text-right text-[var(--native-muted)] [font-variant-numeric:tabular-nums]">
                      {org.memberCount}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>

          <Show when={!state.orgsLoading && state.organizations.length === 0}>
            <div class={sx.state}>{language.t("admin.members.org.empty")}</div>
          </Show>
        </div>
      </Show>

      {/* Detail drawer */}
      <Sheet open={detail.open} onOpenChange={(o) => setDetail("open", o)}>
        <SheetContent position="right" class="w-full max-w-[440px]">
          <SheetHeader>
            <SheetTitle>{detail.user ? displayName(detail.user) : ""}</SheetTitle>
            <SheetDescription>{language.t("admin.members.detail.subtitle")}</SheetDescription>
          </SheetHeader>

          <Show when={detail.user}>
            {(u) => (
              <div class="flex flex-col gap-5 px-1 pt-2">
                <div class="flex items-center gap-3">
                  <AvatarDisplay avatarUrl={u().avatarUrl} username={displayName(u())} size={48} radius={8} />
                  <div class="min-w-0">
                    <div class="truncate font-semibold text-[var(--native-foreground)]">{displayName(u())}</div>
                    <div class="truncate text-[0.8125rem] text-[var(--native-muted)]">{u().email || u().username}</div>
                    <span class={`mt-1 inline-flex items-center rounded-[var(--native-radius-sm)] px-1.5 py-0.5 text-[11px] font-medium ${statusStyle(u().status)}`}>
                      {statusLabel(u().status)}
                    </span>
                  </div>
                </div>

                {/* Meta */}
                <div class="grid grid-cols-2 gap-3 text-[0.8125rem]">
                  <div>
                    <div class="text-[12px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                      {language.t("admin.members.columns.organization")}
                    </div>
                    <div class="mt-0.5 truncate text-[var(--native-foreground)]">{u().organization || "—"}</div>
                  </div>
                  <div>
                    <div class="text-[12px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                      {language.t("admin.members.detail.lastLogin")}
                    </div>
                    <div class="mt-0.5 text-[var(--native-foreground)]">{fmtDate(u().lastLoginAt)}</div>
                  </div>
                  <div class="col-span-2">
                    <div class="text-[12px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                      {language.t("admin.members.columns.roles")}
                    </div>
                    <div class="mt-0.5 text-[var(--native-foreground)]">
                      {u().roles.length ? u().roles.map(roleLabel).join(", ") : "—"}
                    </div>
                  </div>
                </div>

                {/* Activity profile */}
                <div class="grid grid-cols-3 gap-2">
                  <For
                    each={
                      [
                        { key: "createdItemCount", labelKey: "admin.members.detail.created" },
                        { key: "distributedCount", labelKey: "admin.members.detail.distributed" },
                        { key: "receivedCount", labelKey: "admin.members.detail.received" },
                      ] as const
                    }
                  >
                    {(card) => (
                      <div class="rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_40%,transparent)] px-2 py-2 text-center">
                        <div class="text-[1.1rem] font-extrabold text-[var(--native-foreground)] [font-variant-numeric:tabular-nums]">
                          <Show when={!detail.loading && detail.profile} fallback="—">
                            {detail.profile?.[card.key] ?? 0}
                          </Show>
                        </div>
                        <div class="text-[11px] text-[var(--native-muted)]">{language.t(card.labelKey)}</div>
                      </div>
                    )}
                  </For>
                </div>

                {/* Status actions */}
                <div class="flex flex-wrap gap-2 border-t border-[color:color-mix(in_oklab,var(--native-border)_30%,transparent)] pt-4">
                  <Show when={u().status !== "active"}>
                    <button
                      type="button"
                      class="cursor-pointer rounded-[var(--native-radius-md)] border border-[var(--native-primary)] px-3 py-1.5 text-[0.8125rem] text-[var(--native-primary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--native-primary)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={actionLoading[u().subject_id]}
                      onClick={() => void applyStatus(u(), "active")}
                    >
                      {language.t("admin.members.actions.active")}
                    </button>
                  </Show>
                  <Show when={u().status === "active"}>
                    <button
                      type="button"
                      class="cursor-pointer rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_50%,transparent)] px-3 py-1.5 text-[0.8125rem] text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={actionLoading[u().subject_id] || u().subject_id === currentSubject()}
                      onClick={() => confirmStatus(u(), "disabled")}
                    >
                      {language.t("admin.members.actions.disabled")}
                    </button>
                  </Show>
                  <Show when={u().status !== "banned"}>
                    <button
                      type="button"
                      class="cursor-pointer rounded-[var(--native-radius-md)] border border-[var(--native-error)] px-3 py-1.5 text-[0.8125rem] text-[var(--native-error)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--native-error)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={actionLoading[u().subject_id] || u().subject_id === currentSubject()}
                      onClick={() => confirmStatus(u(), "banned")}
                    >
                      {language.t("admin.members.actions.banned")}
                    </button>
                  </Show>
                </div>
                <Show when={u().subject_id === currentSubject()}>
                  <p class="-mt-3 text-[12px] text-[var(--native-muted)]">{language.t("admin.members.selfHint")}</p>
                </Show>
              </div>
            )}
          </Show>
        </SheetContent>
      </Sheet>
    </section>
  )
}
