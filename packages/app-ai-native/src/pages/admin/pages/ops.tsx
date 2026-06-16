import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { For, Show, createMemo, createResource, createSignal, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { Button } from "@/components/ui/button"
import {
  adminAnnouncementApi,
  adminAuditApi,
  adminNotificationChannelApi,
  adminSettingsApi,
  userApi,
  type AdminAuditLog,
  type AnnouncementPayload,
  type SystemNotificationChannel,
} from "@/pages/store/lib/api"
import { ConfirmDialog } from "@/pages/store/components/confirm-dialog"
import { ChannelFormDialog } from "../components/channel-form-dialog"
import { sx, st } from "../lib/styles"

// Audit-log action filter options. "" = all. Values must match the backend
// action constants (server/internal/audit/audit.go).
const AUDIT_ACTIONS = [
  "",
  "enterprise.create",
  "enterprise.update",
  "enterprise.delete",
  "system_role.grant",
  "system_role.revoke",
  "resource_permission.update",
  "distribution.create",
  "distribution.update",
  "distribution.revoke",
  "notification_channel.create",
  "notification_channel.update",
  "notification_channel.delete",
  "setting.update",
  "announcement.send",
] as const

const AUDIT_PAGE_SIZE = 20
const ANNOUNCEMENT_SCOPES = ["all", "organization", "user"] as const
type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number]

// Tab order. `audit` / `announcements` are placeholder tabs handed off to the
// next sub-agent (see the placeholder panels at the bottom of this file).
const TABS = ["channels", "settings", "audit", "announcements"] as const
type Tab = (typeof TABS)[number]

// A settings row in the editable KV table. `raw` is the JSON text the admin
// edits; `original` is the last-saved JSON text (for dirty detection).
type SettingRow = { key: string; raw: string; original: string; saving: boolean }

// Seed example keys so the settings tab is usable before any value exists. These
// match the keys the PRD calls out (maintenance_mode, announcement_enabled).
const SEED_SETTING_KEYS = ["maintenance_mode", "announcement_enabled"] as const

function stringifyValue(value: unknown): string {
  return JSON.stringify(value ?? null)
}

// parseSettingValue mirrors the save-time parse: blank text means null, otherwise
// the text is parsed as JSON. Returns the parsed value plus whether it was valid
// JSON (invalid text is treated as a distinct, unsaveable state).
function parseSettingValue(raw: string): { value: unknown; valid: boolean } {
  const trimmed = raw.trim()
  if (trimmed === "") return { value: null, valid: true }
  try {
    return { value: JSON.parse(trimmed), valid: true }
  } catch {
    return { value: undefined, valid: false }
  }
}

// settingDirty compares the parsed (semantic) value of the edited text against
// the last-saved text, so whitespace/formatting-only edits don't count as dirty.
// Invalid JSON is always considered dirty (so the admin can attempt a save and
// see the validation toast).
function settingDirty(row: { raw: string; original: string }): boolean {
  const current = parseSettingValue(row.raw)
  if (!current.valid) return true
  const saved = parseSettingValue(row.original)
  return stringifyValue(current.value) !== stringifyValue(saved.value)
}

export default function AdminOps() {
  const language = useLanguage()
  const dialog = useDialog()
  const [tab, setTab] = createSignal<Tab>("channels")
  const tabLabel = (t: Tab) => language.t(`admin.ops.tabs.${t}` as "admin.ops.tabs.channels")

  // Audit is not the default tab, so it loads lazily on first visit (mirrors the
  // orgsLoaded pattern in members.tsx) rather than firing a query on mount.
  function switchTab(t: Tab) {
    setTab(t)
    if (t === "audit" && !audit.loaded && !audit.loading) void loadAudit()
  }

  // ── Tab: Notification channels ─────────────────────────────────────────────
  const [channels, setChannels] = createStore<{ items: SystemNotificationChannel[]; loading: boolean }>({
    items: [],
    loading: true,
  })

  async function loadChannels() {
    setChannels("loading", true)
    try {
      const res = await adminNotificationChannelApi.list()
      setChannels("items", res.channels ?? [])
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.ops.channels.toast.loadFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setChannels("loading", false)
    }
  }

  const openCreateChannel = () =>
    dialog.show(() => <ChannelFormDialog mode="create" onSaved={loadChannels} />)
  const openEditChannel = (ch: SystemNotificationChannel) =>
    dialog.show(() => <ChannelFormDialog mode="edit" channel={ch} onSaved={loadChannels} />)
  const openDeleteChannel = (ch: SystemNotificationChannel) =>
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("admin.ops.channels.delete.title")}
        description={language.t("admin.ops.channels.delete.description", { name: ch.name })}
        onConfirm={async () => {
          await adminNotificationChannelApi.remove(ch.id)
          showToast({ variant: "success", title: language.t("admin.ops.channels.toast.deleteSuccess") })
          void loadChannels()
        }}
      />
    ))

  // ── Tab: System settings ───────────────────────────────────────────────────
  const [settings, setSettings] = createStore<{ rows: SettingRow[]; loading: boolean }>({
    rows: [],
    loading: true,
  })

  async function loadSettings() {
    setSettings("loading", true)
    try {
      const res = await adminSettingsApi.list()
      const fetched = res.settings ?? {}
      const keys = new Set<string>([...SEED_SETTING_KEYS, ...Object.keys(fetched)])
      const rows: SettingRow[] = [...keys].sort().map((key) => {
        const raw = key in fetched ? stringifyValue(fetched[key]) : ""
        return { key, raw, original: raw, saving: false }
      })
      setSettings("rows", rows)
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.ops.settings.toast.loadFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSettings("loading", false)
    }
  }

  async function saveSetting(index: number) {
    const row = settings.rows[index]
    if (!row) return
    const { value: parsed, valid } = parseSettingValue(row.raw)
    if (!valid) {
      showToast({ variant: "error", title: language.t("admin.ops.settings.toast.valueInvalid") })
      return
    }
    setSettings("rows", index, "saving", true)
    try {
      await adminSettingsApi.update(row.key, parsed)
      setSettings("rows", index, "original", row.raw)
      showToast({ variant: "success", title: language.t("admin.ops.settings.toast.saveSuccess") })
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.ops.settings.toast.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSettings("rows", index, "saving", false)
    }
  }

  // ── Tab: Audit log ─────────────────────────────────────────────────────────
  const [audit, setAudit] = createStore<{
    logs: AdminAuditLog[]
    total: number
    loading: boolean
    loaded: boolean
    action: string
    from: string
    to: string
    page: number
  }>({ logs: [], total: 0, loading: false, loaded: false, action: "", from: "", to: "", page: 1 })

  const auditTotalPages = createMemo(() => Math.max(1, Math.ceil(audit.total / AUDIT_PAGE_SIZE)))

  async function loadAudit() {
    setAudit("loading", true)
    try {
      const res = await adminAuditApi.list({
        action: audit.action || undefined,
        from: audit.from || undefined,
        to: audit.to || undefined,
        page: audit.page,
        pageSize: AUDIT_PAGE_SIZE,
      })
      setAudit("logs", res.logs ?? [])
      setAudit("total", res.total ?? 0)
      setAudit("loaded", true)
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.ops.audit.toast.loadFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setAudit("loading", false)
    }
  }

  // Resolve actor display names for the current page.
  const [actorNames] = createResource(
    () => audit.logs.map((l) => l.actorId).filter(Boolean),
    (ids) => (ids.length ? userApi.getNames(ids) : Promise.resolve({} as Record<string, string>)),
  )

  function setAuditFilter<K extends "action" | "from" | "to">(key: K, value: string) {
    setAudit(key, value)
    setAudit("page", 1)
    void loadAudit()
  }

  function gotoAuditPage(p: number) {
    if (p < 1 || p > auditTotalPages()) return
    setAudit("page", p)
    void loadAudit()
  }

  const actionLabel = (a: string) =>
    a === "" ? language.t("admin.ops.audit.filter.allActions") : language.t(`admin.ops.audit.action.${a}` as "admin.ops.audit.action.setting.update")

  const fmtDateTime = (iso?: string) => {
    if (!iso) return "—"
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(language.locale() === "zh" ? "zh-CN" : "en-US")
  }

  const summarizePayload = (payload: Record<string, unknown>) => {
    if (!payload || Object.keys(payload).length === 0) return ""
    try {
      return JSON.stringify(payload)
    } catch {
      return ""
    }
  }

  // ── Tab: Announcements / broadcast ──────────────────────────────────────────
  const [announce, setAnnounce] = createStore<{
    scope: AnnouncementScope
    targetId: string
    title: string
    content: string
    pushExternal: boolean
    sending: boolean
  }>({ scope: "all", targetId: "", title: "", content: "", pushExternal: false, sending: false })

  const announceTargetRequired = createMemo(() => announce.scope === "organization" || announce.scope === "user")

  async function sendAnnouncement(e: Event) {
    e.preventDefault()
    if (announce.sending) return
    if (announce.title.trim() === "" || announce.content.trim() === "") {
      showToast({ variant: "error", title: language.t("admin.ops.announcements.toast.required") })
      return
    }
    if (announceTargetRequired() && announce.targetId.trim() === "") {
      showToast({ variant: "error", title: language.t("admin.ops.announcements.toast.targetRequired") })
      return
    }

    const payload: AnnouncementPayload = {
      scope: {
        type: announce.scope,
        ...(announceTargetRequired() ? { targetId: announce.targetId.trim() } : {}),
      },
      title: announce.title.trim(),
      content: announce.content.trim(),
      pushExternal: announce.pushExternal,
    }

    setAnnounce("sending", true)
    try {
      const res = await adminAnnouncementApi.send(payload)
      showToast({
        variant: "success",
        title: language.t("admin.ops.announcements.toast.sent"),
        description: language.t("admin.ops.announcements.toast.sentCount", { count: String(res.sentCount) }),
      })
      // Reset the composer body but keep the chosen scope for repeat sends.
      setAnnounce({ title: "", content: "" })
      // A broadcast is itself an audited write; refresh the audit feed only if it
      // has already been loaded (don't trigger a first load from here).
      if (audit.loaded) void loadAudit()
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.ops.announcements.toast.failed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setAnnounce("sending", false)
    }
  }

  onMount(() => {
    void loadChannels()
    void loadSettings()
    // Audit loads lazily on first switch to its tab (see switchTab).
  })

  return (
    <section class={sx.section}>
      <div class={sx.head}>
        <div>
          <h1 class={sx.title}>{language.t("admin.ops.title")}</h1>
          <p class={sx.sub}>{language.t("admin.ops.subtitle")}</p>
        </div>
      </div>

      {/* Tabs */}
      <div class="mb-4 flex flex-wrap gap-1" role="tablist" aria-label={language.t("admin.ops.title")}>
        <For each={TABS}>
          {(t) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab() === t}
              class={st.tab(tab() === t)}
              onClick={() => switchTab(t)}
            >
              {tabLabel(t)}
            </button>
          )}
        </For>
      </div>

      {/* ── Tab: Notification channels ── */}
      <Show when={tab() === "channels"}>
        <div class="flex flex-col gap-3">
          <div class="flex items-start justify-between gap-3">
            <p class={sx.sub}>{language.t("admin.ops.channels.help")}</p>
            <Button onClick={openCreateChannel} class="shrink-0 cursor-pointer">
              {language.t("admin.ops.channels.create")}
            </Button>
          </div>

          <div class={sx.tableShell}>
            <Show when={channels.loading}>
              <div class={sx.overlay}>
                <div class={sx.spinner} />
              </div>
            </Show>

            <table class={sx.dtStatic}>
              <thead>
                <tr>
                  <th>{language.t("admin.ops.channels.columns.name")}</th>
                  <th class="w-32">{language.t("admin.ops.channels.columns.type")}</th>
                  <th class="w-24">{language.t("admin.ops.channels.columns.status")}</th>
                  <th class="w-32 text-right">{language.t("admin.ops.channels.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                <For each={channels.items}>
                  {(ch) => (
                    <tr>
                      <td class="font-semibold text-[var(--native-foreground)]">{ch.name}</td>
                      <td class="text-[var(--native-muted)]">
                        {language.t(`admin.ops.channels.type.${ch.type}` as "admin.ops.channels.type.wecom")}
                      </td>
                      <td>
                        <span
                          class="inline-flex items-center gap-1.5 rounded-[var(--native-radius-full)] px-2 py-0.5 text-[11px]"
                          classList={{
                            "bg-[color:color-mix(in_oklab,var(--native-success)_14%,transparent)] text-[var(--native-success)]":
                              ch.enabled,
                            "bg-[color:color-mix(in_oklab,var(--native-muted)_14%,transparent)] text-[var(--native-muted)]":
                              !ch.enabled,
                          }}
                        >
                          {language.t(ch.enabled ? "admin.ops.channels.status.enabled" : "admin.ops.channels.status.disabled")}
                        </span>
                      </td>
                      <td class="text-right">
                        <div class="inline-flex gap-3">
                          <button
                            type="button"
                            class="cursor-pointer text-[var(--native-primary)] transition-colors hover:underline"
                            onClick={() => openEditChannel(ch)}
                          >
                            {language.t("admin.ops.channels.actions.edit")}
                          </button>
                          <button
                            type="button"
                            class="cursor-pointer text-[var(--native-error)] transition-colors hover:underline"
                            onClick={() => openDeleteChannel(ch)}
                          >
                            {language.t("admin.ops.channels.actions.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            <Show when={!channels.loading && channels.items.length === 0}>
              <div class={sx.state}>{language.t("admin.ops.channels.empty")}</div>
            </Show>
          </div>
        </div>
      </Show>

      {/* ── Tab: System settings ── */}
      <Show when={tab() === "settings"}>
        <div class="flex flex-col gap-3">
          <p class={sx.sub}>{language.t("admin.ops.settings.help")}</p>

          <div class={sx.tableShell}>
            <Show when={settings.loading}>
              <div class={sx.overlay}>
                <div class={sx.spinner} />
              </div>
            </Show>

            <table class={sx.dtStatic}>
              <thead>
                <tr>
                  <th class="w-64">{language.t("admin.ops.settings.columns.key")}</th>
                  <th>{language.t("admin.ops.settings.columns.value")}</th>
                  <th class="w-28 text-right">{language.t("admin.ops.settings.columns.actions")}</th>
                </tr>
              </thead>
              <tbody>
                <For each={settings.rows}>
                  {(row, index) => (
                    <tr>
                      <td class="align-top font-mono text-[0.8125rem] text-[var(--native-foreground)]">{row.key}</td>
                      <td>
                        <input
                          type="text"
                          class="w-full rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 py-1.5 font-mono text-xs text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                          placeholder={language.t("admin.ops.settings.valuePlaceholder")}
                          aria-label={`${row.key} ${language.t("admin.ops.settings.columns.value")}`}
                          value={row.raw}
                          onInput={(e) => setSettings("rows", index(), "raw", e.currentTarget.value)}
                        />
                      </td>
                      <td class="text-right align-top">
                        <Button
                          size="sm"
                          variant="outline"
                          class="cursor-pointer"
                          disabled={row.saving || !settingDirty(row)}
                          onClick={() => void saveSetting(index())}
                        >
                          {row.saving ? language.t("common.saving") : language.t("common.save")}
                        </Button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            <Show when={!settings.loading && settings.rows.length === 0}>
              <div class={sx.state}>{language.t("admin.ops.settings.empty")}</div>
            </Show>
          </div>
        </div>
      </Show>

      {/* ── Tab: Audit log ── */}
      <Show when={tab() === "audit"}>
        <div class="flex flex-col gap-3">
          <p class={sx.sub}>{language.t("admin.ops.audit.help")}</p>

          {/* Filters */}
          <div class="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                {language.t("admin.ops.audit.filter.action")}
              </span>
              <select
                class="cursor-pointer rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 py-1.5 text-xs text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                value={audit.action}
                onChange={(e) => setAuditFilter("action", e.currentTarget.value)}
              >
                <For each={AUDIT_ACTIONS}>{(a) => <option value={a}>{actionLabel(a)}</option>}</For>
              </select>
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                {language.t("admin.ops.audit.filter.from")}
              </span>
              <input
                type="date"
                class="cursor-pointer rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 py-1.5 text-xs text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                value={audit.from}
                onChange={(e) => setAuditFilter("from", e.currentTarget.value)}
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                {language.t("admin.ops.audit.filter.to")}
              </span>
              <input
                type="date"
                class="cursor-pointer rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 py-1.5 text-xs text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                value={audit.to}
                onChange={(e) => setAuditFilter("to", e.currentTarget.value)}
              />
            </label>
            <Show when={audit.action || audit.from || audit.to}>
              <Button
                size="sm"
                variant="outline"
                class="cursor-pointer"
                onClick={() => {
                  setAudit({ action: "", from: "", to: "", page: 1 })
                  void loadAudit()
                }}
              >
                {language.t("admin.ops.audit.filter.clear")}
              </Button>
            </Show>
          </div>

          {/* Table */}
          <div class={sx.tableShell}>
            <Show when={audit.loading}>
              <div class={sx.overlay}>
                <div class={sx.spinner} />
              </div>
            </Show>

            <table class={sx.dtStatic}>
              <thead>
                <tr>
                  <th class="w-44">{language.t("admin.ops.audit.columns.time")}</th>
                  <th class="w-40">{language.t("admin.ops.audit.columns.actor")}</th>
                  <th class="w-48">{language.t("admin.ops.audit.columns.action")}</th>
                  <th class="w-40">{language.t("admin.ops.audit.columns.target")}</th>
                  <th>{language.t("admin.ops.audit.columns.detail")}</th>
                </tr>
              </thead>
              <tbody>
                <For each={audit.logs}>
                  {(log) => (
                    <tr>
                      <td class="text-[var(--native-muted)] [font-variant-numeric:tabular-nums]">{fmtDateTime(log.createdAt)}</td>
                      <td class="truncate text-[var(--native-foreground)]">{actorNames()?.[log.actorId] ?? log.actorId}</td>
                      <td class="text-[var(--native-foreground)]">{actionLabel(log.action)}</td>
                      <td class="text-[var(--native-muted)]">
                        <Show when={log.targetType}>
                          <span class="text-[11px] uppercase tracking-[0.04em]">{log.targetType}</span>
                        </Show>
                        <Show when={log.targetId}>
                          <div class="truncate text-[var(--native-foreground)]">{log.targetId}</div>
                        </Show>
                      </td>
                      <td class="max-w-0">
                        <Show
                          when={summarizePayload(log.payload)}
                          fallback={<span class="text-[11px] text-[var(--native-muted)]">—</span>}
                        >
                          {(payload) => (
                            <span
                              tabindex={0}
                              class="block truncate font-mono text-[11px] text-[var(--native-muted)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--native-primary)]"
                              title={payload()}
                              aria-label={`${language.t("admin.ops.audit.columns.detail")}: ${payload()}`}
                            >
                              {payload()}
                            </span>
                          )}
                        </Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            <Show when={!audit.loading && audit.logs.length === 0}>
              <div class={sx.state}>{language.t("admin.ops.audit.empty")}</div>
            </Show>
          </div>

          {/* Pagination */}
          <Show when={audit.total > AUDIT_PAGE_SIZE}>
            <div class={sx.pager}>
              <span class={sx.pagerSum}>
                {language.t("admin.ops.audit.pagination.summary", {
                  page: String(audit.page),
                  total: String(auditTotalPages()),
                  count: String(audit.total),
                })}
              </span>
              <div class={sx.pagerActs}>
                <button
                  type="button"
                  class={sx.page}
                  disabled={audit.page <= 1}
                  aria-label={language.t("admin.ops.audit.pagination.prev")}
                  onClick={() => gotoAuditPage(audit.page - 1)}
                >
                  <Icon name="chevron-left" size="small" />
                </button>
                <button
                  type="button"
                  class={sx.page}
                  disabled={audit.page >= auditTotalPages()}
                  aria-label={language.t("admin.ops.audit.pagination.next")}
                  onClick={() => gotoAuditPage(audit.page + 1)}
                >
                  <Icon name="chevron-right" size="small" />
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* ── Tab: Announcements / broadcast ── */}
      <Show when={tab() === "announcements"}>
        <div class="flex flex-col gap-3">
          <p class={sx.sub}>{language.t("admin.ops.announcements.help")}</p>

          <form class="flex max-w-2xl flex-col gap-4" onSubmit={sendAnnouncement}>
            {/* Scope */}
            <div class="flex flex-col gap-1.5">
              <span class="text-[11px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                {language.t("admin.ops.announcements.form.scope")}
              </span>
              <div class="flex flex-wrap gap-1" aria-label={language.t("admin.ops.announcements.form.scope")}>
                <For each={ANNOUNCEMENT_SCOPES}>
                  {(s) => (
                    <button
                      type="button"
                      aria-pressed={announce.scope === s}
                      class={st.filter(announce.scope === s)}
                      onClick={() => setAnnounce("scope", s)}
                    >
                      {language.t(`admin.ops.announcements.scope.${s}` as "admin.ops.announcements.scope.all")}
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Target id (organization / user) */}
            <Show when={announceTargetRequired()}>
              <label class="flex flex-col gap-1.5">
                <span class="text-[11px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                  {announce.scope === "organization"
                    ? language.t("admin.ops.announcements.form.targetOrg")
                    : language.t("admin.ops.announcements.form.targetUser")}
                </span>
                <input
                  type="text"
                  class="w-full rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 py-1.5 text-sm text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                  placeholder={
                    announce.scope === "organization"
                      ? language.t("admin.ops.announcements.form.targetOrgPlaceholder")
                      : language.t("admin.ops.announcements.form.targetUserPlaceholder")
                  }
                  value={announce.targetId}
                  onInput={(e) => setAnnounce("targetId", e.currentTarget.value)}
                />
              </label>
            </Show>

            {/* Title */}
            <label class="flex flex-col gap-1.5">
              <span class="text-[11px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                {language.t("admin.ops.announcements.form.title")}
              </span>
              <input
                type="text"
                class="w-full rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 py-1.5 text-sm text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                placeholder={language.t("admin.ops.announcements.form.titlePlaceholder")}
                value={announce.title}
                onInput={(e) => setAnnounce("title", e.currentTarget.value)}
              />
            </label>

            {/* Content */}
            <label class="flex flex-col gap-1.5">
              <span class="text-[11px] uppercase tracking-[0.06em] text-[var(--native-muted)]">
                {language.t("admin.ops.announcements.form.content")}
              </span>
              <textarea
                rows={5}
                class="thin-scrollbar w-full resize-y rounded-[var(--native-radius-sm)] border border-border-base bg-background-base px-2.5 py-1.5 text-sm text-[var(--native-foreground)] transition-colors hover:border-border-strong focus-visible:border-text-interactive-base focus-visible:outline-none"
                placeholder={language.t("admin.ops.announcements.form.contentPlaceholder")}
                value={announce.content}
                onInput={(e) => setAnnounce("content", e.currentTarget.value)}
              />
            </label>

            {/* Push external */}
            <label class="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                class="size-4 cursor-pointer accent-[var(--native-primary)]"
                checked={announce.pushExternal}
                onChange={(e) => setAnnounce("pushExternal", e.currentTarget.checked)}
              />
              <span class="text-sm text-[var(--native-foreground)]">{language.t("admin.ops.announcements.form.pushExternal")}</span>
            </label>
            <p class={sx.sub}>{language.t("admin.ops.announcements.form.pushExternalHint")}</p>

            <div class="flex justify-end">
              <Button type="submit" class="cursor-pointer" disabled={announce.sending}>
                {announce.sending ? language.t("admin.ops.announcements.form.sending") : language.t("admin.ops.announcements.form.send")}
              </Button>
            </div>
          </form>
        </div>
      </Show>
    </section>
  )
}
