import { createResource, Suspense, For } from "solid-js"
import { A } from "@solidjs/router"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { itemApi } from "../lib/api"
import ItemCard from "../components/item-card"

export default function Home() {
  const language = useLanguage()
  const [skills] = createResource(() => itemApi.list({ type: "skill", limit: 8 }))
  const [subagents] = createResource(() => itemApi.list({ type: "subagent", limit: 8 }))
  const [commands] = createResource(() => itemApi.list({ type: "command", limit: 8 }))
  const [mcps] = createResource(() => itemApi.list({ type: "mcp", limit: 8 }))

  const categories = [
    {
      href: "/store/skills",
      label: "store.sidebar.nav.skills" as const,
      icon: "sparkles" as const,
      color: "text-yellow-500",
      data: skills,
    },
    {
      href: "/store/subagents",
      label: "store.sidebar.nav.subagents" as const,
      icon: "models" as const,
      color: "text-blue-500",
      data: subagents,
    },
    {
      href: "/store/commands",
      label: "store.sidebar.nav.commands" as const,
      icon: "console" as const,
      color: "text-green-500",
      data: commands,
    },
    {
      href: "/store/mcp-servers",
      label: "store.sidebar.nav.mcpServers" as const,
      icon: "server" as const,
      color: "text-purple-500",
      data: mcps,
    },
  ]

  return (
    <div class="min-h-full">
      {/* Hero */}
      <section class="py-20 px-8">
        <div class="max-w-xl">
          <h1 class="text-3xl font-semibold text-text-strong mb-4">{language.t("store.home.hero.title")}</h1>
          <p class="text-text-weak mb-8">{language.t("store.home.hero.description")}</p>
          <A
            href="/store/skills"
            class="inline-flex items-center gap-2 px-4 py-2 bg-bg-muted text-text-strong rounded-md text-sm hover:bg-bg-muted/80 transition-colors"
          >
            {language.t("store.home.hero.browseSkills")}
          </A>
        </div>
      </section>

      {/* Browse by type */}
      <section class="py-12 px-8 border-t border-border-weak-base">
        <p class="text-xs text-text-weak mb-6 uppercase tracking-wider">{language.t("store.home.browseByType")}</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
          <For each={categories}>
            {(cat) => (
              <A
                href={cat.href}
                class="p-4 rounded-lg border border-border-weak-base text-center group cursor-pointer hover:border-border-weak-base hover:shadow-xs-border-base hover:-translate-y-px active:translate-y-0 transition-all duration-150"
              >
                <div class={`text-2xl mb-2 ${cat.color}`}>
                  <Icon name={cat.icon} />
                </div>
                <div class="text-lg font-semibold text-text-strong mb-1">{cat.data()?.total ?? "—"}</div>
                <div class="text-xs text-text-weak group-hover:text-text-strong transition-colors">
                  {language.t(cat.label)}
                </div>
              </A>
            )}
          </For>
        </div>
      </section>

      {/* Featured sections */}
      <For each={categories}>
        {(cat) => (
          <section class="py-12 px-8 border-t border-border-weak-base">
            <div class="flex items-center justify-between mb-6">
              <h2 class={`text-lg font-semibold flex items-center gap-2 ${cat.color}`}>
                <Icon name={cat.icon} /> {language.t(cat.label)}
              </h2>
              <A href={cat.href} class="text-xs text-text-weak hover:text-text-strong transition-colors">
                {language.t("store.home.viewAll")}
              </A>
            </div>
            <Suspense fallback={<div class="text-text-weak text-sm">{language.t("store.loading")}</div>}>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <For each={cat.data()?.items ?? []}>{(item) => <ItemCard item={item} />}</For>
              </div>
            </Suspense>
          </section>
        )}
      </For>
    </div>
  )
}
