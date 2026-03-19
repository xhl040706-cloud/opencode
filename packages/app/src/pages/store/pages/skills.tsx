import { createStore } from "solid-js/store"
import { createEffect, createMemo, on, onMount, onCleanup, For, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { itemApi, type CapabilityItem } from "../lib/api"
import { useRepoFilter } from "../context/repo-filter"
import { useRepoItems } from "../hooks/use-repo-items"
import { useAuth } from "../hooks/use-auth"
import ItemCard from "../components/item-card"
import SearchBar from "../components/search-bar"
import { StoreCreateButton } from "../components/store-create"
import { useLanguage } from "@/context/language"

const PER_PAGE = 24

export default function Skills() {
  const language = useLanguage()
  const { selectedRepo } = useRepoFilter()
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = createStore({ value: 0 })
  const repoSelection = () => {
    refreshKey.value
    const repo = selectedRepo()
    return repo ? { ...repo } : null
  }
  const { items: repoItems, loading: repoLoading } = useRepoItems(repoSelection, "skill")

  // Global mode: server-side pagination with search
  const [state, setState] = createStore({
    items: [] as CapabilityItem[],
    total: 0,
    hasMore: false,
    loading: true,
    category: "all",
    search: "",
    offset: 0,
  })

  let sentinel: HTMLDivElement | undefined
  let debounce: ReturnType<typeof setTimeout>

  async function load(reset: boolean) {
    setState("loading", true)
    try {
      const offset = reset ? 0 : state.offset
      const res = await itemApi.list({ type: "skill", search: state.search || undefined, limit: PER_PAGE, offset })
      setState({
        items: reset ? res.items : [...state.items, ...res.items],
        total: res.total,
        hasMore: res.hasMore,
        offset: reset ? res.items.length : state.offset + res.items.length,
        loading: false,
      })
    } catch {
      setState("loading", false)
    }
  }

  // Reset and reload global when not in repository mode or search changes
  createEffect(
    on(
      () => [selectedRepo(), state.search, state.category] as const,
      ([repo]) => {
        if (repo) return // repository mode handled by useRepoItems
        setState("offset", 0)
        clearTimeout(debounce)
        debounce = setTimeout(() => load(true), 300)
      },
    ),
  )

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !selectedRepo() && state.hasMore && !state.loading) load(false)
      },
      { threshold: 0.1, rootMargin: "100px" },
    )
    if (sentinel) observer.observe(sentinel)
    onCleanup(() => observer.disconnect())
  })

  const isRepo = () => !!selectedRepo()

  // Repository mode: client-side search filter over repoItems
  const source = () => (isRepo() ? repoItems() : state.items)

  const categories = createMemo(() => {
    const counts = new Map<string, number>()
    for (const item of source()) {
      if (item.category) counts.set(item.category, (counts.get(item.category) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
  })

  const repoFiltered = createMemo(() => {
    let items = repoItems()
    if (state.category !== "all") items = items.filter((i) => i.category === state.category)
    if (!state.search) return items
    const q = state.search.toLowerCase()
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
  })

  const globalFiltered = createMemo(() => {
    let items = state.items
    if (state.category !== "all") items = items.filter((i) => i.category === state.category)
    return items
  })

  const items = () => (isRepo() ? repoFiltered() : globalFiltered())
  const loading = () => (isRepo() ? repoLoading() : state.loading && state.items.length === 0)
  const total = () => (isRepo() ? repoItems().length : state.total)

  return (
    <div class="px-6 py-6">
      <div class="mb-8">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold mb-1 flex items-center gap-2.5 text-text-strong">
              <Icon name="sparkles" class="text-yellow-500" /> {language.t("store.sidebar.nav.skills")}
              <Show when={selectedRepo()}>
                <span class="font-normal text-text-weak">— {selectedRepo()?.displayName || selectedRepo()?.name}</span>
              </Show>
            </h1>
            <p class="text-sm text-text-weak">{language.t("store.skills", { count: total() })}</p>
          </div>
          <Show when={user()}>
            <StoreCreateButton
              itemType="skill"
              label={language.t("store.page.newSkill")}
              onCreated={() => {
                setRefreshKey("value", (value) => value + 1)
                if (!selectedRepo()) void load(true)
              }}
            />
          </Show>
        </div>
      </div>
      <div class="mb-6 max-w-sm">
        <SearchBar
          value={state.search}
          onChange={(v) => setState("search", v)}
          placeholder={language.t("store.searchSkills")}
        />
      </div>
      <div class="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setState("category", "all")}
          class={`px-3 py-1.5 text-sm rounded-md transition-colors ${state.category === "all" ? "bg-bg-muted text-text-strong" : "text-text-weak hover:text-text-strong hover:bg-bg-muted"}`}
        >
          {language.t("store.console.filters.all")}
        </button>
        <For each={categories()}>
          {(cat) => (
            <button
              onClick={() => setState("category", cat.id)}
              class={`px-3 py-1.5 text-sm rounded-md transition-colors ${state.category === cat.id ? "bg-bg-muted text-text-strong" : "text-text-weak hover:text-text-strong hover:bg-bg-muted"}`}
            >
              {cat.id} ({cat.count})
            </button>
          )}
        </For>
      </div>
      <Show
        when={!loading()}
        fallback={<div class="flex justify-center py-16 text-text-weak">{language.t("store.loading")}</div>}
      >
        <Show
          when={items().length > 0}
          fallback={<div class="text-center py-16 text-text-weak">{language.t("store.noResults")}</div>}
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <For each={items()}>{(item) => <ItemCard item={item} />}</For>
          </div>
        </Show>
      </Show>
      <Show when={!isRepo()}>
        <div ref={sentinel} class="py-8 flex justify-center">
          <Show when={state.loading && state.items.length > 0}>
            <span class="text-text-weak text-sm">{language.t("store.loadingMore")}</span>
          </Show>
          <Show when={!state.hasMore && state.items.length > 0 && !state.loading}>
            <p class="text-sm text-text-weak">
              {language.t("store.showingAll", {
                count: items().length,
                type: language.t("store.sidebar.nav.skills").toLowerCase(),
              })}
            </p>
          </Show>
        </div>
      </Show>
    </div>
  )
}
