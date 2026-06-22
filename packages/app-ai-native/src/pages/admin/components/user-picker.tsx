import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import AvatarDisplay from "@/components/avatar-display"
import { useLanguage } from "@/context/language"
import { adminUserApi, type AdminUser, type EnterpriseMember } from "@/pages/store/lib/api"

// Reusable "pick people" control for binding accounts to an enterprise customer.
// Searches the local admin user roster by username/email and stores selections as
// EnterpriseMember (anchored on Casdoor universal_id). Candidates without a
// universal_id are surfaced but disabled, because enterprise bindings authenticate
// on universal_id only.
type Props = {
  selected: EnterpriseMember[]
  onChange: (members: EnterpriseMember[]) => void
}

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_PAGE_SIZE = 10

function toMember(u: AdminUser): EnterpriseMember {
  return {
    universalId: u.universalId,
    subjectId: u.subject_id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
  }
}

export function UserPicker(props: Props) {
  const language = useLanguage()

  const [state, setState] = createStore({
    query: "",
    results: [] as AdminUser[],
    searching: false,
  })

  let searchTimer: ReturnType<typeof setTimeout> | undefined
  // Monotonic request sequence: only the most recently dispatched search may apply its
  // results/searching flag. Guards against (a) a slow earlier request resolving after a newer
  // one and clobbering it, and (b) async results landing after the dialog is disposed.
  let lastReq = 0
  let disposed = false

  // Cancel any pending debounce timer and invalidate all in-flight requests when the picker
  // unmounts (dialog closed), so late results never setState / showToast on a dead component.
  onCleanup(() => {
    disposed = true
    clearTimeout(searchTimer)
    lastReq++
  })

  const selectedKeys = () => new Set(props.selected.map((m) => m.universalId))

  // Reset the search state to "no pending query": cancel the debounce timer AND bump the
  // sequence so neither a scheduled-but-not-yet-fired debounce nor an already in-flight
  // request can repopulate a cleared input. Used by both the empty-query path and the
  // "selected a candidate → clear box" path (addCandidate).
  const clearPendingSearch = () => {
    clearTimeout(searchTimer)
    lastReq++
    setState("results", [])
    setState("searching", false)
  }

  const runSearch = (q: string) => {
    clearTimeout(searchTimer)
    const trimmed = q.trim()
    if (!trimmed) {
      clearPendingSearch()
      return
    }
    searchTimer = setTimeout(async () => {
      const myReq = ++lastReq
      setState("searching", true)
      try {
        const res = await adminUserApi.list({ search: trimmed, pageSize: SEARCH_PAGE_SIZE })
        // Drop stale/superseded responses (a newer request or a cleanup ran meanwhile).
        if (disposed || myReq !== lastReq) return
        const chosen = selectedKeys()
        // Hide already-selected (matched by universal_id); keep universal_id-less rows so we can
        // show the disabled "no universal id" hint to the operator.
        setState(
          "results",
          (res.users ?? []).filter((u) => !u.universalId || !chosen.has(u.universalId)),
        )
      } catch (err) {
        if (disposed || myReq !== lastReq) return
        showToast({
          variant: "error",
          title: language.t("admin.enterprise.members.searchFailed"),
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        // Only the latest request may flip the spinner off, so a stale finally can't leave a
        // newer in-flight search showing "not searching" prematurely.
        if (!disposed && myReq === lastReq) setState("searching", false)
      }
    }, SEARCH_DEBOUNCE_MS)
  }

  const addCandidate = (u: AdminUser) => {
    if (!u.universalId) {
      showToast({ variant: "error", title: language.t("admin.enterprise.members.noUniversalId") })
      return
    }
    if (selectedKeys().has(u.universalId)) return
    props.onChange([...props.selected, toMember(u)])
    // Clearing the query empties the input, so clear the candidate list too — and cancel any
    // pending debounce timer / invalidate any in-flight search — to keep them consistent.
    // Without clearTimeout, a debounce scheduled before the pick would still fire with the old
    // query, become the latest request (myReq=++lastReq), pass the staleness guard, and refill
    // candidates under the now-empty box.
    setState("query", "")
    clearPendingSearch()
  }

  const removeMember = (universalId: string) => {
    props.onChange(props.selected.filter((m) => m.universalId !== universalId))
  }

  const memberLabel = (m: EnterpriseMember) =>
    m.displayName || m.username || m.subjectId || m.universalId

  const fieldLabel = "text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--native-muted)]"
  const inputCls =
    "h-9 w-full rounded-[var(--native-radius-sm)] border border-[color:color-mix(in_oklab,var(--native-border)_48%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_88%,var(--native-bg-subtle))] px-3 text-[0.8125rem] text-[var(--native-foreground)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--native-dim)] focus:border-[var(--native-primary)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--native-primary)_10%,transparent)]"
  const resultRow =
    "flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--native-radius-sm)] border border-[color:color-mix(in_oklab,var(--native-border)_40%,transparent)] bg-transparent px-2.5 py-2 text-left transition-colors hover:border-[color:color-mix(in_oklab,var(--native-primary)_30%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--native-primary)_4%,transparent)] focus-visible:outline-none focus-visible:border-[var(--native-primary)] focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--native-primary)_12%,transparent)]"
  const resultRowDisabled =
    "flex w-full items-center justify-between gap-3 rounded-[var(--native-radius-sm)] border border-dashed border-[color:color-mix(in_oklab,var(--native-border)_40%,transparent)] bg-transparent px-2.5 py-2 text-left opacity-70"

  return (
    <div class="flex flex-col gap-2">
      <span class={fieldLabel}>{language.t("admin.enterprise.members.label")}</span>

      <input
        type="text"
        class={inputCls}
        aria-label={language.t("admin.enterprise.members.searchAria")}
        placeholder={language.t("admin.enterprise.members.searchPlaceholder")}
        value={state.query}
        onInput={(e) => {
          setState("query", e.currentTarget.value)
          runSearch(e.currentTarget.value)
        }}
      />

      {/* Selected members */}
      <Show
        when={props.selected.length > 0}
        fallback={
          <div class="rounded-[var(--native-radius-sm)] border border-dashed border-[color:color-mix(in_oklab,var(--native-border)_36%,transparent)] px-2.5 py-3 text-center text-[12px] text-[var(--native-muted)]">
            {language.t("admin.enterprise.members.empty")}
          </div>
        }
      >
        <div class="flex flex-col gap-1.5">
          <For each={props.selected}>
            {(m) => (
              <div class="flex items-center justify-between gap-3 rounded-[var(--native-radius-sm)] border border-[color:color-mix(in_oklab,var(--native-primary)_18%,transparent)] bg-[color:color-mix(in_oklab,var(--native-primary)_6%,transparent)] px-2.5 py-1.5">
                <div class="flex min-w-0 items-center gap-2">
                  <AvatarDisplay
                    avatarUrl={m.avatarUrl}
                    username={memberLabel(m)}
                    size="1.5rem"
                    class="shrink-0"
                  />
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="truncate text-[0.8125rem] text-[var(--native-foreground)]">
                        {memberLabel(m)}
                      </span>
                      <Show when={!m.subjectId}>
                        <span class="shrink-0 rounded-[var(--native-radius-full)] border border-[color:color-mix(in_oklab,var(--native-border)_46%,transparent)] bg-[color:color-mix(in_oklab,var(--native-bg-subtle)_70%,transparent)] px-1.5 py-px text-[10px] font-medium text-[var(--native-muted)]">
                          {language.t("admin.enterprise.members.unregistered")}
                        </span>
                      </Show>
                    </div>
                    <div class="truncate font-mono text-[11px] text-[var(--native-muted)]">{m.universalId}</div>
                  </div>
                </div>
                <button
                  type="button"
                  class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_color-mix(in_oklab,var(--native-primary)_30%,transparent)]"
                  aria-label={language.t("admin.enterprise.members.remove", { name: memberLabel(m) })}
                  onClick={() => removeMember(m.universalId)}
                >
                  <Icon name="close-small" size="small" />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Candidate list */}
      <Show when={state.searching}>
        <div class="py-2 text-center text-[0.8125rem] text-[var(--native-muted)]">
          {language.t("admin.enterprise.members.searching")}
        </div>
      </Show>
      <Show when={!state.searching && state.query.trim() && state.results.length === 0}>
        <div class="py-2 text-center text-[0.8125rem] text-[var(--native-muted)]">
          {language.t("admin.enterprise.members.noResults")}
        </div>
      </Show>
      <Show when={!state.searching && state.results.length > 0}>
        <div class="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
          <For each={state.results}>
            {(u) => (
              <Show
                when={u.universalId}
                fallback={
                  <div class={resultRowDisabled} aria-disabled="true">
                    <div class="flex min-w-0 items-center gap-2">
                      <AvatarDisplay
                        avatarUrl={u.avatarUrl}
                        username={u.displayName || u.username || u.email}
                        size="1.5rem"
                        class="shrink-0"
                      />
                      <div class="min-w-0">
                        <div class="truncate text-[0.8125rem] text-[var(--native-foreground)]">
                          {u.displayName || u.username}
                        </div>
                        <div class="truncate text-[12px] text-[var(--native-muted)]">{u.email}</div>
                      </div>
                    </div>
                    <span class="flex shrink-0 items-center gap-1 text-[11px] text-[var(--native-muted)]">
                      <Icon name="warning" size="small" />
                      {language.t("admin.enterprise.members.noUniversalIdShort")}
                    </span>
                  </div>
                }
              >
                <button type="button" class={resultRow} onClick={() => addCandidate(u)}>
                  <div class="flex min-w-0 items-center gap-2">
                    <AvatarDisplay
                      avatarUrl={u.avatarUrl}
                      username={u.displayName || u.username || u.email}
                      size="1.5rem"
                      class="shrink-0"
                    />
                    <div class="min-w-0">
                      <div class="truncate text-[0.8125rem] text-[var(--native-foreground)]">
                        {u.displayName || u.username}
                      </div>
                      <div class="truncate text-[12px] text-[var(--native-muted)]">{u.email}</div>
                    </div>
                  </div>
                  <Icon name="plus-small" size="small" class="shrink-0 text-[var(--native-muted)]" />
                </button>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
