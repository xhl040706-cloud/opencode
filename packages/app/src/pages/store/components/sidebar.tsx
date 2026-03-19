import { A, useLocation, useNavigate } from "@solidjs/router"
import { createSignal, createEffect, For, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
// import { Tooltip } from "@opencode-ai/ui/tooltip"
import { repoApi, type Repository } from "../lib/api"
import { useRepoFilter } from "../context/repo-filter"
import { useAuth } from "../hooks/use-auth"
import { useLanguage } from "@/context/language"
import { NAV_ITEMS, navItemsForRepo, repoItemClass, capabilityItemClass } from "./sidebar-helpers"

function IconBuilding2(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
    </svg>
  )
}

function IconGlobe(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}

function NavItem(props: {
  href: string
  label: string
  icon: "sparkles" | "models" | "console" | "server"
  active: boolean
}) {
  return (
    <A href={props.href} class={capabilityItemClass(props.active)}>
      <Icon
        name={props.icon}
        size="small"
        class={props.active ? "text-icon-strong-base" : "text-icon-base group-hover:text-icon-strong-base"}
      />
      <span class="truncate">{props.label}</span>
    </A>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedRepo, setSelectedRepo } = useRepoFilter()
  const { user } = useAuth()
  const [repos, setRepos] = createSignal<Repository[]>([])
  const [reposExpanded, setReposExpanded] = createSignal(true)
  const language = useLanguage()

  createEffect(() => {
    const u = user()
    if (u?.sub) {
      repoApi
        .listMy(u.sub)
        .then((res) => setRepos(res.repositories ?? []))
        .catch(() => {})
    } else {
      setRepos([])
    }
  })

  function selectRepo(repo: Repository | null) {
    setSelectedRepo(repo)
    const ordered = navItemsForRepo(repo)
    const current = ordered.find((item) => location.pathname.startsWith(item.href))
    navigate(current ? current.href : ordered[0]?.href || "/store/skills")
  }

  const itemDetailNav = () => {
    if (!location.pathname.startsWith("/store/items/")) return undefined
    const type = new URLSearchParams(location.search).get("type")
    if (type === "skill") return "/store/skills"
    if (type === "subagent") return "/store/subagents"
    if (type === "command") return "/store/commands"
    if (type === "mcp") return "/store/mcp-servers"
    return undefined
  }

  const activeCapabilityNav = (href: string) => {
    if (location.pathname === href) return true
    if (location.pathname.startsWith(`${href}/`)) return true
    return itemDetailNav() === href
  }

  return (
    <aside class="flex w-64 flex-col border-r border-border-weak-base bg-background-base shrink-0 h-full">
      <div class="flex h-12 items-center px-4 gap-2 border-b border-border-weak-base shrink-0">
        <button
          onClick={() => navigate("/")}
          class="p-1 text-text-weak hover:text-text-strong hover:bg-surface-base rounded-md transition-colors"
        >
          <Icon name="arrow-left" size="small" />
        </button>
        <span class="font-semibold text-text-strong text-sm">{language.t("store.sidebar.title")}</span>
      </div>

      <div class="flex flex-col flex-1 overflow-y-auto py-2.5 gap-2.5 px-2">
        <section class="rounded-xl border border-border-weak-base bg-surface-raised-base p-1.5">
          <button
            onClick={() => setReposExpanded((v) => !v)}
            class="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-text-weak uppercase tracking-wider hover:text-text-strong transition-colors"
          >
            <span class="flex items-center gap-2">
              <Icon name="folder" size="small" />
              {language.t("store.console.repositories.title")}
            </span>
            <span class="flex items-center gap-2">
              <span class="rounded-full border border-border-weak-base bg-surface-base px-1.5 py-0.5 text-[10px] normal-case text-text-weak">
                {repos().length + 1}
              </span>
              <Show when={reposExpanded()} fallback={<Icon name="chevron-right" size="small" />}>
                <Icon name="chevron-down" size="small" />
              </Show>
            </span>
          </button>

          <Show when={reposExpanded()}>
            <div class="mt-1 space-y-0.5">
              <div>
                <button onClick={() => selectRepo(null)} class={`${repoItemClass(!selectedRepo())} text-left`}>
                  <IconGlobe
                    class={`h-4 w-4 shrink-0 ${!selectedRepo() ? "text-icon-strong-base" : "text-icon-base group-hover:text-icon-strong-base"}`}
                  />
                  <span class="truncate">{language.t("store.allPublic")}</span>
                </button>

                <Show when={!selectedRepo()}>
                  <div class="ml-3.5 mt-0.5 border-l border-border-weak-base pl-1.5 space-y-0.5">
                    <For each={navItemsForRepo(null)}>
                      {(item) => (
                        <NavItem
                          href={item.href}
                          label={language.t(item.label)}
                          icon={item.icon}
                          active={activeCapabilityNav(item.href)}
                        />
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <Show when={user()}>
                <For each={repos()}>
                  {(repo) => (
                    <div>
                      <button
                        onClick={() => selectRepo(repo)}
                        class={`${repoItemClass(selectedRepo()?.id === repo.id)} text-left`}
                      >
                        <IconBuilding2
                          class={`h-4 w-4 shrink-0 ${selectedRepo()?.id === repo.id ? "text-icon-strong-base" : "text-icon-base group-hover:text-icon-strong-base"}`}
                        />
                        <span class="truncate flex-1">{repo.displayName || repo.name}</span>
                        <Show when={repo.repoType === "sync"}>
                          <span class="rounded-full bg-surface-info-base/20 px-1.5 py-0.5 text-[10px] text-text-info-base">
                            {language.t("store.console.repositories.sync")}
                          </span>
                        </Show>
                      </button>

                      <Show when={selectedRepo()?.id === repo.id}>
                        <div class="ml-3.5 mt-0.5 border-l border-border-weak-base pl-1.5 space-y-0.5">
                          <For each={navItemsForRepo(repo)}>
                            {(item) => (
                              <NavItem
                                href={item.href}
                                label={language.t(item.label)}
                                icon={item.icon}
                                active={activeCapabilityNav(item.href)}
                              />
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>

                <Show when={repos().length === 0}>
                  <p class="px-3 py-2 text-xs text-text-weak rounded-md border border-dashed border-border-weak-base">
                    {language.t("store.sidebar.noRepositories")}
                  </p>
                </Show>
              </Show>
            </div>
          </Show>
        </section>
      </div>
    </aside>
  )
}
