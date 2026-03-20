import { A, useLocation, useNavigate } from "@solidjs/router"
import { createSignal, createEffect, For, Show } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { repoApi, type Repository } from "../lib/api"
import { useRepoFilter } from "../context/repo-filter"
import { useAuth } from "../hooks/use-auth"
import { useLanguage } from "@/context/language"
import { navItemsForRepo, capabilityItemClass } from "./sidebar-helpers"

function NavItem(props: {
  href: string
  label: string
  icon: "sparkles" | "brain" | "console" | "mcp"
  active: boolean
}) {
  return (
    <A href={props.href} class={capabilityItemClass(props.active)}>
      <span
        class={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-150 ${
          props.active ? "h-4 bg-icon-strong-base" : "h-0 bg-transparent"
        }`}
      />
      <Icon
        name={props.icon}
        size="small"
        class={`transition-colors duration-150 ${
          props.active ? "text-icon-strong-base" : "text-icon-weak-base group-hover:text-icon-base"
        }`}
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
  const [repoMenuOpen, setRepoMenuOpen] = createSignal(false)
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

  function select(repo: Repository | null) {
    setSelectedRepo(repo)
    navigate("/store")
    setRepoMenuOpen(false)
  }

  const name = () => selectedRepo()?.displayName || selectedRepo()?.name || language.t("store.allPublic")

  const itemDetailNav = () => {
    if (!location.pathname.startsWith("/store/items/")) return undefined
    const type = new URLSearchParams(location.search).get("type")
    if (type === "skill") return "/store/skills"
    if (type === "subagent") return "/store/subagents"
    if (type === "command") return "/store/commands"
    if (type === "mcp") return "/store/mcp-servers"
    return undefined
  }

  const active = (href: string) => {
    if (location.pathname === href) return true
    if (location.pathname.startsWith(`${href}/`)) return true
    return itemDetailNav() === href
  }

  return (
    <aside class="flex w-64 flex-col border-r border-border-weak-base bg-background-base shrink-0 h-full">
      {/* Namespace: Store / 🏢 repo ▾ */}
      <div class="flex items-center h-12 px-3 border-b border-border-weak-base shrink-0">
        <div class="flex items-center gap-1.5 min-w-0 text-sm">
          <A href="/store" class="text-text-weak hover:text-text-strong transition-colors shrink-0">
            {language.t("store.sidebar.title")}
          </A>
          <span class="text-text-weak shrink-0">/</span>
          <DropdownMenu placement="bottom-start" gutter={4} open={repoMenuOpen()} onOpenChange={setRepoMenuOpen}>
            <DropdownMenu.Trigger class="group flex items-center gap-1.5 min-w-0 rounded-md border border-border-weak-base bg-surface-raised-base px-2 py-1.5 hover:border-border-strong hover:bg-surface-base transition-colors cursor-pointer">
              <Icon name="store" size="small" class="text-icon-strong-base shrink-0" />
              <span class="font-semibold text-text-strong truncate">{name()}</span>
              <Icon
                name="chevron-down"
                size="small"
                class="text-icon-weak-base shrink-0 group-hover:text-icon-base transition-colors"
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content class="min-w-[220px]">
                <DropdownMenu.Group>
                  <DropdownMenu.GroupLabel class="text-[11px] text-text-weak uppercase tracking-wider px-2 py-1">
                    {language.t("store.console.repositories.title")}
                  </DropdownMenu.GroupLabel>
                  <DropdownMenu.RadioGroup
                    value={selectedRepo()?.id ?? "__public__"}
                    onChange={(val) =>
                      select(val === "__public__" ? null : (repos().find((r) => r.id === val) ?? null))
                    }
                  >
                    <DropdownMenu.RadioItem
                      value="__public__"
                      classList={{ "bg-surface-info-base/15 text-text-strong": !selectedRepo() }}
                    >
                      <Icon name="sparkles" size="small" class="text-icon-weak-base" />
                      <DropdownMenu.ItemLabel>{language.t("store.allPublic")}</DropdownMenu.ItemLabel>
                      <DropdownMenu.ItemIndicator>
                        <Icon name="check-small" size="small" class="text-icon-weak" />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>

                    <Show when={repos().length > 0}>
                      <DropdownMenu.Separator />
                      <For each={repos()}>
                        {(repo) => (
                          <DropdownMenu.RadioItem
                            value={repo.id}
                            classList={{ "bg-surface-info-base/15 text-text-strong": selectedRepo()?.id === repo.id }}
                          >
                            <Icon name="store" size="small" class="text-icon-weak-base" />
                            <DropdownMenu.ItemLabel class="flex-1 truncate">
                              {repo.displayName || repo.name}
                            </DropdownMenu.ItemLabel>
                            <Show when={repo.repoType === "sync"}>
                              <span class="rounded-full bg-surface-info-base/15 px-1.5 py-px text-[10px] font-medium text-text-info-base ml-1">
                                sync
                              </span>
                            </Show>
                            <DropdownMenu.ItemIndicator>
                              <Icon name="check-small" size="small" class="text-icon-weak" />
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        )}
                      </For>
                    </Show>
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Group>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
        </div>
      </div>

      {/* Nav items */}
      <nav class="flex flex-col flex-1 overflow-y-auto px-2 py-2 gap-px">
        <For each={navItemsForRepo(selectedRepo())}>
          {(item) => (
            <NavItem href={item.href} label={language.t(item.label)} icon={item.icon} active={active(item.href)} />
          )}
        </For>
      </nav>
    </aside>
  )
}
