import { createResource, createMemo, createEffect, on, onMount, onCleanup, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@opencode-ai/ui/icon"
import { useAuth } from "../hooks/use-auth"
import { itemApi } from "../lib/api"
import { useRepoFilter } from "../context/repo-filter"
import { useRepoItems } from "../hooks/use-repo-items"
import { useLanguage } from "@/context/language"
import { categoryKey } from "../lib/constants"
import ItemCard from "../components/item-card"
import SearchBar from "../components/search-bar"
import { StoreCreateButton } from "../components/store-create"

const PER_PAGE = 24

export default function McpServers() {
  const language = useLanguage()
  const { selectedRepo } = useRepoFilter()
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = createStore({ value: 0 })
  const repoSelection = () => {
    refreshKey.value
    const repo = selectedRepo()
    return repo ? { ...repo } : null
  }
  const { items: repoItems, loading: repoLoading } = useRepoItems(repoSelection, "mcp")

  // Global mode: fetch all at once (limit 500), same as original
  const [global, { refetch }] = createResource(
    () => ({ active: !selectedRepo(), refreshKey: refreshKey.value }),
    ({ active }) => (active ? itemApi.list({ type: "mcp", limit: 500 }) : Promise.resolve(null)),
  )

  const [state, setState] = createStore({ category: "all", search: "", count: PER_PAGE })

  // Source switches between repository mode and global mode
  const source = () => (selectedRepo() ? repoItems() : (global()?.items ?? []))
  const loading = () => (selectedRepo() ? repoLoading() : global.loading)

  // Reset pagination when repository changes
  createEffect(on(selectedRepo, () => setState({ category: "all", search: "", count: PER_PAGE }), { defer: true }))

  const categories = createMemo(() => {
    const counts = new Map<string, number>()
    for (const item of source()) {
      if (item.category) counts.set(item.category, (counts.get(item.category) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
  })

  const filtered = createMemo(() => {
    let f = source()
    if (state.category !== "all") f = f.filter((i) => i.category === state.category)
    if (state.search) {
      const q = state.search.toLowerCase()
      f = f.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
    }
    return f
  })

  const displayed = () => filtered().slice(0, state.count)
  const hasMore = () => state.count < filtered().length

  let sentinel: HTMLDivElement | undefined
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore()) setState("count", (c) => c + PER_PAGE)
      },
      { threshold: 0.1, rootMargin: "100px" },
    )
    if (sentinel) observer.observe(sentinel)
    onCleanup(() => observer.disconnect())
  })

  const total = () => (selectedRepo() ? repoItems().length : (global()?.total ?? 0))

  return (
    <div class="px-8 py-8">
      <div class="mb-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold mb-1 flex items-center gap-2.5 text-text-strong">
              <Icon name="server" class="text-purple-500" /> {language.t("store.sidebar.nav.mcpServers")}
              <Show when={selectedRepo()}>
                <span class="text-base font-normal text-text-weak">
                  — {selectedRepo()?.displayName || selectedRepo()?.name}
                </span>
              </Show>
            </h1>
            <p class="text-sm text-text-weak">{language.t("store.mcp-servers", { count: total() })}</p>
          </div>
          <Show when={user()}>
            <StoreCreateButton
              itemType="mcp"
              label={language.t("store.page.newMcpServer")}
              onCreated={() => {
                setRefreshKey("value", (value) => value + 1)
                if (!selectedRepo()) void refetch()
              }}
            />
          </Show>
        </div>
      </div>
      <div class="mb-6 max-w-sm">
        <SearchBar
          value={state.search}
          onChange={(v) => {
            setState("search", v)
            setState("count", PER_PAGE)
          }}
          placeholder={language.t("store.searchMcpServers")}
        />
      </div>
      <div class="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => {
            setState("category", "all")
            setState("count", PER_PAGE)
          }}
          class={`px-3 py-1.5 text-sm rounded-md transition-colors ${state.category === "all" ? "bg-bg-muted text-text-strong" : "text-text-weak hover:text-text-strong hover:bg-bg-muted"}`}
        >
          {language.t("store.console.filters.all")}
        </button>
        <For each={categories()}>
          {(cat) => (
            <button
              onClick={() => {
                setState("category", cat.id)
                setState("count", PER_PAGE)
              }}
              class={`px-3 py-1.5 text-sm rounded-md transition-colors ${state.category === cat.id ? "bg-bg-muted text-text-strong" : "text-text-weak hover:text-text-strong hover:bg-bg-muted"}`}
            >
              {language.t(categoryKey(cat.id))} ({cat.count})
            </button>
          )}
        </For>
      </div>
      <Show
        when={!loading()}
        fallback={<div class="flex justify-center py-16 text-text-weak">{language.t("store.loading")}</div>}
      >
        <Show
          when={filtered().length > 0}
          fallback={<div class="text-center py-16 text-text-weak">{language.t("store.noResults")}</div>}
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <For each={displayed()}>{(item) => <ItemCard item={item} />}</For>
          </div>
        </Show>
      </Show>
      <div ref={sentinel} class="py-8 flex justify-center">
        <Show when={hasMore()}>
          <span class="text-text-weak text-sm">{language.t("store.loadingMore")}</span>
        </Show>
        <Show when={!hasMore() && displayed().length > 0}>
          <p class="text-sm text-text-weak">
            {language.t("store.showingAll", {
              count: filtered().length,
              type: language.t("store.sidebar.nav.mcpServers").toLowerCase(),
            })}
          </p>
        </Show>
      </div>
    </div>
  )
}
