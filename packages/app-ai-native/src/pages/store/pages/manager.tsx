import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, For, onCleanup, Show, Suspense } from "solid-js"
import { createStore } from "solid-js/store"
import { LocalIcon } from "@/components/local-icon"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/context/language"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/pages/store/components/confirm-dialog"
import ItemDetailContent from "@/pages/store/components/item-detail-content"
import { ItemDetailLoadingSkeleton } from "@/pages/store/components/item-detail-loading-skeleton"
import { MoveCapabilityDialog } from "@/pages/store/components/move-capability-dialog"
import { useAuth } from "@/pages/store/hooks/use-auth"
import { getLoginUrl } from "@/pages/store/lib/auth"
import { behaviorApi, itemApi, repoApi, type CapabilityItem, type Repository } from "@/pages/store/lib/api"
import { TYPE_COLORS, typeKey } from "@/pages/store/lib/constants"
import { sx } from "@/pages/store/lib/styles"

const PAGE_SIZE = 10
const STORE_TYPES = [
  { value: "skill", labelKey: "store.sidebar.nav.skills", icon: "sparkles" as const, color: "#ffa000", bg: "#FEF3C7" },
  { value: "subagent", labelKey: "store.sidebar.nav.subagents", icon: "brain" as const, color: "#1670ff", bg: "#DBEAFE" },
  { value: "command", labelKey: "store.sidebar.nav.commands", icon: "console" as const, color: "#09b179", bg: "#D1FAE5" },
  { value: "mcp", labelKey: "store.sidebar.nav.mcpServers", icon: "mcp" as const, color: "#7338f9", bg: "#EDE9FE" },
] as const

type TabKey = "created" | "favorited"
type StoreType = (typeof STORE_TYPES)[number]["value"]

export default function StoreManagerPage() {
  const dialog = useDialog()
  const language = useLanguage()
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  const [selectedItemId, setSelectedItemId] = createStore<{ value: string | null }>({ value: null })
  const [detailState, setDetailState] = createStore({
    item: null as CapabilityItem | null,
    renderItemId: null as string | null,
    favoritePending: false,
    favorited: false,
    favoriteCount: 0,
    previewCount: 0,
    installCount: 0,
    trackedItemId: null as string | null,
    contentReady: false,
  })
  let detailContentTimer: ReturnType<typeof setTimeout> | undefined
  const [state, setState] = createStore({
    tab: "created" as TabKey,
    type: "skill" as StoreType,
    hoveredType: null as StoreType | null,
    search: "",
    items: [] as CapabilityItem[],
    totalItems: 0,
    loadingItems: false,
    itemPage: 1,
    repos: [] as Repository[],
    favoritedItems: [] as CapabilityItem[],
    favoritedTotal: 0,
    favoritedLoading: false,
    favoritedPage: 1,
  })

  const userId = createMemo(() => user()?.id ?? user()?.subjectId ?? user()?.sub ?? "")
  const detailOpen = createMemo(() => !!selectedItemId.value)
  const activePage = createMemo(() => (state.tab === "created" ? state.itemPage : state.favoritedPage))
  const activeTotal = createMemo(() => (state.tab === "created" ? state.totalItems : state.favoritedTotal))
  const activeItems = createMemo(() => (state.tab === "created" ? state.items : state.favoritedItems))
  const activeLoading = createMemo(() => (state.tab === "created" ? state.loadingItems : state.favoritedLoading))
  const totalPages = createMemo(() => Math.max(1, Math.ceil(activeTotal() / PAGE_SIZE)))
  let initializedForUser = ""
  const statCards = createMemo(() => STORE_TYPES)

  const buildPages = (total: number, cur: number) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    const set = new Set([1, 2, cur - 1, cur, cur + 1, total - 1, total])
    const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
    const result: (number | "...")[] = []
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...")
      result.push(sorted[i])
    }
    return result
  }

  const pages = createMemo(() => buildPages(totalPages(), activePage()))

  const loadCreated = async (page = state.itemPage, search = state.search) => {
    if (!userId() || state.loadingItems) return
    setState("loadingItems", true)
    try {
      const res = await itemApi.listMy(userId(), {
        type: state.type,
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
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

  const loadFavorited = async (page = state.favoritedPage, search = state.search) => {
    if (state.favoritedLoading) return
    setState("favoritedLoading", true)
    try {
      const res = await itemApi.list({
        type: state.type,
        favorited: true,
        page,
        pageSize: PAGE_SIZE,
        search: search.trim() || undefined,
      })
      setState("favoritedItems", res.items ?? [])
      setState("favoritedTotal", res.total ?? 0)
    } catch (error) {
      showToast({
        title: language.t("store.console.capabilities.toast.loadFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setState("favoritedLoading", false)
    }
  }

  createEffect(() => {
    const currentUserId = userId()
    if (!currentUserId || initializedForUser === currentUserId) return
    initializedForUser = currentUserId
    void loadCreated(1, "")
    void loadFavorited(1, "")
    void repoApi.listMy(currentUserId).then((res) => setState("repos", res.repositories ?? []))
  })

  createEffect(() => {
    const itemId = selectedItemId.value
    clearTimeout(detailContentTimer)
    if (!itemId) {
      setDetailState("contentReady", false)
      setDetailState("renderItemId", null)
      return
    }
    setDetailState("contentReady", false)
    detailContentTimer = setTimeout(() => {
      setDetailState("renderItemId", itemId)
      setDetailState("contentReady", true)
    }, 180)
  })

  createEffect(() => {
    const data = detailState.item
    if (!data) return
    setDetailState({
      previewCount: data.previewCount ?? 0,
      installCount: data.installCount ?? 0,
      favorited: Boolean(data.favorited),
      favoriteCount: data.favoriteCount ?? 0,
    })
  })

  createEffect(() => {
    const data = detailState.item
    if (!data) return
    if (detailState.trackedItemId === data.id) return

    setDetailState("trackedItemId", data.id)
    void behaviorApi
      .log(data.id, {
        actionType: "view",
        context: "drawer",
        metadata: {
          source: "app-ai-native",
          route: "store-manager",
        },
      })
      .then(() => setDetailState("previewCount", (count) => count + 1))
      .catch(() => undefined)
  })

  const typeLabel = (type: string) => language.t(typeKey(type))

  const visColor = (vis?: string | null) => {
    if (vis === "public") return { bg: "color-mix(in srgb, #22c55e 12%, transparent)", c: "#22c55e" }
    if (vis === "private") return { bg: "color-mix(in srgb, #f59e0b 12%, transparent)", c: "#f59e0b" }
    return { bg: "rgba(156,163,175,0.12)", c: "var(--native-muted)" }
  }

  const refreshActiveTab = () => {
    if (state.tab === "created") {
      void loadCreated(state.itemPage, state.search)
      return
    }
    void loadFavorited(state.favoritedPage, state.search)
  }

  const openItemDetail = (item: CapabilityItem) => {
    setSelectedItemId("value", item.id)
    setDetailState("item", item)
  }

  onCleanup(() => {
    clearTimeout(detailContentTimer)
  })

  const openEditCapability = (item: CapabilityItem) => {
    navigate(`/capabilities/${item.id}/edit`)
  }

  const openMoveCapability = (item: CapabilityItem) => {
    dialog.show(() => <MoveCapabilityDialog item={item} repositories={state.repos} onMoved={() => void loadCreated(state.itemPage, state.search)} />)
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
          void loadCreated(state.itemPage, state.search)
        }}
      />
    ))
  }

  const unfavoriteItem = async (id: string) => {
    await behaviorApi.unfavorite(id)
    void loadFavorited(state.favoritedPage, state.search)
  }

  const toggleFavorite = async () => {
    const data = detailState.item
    if (!data || !user() || loading() || detailState.favoritePending) return

    setDetailState("favoritePending", true)
    try {
      if (detailState.favorited) {
        const result = await behaviorApi.unfavorite(data.id)
        setDetailState("favorited", result.favorited)
        setDetailState("favoriteCount", result.favoriteCount)
      } else {
        const result = await behaviorApi.favorite(data.id)
        setDetailState("favorited", result.favorited)
        setDetailState("favoriteCount", result.favoriteCount)
      }
      refreshActiveTab()
      if (state.tab === "created") void loadFavorited(state.favoritedPage, state.search)
    } finally {
      setDetailState("favoritePending", false)
    }
  }

  const switchTab = (tab: TabKey) => {
    if (state.tab === tab) return
    setState("tab", tab)
    if (tab === "created") {
      setState("itemPage", 1)
      void loadCreated(1, state.search)
      return
    }
    setState("favoritedPage", 1)
    void loadFavorited(1, state.search)
  }

  const handleTypeChange = (type: StoreType) => {
    if (state.type === type) return
    setState("type", type)
    if (state.tab === "created") {
      setState("itemPage", 1)
      void loadCreated(1, state.search)
      return
    }
    setState("favoritedPage", 1)
    void loadFavorited(1, state.search)
  }

  const handleSearch = (value: string) => {
    setState("search", value)
    if (state.tab === "created") {
      setState("itemPage", 1)
      void loadCreated(1, value)
      return
    }
    setState("favoritedPage", 1)
    void loadFavorited(1, value)
  }

  const setPage = (page: number) => {
    if (state.tab === "created") {
      setState("itemPage", page)
      void loadCreated(page, state.search)
      return
    }
    setState("favoritedPage", page)
    void loadFavorited(page, state.search)
  }

  const Pagination = () => (
    <Show when={totalPages() > 1}>
      <div class={sx.pager}>
        <p class={sx.pagerSum}>
          {language.t("store.console.capabilities.showing", {
            from: (activePage() - 1) * PAGE_SIZE + 1,
            to: Math.min(activePage() * PAGE_SIZE, activeTotal()),
            total: activeTotal(),
          })}
        </p>
        <div class={sx.pagerActs}>
          <Button variant="ghost" size="sm" type="button" disabled={activePage() <= 1} onClick={() => setPage(activePage() - 1)}>
            <Icon name="chevron-left" size="small" />
          </Button>
          <For each={pages()}>
            {(p) => (
              <Show
                when={p !== "..."}
                fallback={<span class={cn(sx.page, "cursor-default hover:bg-transparent hover:text-[var(--native-muted)]")}>...</span>}
              >
                <Button variant={activePage() === p ? "default" : "ghost"} size="sm" type="button" onClick={() => setPage(p as number)}>
                  {p}
                </Button>
              </Show>
            )}
          </For>
          <Button variant="ghost" size="sm" type="button" disabled={activePage() >= totalPages()} onClick={() => setPage(activePage() + 1)}>
            <Icon name="chevron-right" size="small" />
          </Button>
        </div>
      </div>
    </Show>
  )

  const CreatedTable = () => (
    <>
      <Table class="table-fixed text-[0.8125rem]">
        <TableHeader class={sx.thead}>
          <TableRow>
            <TableHead class={cn(sx.th, "w-[24%]")}>{language.t("store.home.table.title")}</TableHead>
            <TableHead class={cn(sx.th, "w-[30%]")}>{language.t("store.home.table.description")}</TableHead>
            <TableHead class={cn(sx.th, "w-[14%]")}>{language.t("store.console.capabilities.type")}</TableHead>
            <TableHead class={cn(sx.th, "w-[12%]")}>{language.t("store.console.capabilities.visibility")}</TableHead>
            <TableHead class={cn(sx.th, "w-[14%]")}>{language.t("store.home.table.source")}</TableHead>
            <TableHead class={cn(sx.th, "w-[6%] text-right")}>{language.t("common.operation")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={state.items}>
            {(item) => {
              const tc = () => TYPE_COLORS[item.itemType] || "#8B5CF6"
              const vc = () => visColor(item.repoVisibility)
              return (
                <TableRow class="cursor-pointer" onClick={() => openItemDetail(item)}>
                  <TableCell class="align-top">
                    <div class="line-clamp-1 font-medium text-[var(--native-foreground)]">{item.name}</div>
                  </TableCell>
                  <TableCell class="align-top text-[var(--native-muted)]">
                    <div class="line-clamp-2">{item.description || "—"}</div>
                  </TableCell>
                  <TableCell class="align-top">
                    <span class={sx.pill} style={{ background: `color-mix(in srgb, ${tc()} 12%, transparent)`, color: tc() }}>
                      {typeLabel(item.itemType)}
                    </span>
                  </TableCell>
                  <TableCell class="align-top">
                    <span class={sx.pill} style={{ background: vc().bg, color: vc().c }}>
                      {item.repoVisibility === "public"
                        ? language.t("store.capabilityDialog.visibility.public")
                        : item.repoVisibility === "private"
                          ? language.t("store.capabilityDialog.visibility.private")
                          : "-"}
                    </span>
                  </TableCell>
                  <TableCell class="align-top text-[var(--native-muted)]">{item.repoName || "—"}</TableCell>
                  <TableCell class="align-top text-right">
                    <div class="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" type="button" aria-label={language.t("common.open")} title={language.t("common.open")} onClick={() => openItemDetail(item)}>
                        <Icon name="arrow-right" size="small" />
                      </Button>
                      <Button variant="ghost" size="sm" type="button" aria-label={language.t("store.console.capabilities.move")} title={language.t("store.console.capabilities.move")} onClick={() => openMoveCapability(item)}>
                        <Icon name="share" size="small" />
                      </Button>
                      <Button variant="ghost" size="sm" type="button" aria-label={language.t("store.console.capabilities.edit")} title={language.t("store.console.capabilities.edit")} onClick={() => openEditCapability(item)}>
                        <Icon name="edit" size="small" />
                      </Button>
                      <Button variant="ghost" size="sm" type="button" class="text-destructive hover:text-destructive" aria-label={language.t("store.console.capabilities.delete")} title={language.t("store.console.capabilities.delete")} onClick={() => handleDeleteItem(item.id)}>
                        <Icon name="trash" size="small" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }}
          </For>
        </TableBody>
      </Table>
      <Pagination />
    </>
  )

  const FavoritedTable = () => (
    <>
      <Table class="table-fixed text-[0.8125rem]">
        <TableHeader class={sx.thead}>
          <TableRow>
            <TableHead class={cn(sx.th, "w-[24%]")}>{language.t("store.home.table.title")}</TableHead>
            <TableHead class={cn(sx.th, "w-[34%]")}>{language.t("store.home.table.description")}</TableHead>
            <TableHead class={cn(sx.th, "w-[16%]")}>{language.t("store.console.capabilities.type")}</TableHead>
            <TableHead class={cn(sx.th, "w-[16%]")}>{language.t("store.home.table.source")}</TableHead>
            <TableHead class={cn(sx.th, "w-[10%] text-right")}>{language.t("common.operation")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={state.favoritedItems}>
            {(item) => {
              const tc = () => TYPE_COLORS[item.itemType] || "#8B5CF6"
              return (
                <TableRow class="cursor-pointer" onClick={() => openItemDetail(item)}>
                  <TableCell class="align-top">
                    <div class="line-clamp-1 font-medium text-[var(--native-foreground)]">{item.name}</div>
                  </TableCell>
                  <TableCell class="align-top text-[var(--native-muted)]">
                    <div class="line-clamp-2">{item.description || "—"}</div>
                  </TableCell>
                  <TableCell class="align-top">
                    <span class={sx.pill} style={{ background: `color-mix(in srgb, ${tc()} 12%, transparent)`, color: tc() }}>
                      {typeLabel(item.itemType)}
                    </span>
                  </TableCell>
                  <TableCell class="align-top text-[var(--native-muted)]">{item.repoName || "—"}</TableCell>
                  <TableCell class="align-top text-right">
                    <div class="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" type="button" aria-label={language.t("common.open")} title={language.t("common.open")} onClick={() => openItemDetail(item)}>
                        <Icon name="arrow-right" size="small" />
                      </Button>
                      <Button variant="ghost" size="sm" type="button" class="text-[rgb(202,138,4)] hover:text-[rgb(161,98,7)]" aria-label={language.t("store.detail.unfavorite")} title={language.t("store.detail.unfavorite")} onClick={(e) => { e.stopPropagation(); void unfavoriteItem(item.id) }}>
                        <LocalIcon name="star-filled" size="small" style={{ color: "currentColor" }} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }}
          </For>
        </TableBody>
      </Table>
      <Pagination />
    </>
  )

  return (
    <Show when={!loading()} fallback={<div class={sx.empty}>{language.t("store.loading")}</div>}>
      <Show
        when={user()}
        fallback={
          <div class={cn(sx.empty, "flex min-h-[40vh] items-center justify-center")}>
            <div style={{ "text-align": "center" }}>
              <h1 class={sx.toolbarTitle}>{language.t("store.console")}</h1>
              <p class={cn(sx.toolbarSub, "mb-3")}>{language.t("store.console.authDescription")}</p>
              <Button type="button" size="sm" onClick={() => { window.location.href = getLoginUrl("/store/manager") }}>
                {language.t("store.console.login")}
              </Button>
            </div>
          </div>
        }
      >
        <div class="flex h-full min-h-0 w-full flex-1 flex-col gap-6 max-[1280px]:gap-5">
          <header class="relative overflow-hidden bg-[linear-gradient(135deg,color-mix(in_srgb,var(--native-primary)_2%,white),color-mix(in_srgb,var(--native-primary)_10%,var(--native-panel))_62%,color-mix(in_srgb,var(--native-primary)_14%,var(--native-panel)))] before:pointer-events-none before:absolute before:right-[-10%] before:top-[-60%] before:h-[340px] before:w-[340px] before:rounded-full before:bg-[radial-gradient(circle,color-mix(in_srgb,var(--native-primary)_8%,transparent),transparent_70%)] before:content-['']">
            <div class="relative flex flex-row items-center justify-between gap-4 px-5 py-3 lg:gap-6">
              <div class="min-w-0 flex flex-1 items-center gap-4">
                <Button type="button" variant="outline" size="sm" class="h-8 px-3" onClick={() => navigate("/store")}>
                  <Icon name="chevron-left" size="small" />
                  {language.t("store.console.capabilities.backToHome")}
                </Button>
                <h1 class="relative m-0 shrink-0 text-[1.625rem] leading-[1.15] font-extrabold tracking-[-0.035em] text-[var(--native-foreground)]">{language.t("store.console.capabilities.title")}</h1>
              </div>

              <div class="flex shrink-0 items-center justify-end gap-3">
                <Tooltip value={language.t("store.console.capabilities.create")} placement="bottom">
                  <button
                    type="button"
                    class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[0.375rem] bg-[color:color-mix(in_oklab,var(--native-primary)_85%,white)] text-white shadow-[var(--native-shadow-sm)] transition-[background-color,filter,transform] hover:cursor-pointer hover:bg-[var(--native-primary)]"
                    aria-label={language.t("store.console.capabilities.create")}
                    onClick={() => navigate("/capabilities/new")}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="size-5"
                      style={{ color: "#ffffff" }}
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            </div>
          </header>

          <section class={sx.section}>
            <div class="mx-auto mt-4 flex w-full max-w-[64rem] items-center gap-3 max-[768px]:flex-col max-[768px]:items-stretch max-[640px]:gap-2">
              <div class="relative min-w-0 flex-1 rounded-full transition-shadow hover:shadow-[0_2px_6px_-3px_color-mix(in_srgb,var(--native-primary)_22%,rgba(15,23,42,0.3))] focus-within:shadow-[0_2px_6px_-3px_color-mix(in_srgb,var(--native-primary)_22%,rgba(15,23,42,0.3))]">
                <div class="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-[color:color-mix(in_srgb,var(--native-muted)_82%,white)]">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20 -3.5 -3.5" />
                  </svg>
                </div>
                <input
                  type="text"
                  inputmode="search"
                  placeholder={language.t("store.console.capabilities.searchPlaceholder")}
                  value={state.search}
                  onInput={(e) => handleSearch(e.currentTarget.value)}
                  class="h-12 w-full rounded-full border border-[color:color-mix(in_srgb,var(--native-border)_58%,transparent)] bg-[var(--native-panel)] pr-12 pl-11 text-base !text-[var(--native-foreground)] caret-[var(--native-primary)] placeholder:text-[color:color-mix(in_srgb,var(--native-muted)_72%,white)] shadow-[var(--native-shadow-sm)] focus-visible:border-2 focus-visible:border-[color:color-mix(in_srgb,var(--native-primary)_52%,var(--native-border))] focus-visible:!text-[var(--native-foreground)] focus-visible:placeholder:text-[color:color-mix(in_srgb,var(--native-muted)_36%,white)] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Show when={state.search.length > 0}>
                  <button type="button" aria-label={language.t("common.clear")} onClick={() => handleSearch("")} class="absolute inset-y-0 right-0 flex h-full w-12 cursor-pointer items-center justify-center rounded-r-full text-[color:color-mix(in_srgb,var(--native-muted)_78%,white)] transition-colors hover:text-[var(--native-foreground)]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </Show>
              </div>
              <div class="inline-flex shrink-0 items-center rounded-[0.5rem] border border-[color:color-mix(in_srgb,var(--native-border)_60%,transparent)] bg-[color:color-mix(in_srgb,var(--native-panel)_92%,white)] p-1 shadow-[var(--native-shadow-sm)]">
                <button type="button" class={cn("h-10 rounded-[0.375rem] px-3 text-sm font-medium transition-colors", state.tab === "created" ? "bg-[var(--native-primary)] text-white shadow-[var(--native-shadow-sm)]" : "text-[var(--native-muted)] hover:text-[var(--native-foreground)]")} onClick={() => switchTab("created")}>
                  {language.t("store.console.capabilities.myCreated")}
                </button>
                <button type="button" class={cn("h-10 rounded-[0.375rem] px-3 text-sm font-medium transition-colors", state.tab === "favorited" ? "bg-[var(--native-primary)] text-white shadow-[var(--native-shadow-sm)]" : "text-[var(--native-muted)] hover:text-[var(--native-foreground)]")} onClick={() => switchTab("favorited")}>
                  {language.t("store.console.capabilities.myFavorited")}
                </button>
              </div>
            </div>
          </section>

          <section class={cn(sx.section, "flex min-h-0 flex-1 flex-col p-3 sm:p-4")}>
            <div class="mb-3 flex flex-nowrap items-stretch justify-start gap-2 overflow-x-auto">
              <For each={statCards()}>
                {(entry) => (
                  <button
                    type="button"
                    class={cn(
                      "group flex shrink-0 items-center gap-1.5 rounded-[0.375rem] border border-transparent bg-transparent px-3 py-0.5 text-left cursor-pointer transition-[background-color,border-color,color,transform,box-shadow]",
                      entry.value === state.type && "border-transparent bg-[var(--stat-accent)] text-white",
                      state.hoveredType === entry.value && entry.value !== state.type && "bg-[color:color-mix(in_oklab,var(--stat-accent)_70%,white)] text-white",
                    )}
                    style={{ "--stat-accent": entry.color, "--stat-bg": entry.bg }}
                    onClick={() => handleTypeChange(entry.value)}
                    onMouseEnter={() => setState("hoveredType", entry.value)}
                    onMouseLeave={() => setState("hoveredType", (current) => (current === entry.value ? null : current))}
                    aria-pressed={entry.value === state.type}
                  >
                    <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-transparent">
                      <Icon
                        name={entry.icon}
                        class={cn("type-icon transition-colors", entry.value === state.type && "!text-white")}
                        style={{ color: entry.value === state.type || state.hoveredType === entry.value ? "#ffffff" : entry.color }}
                      />
                    </div>
                    <div class="min-w-0">
                      <div
                        class={cn(
                          "type-label text-[12px] uppercase tracking-[0.05em] text-[var(--native-foreground)]",
                          entry.value === state.type ? "font-bold !text-white" : "font-medium",
                        )}
                        style={entry.value === state.type || state.hoveredType === entry.value ? { color: "#ffffff", "font-weight": entry.value === state.type ? 700 : 500 } : undefined}
                      >
                        {language.t(entry.labelKey)}
                      </div>
                    </div>
                  </button>
                )}
              </For>
            </div>
            <div class={cn(sx.tableShell, "flex min-h-0 flex-1 flex-col")}>
              <Show when={!activeLoading()} fallback={<div class={sx.state}>{language.t(state.tab === "created" ? "store.console.capabilities.loading" : "store.console.capabilities.favorited.loading")}</div>}>
                <Show
                  when={activeItems().length > 0 || activeTotal() > 0}
                  fallback={<div class={sx.state}>{language.t(state.tab === "created" ? "store.console.capabilities.empty" : "store.console.capabilities.favorited.empty")}</div>}
                >
                  <Show when={state.tab === "created"} fallback={<FavoritedTable />}>
                    <CreatedTable />
                  </Show>
                </Show>
              </Show>
            </div>
          </section>

          <Sheet open={detailOpen()} onOpenChange={(open) => !open && setSelectedItemId("value", null)} modal={false}>
            <SheetContent position="right" class={cn(sx.sheet, "w-[min(68rem,94vw)] sm:max-w-none")} style={{ "background-color": "var(--st-surface-lowest, #ffffff)" }}>
              <SheetHeader class="sr-only">
                <SheetTitle>{language.t("store.home.detail.title")}</SheetTitle>
                <SheetDescription>{language.t("store.home.detail.description")}</SheetDescription>
              </SheetHeader>
              <Show when={detailState.renderItemId}>
                {(itemId) => (
                  <Show
                    when={detailState.contentReady}
                    fallback={<ItemDetailLoadingSkeleton class={sx.sheetBody} />}
                  >
                    <Suspense fallback={<div class="flex justify-center py-16 text-muted-foreground">{language.t("store.loading")}</div>}>
                      <ItemDetailContent
                        itemId={itemId()}
                        class={cn(sx.sheetBody, "thin-scrollbar")}
                        onItemLoaded={(item) => setDetailState("item", item)}
                        favorited={detailState.favorited}
                        favoriteCount={detailState.favoriteCount}
                        previewCount={detailState.previewCount}
                        installCount={detailState.installCount}
                        onToggleFavorite={toggleFavorite}
                        favoritePending={detailState.favoritePending}
                        isAuthenticated={!!user() && !loading()}
                      />
                    </Suspense>
                  </Show>
                )}
              </Show>
            </SheetContent>
          </Sheet>
        </div>
      </Show>
    </Show>
  )
}
