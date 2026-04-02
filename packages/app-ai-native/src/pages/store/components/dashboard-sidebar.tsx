import { A, useLocation } from "@solidjs/router"
import { For } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"

const DASHBOARD_NAV = [
  {
    href: "/store/dashboard/repositories",
    label: "store.dashboard.nav.repositories",
    icon: "folder" as const,
    color: "rgb(59,130,246)",
  },
  {
    href: "/store/dashboard/capabilities",
    label: "store.dashboard.nav.capabilities",
    icon: "sparkles" as const,
    color: "rgb(234,179,8)",
  },
  {
    href: "/store/dashboard/devices",
    label: "store.dashboard.nav.devices",
    icon: "server" as const,
    color: "rgb(34,197,94)",
  },
  {
    href: "/store/dashboard/notifications",
    label: "store.dashboard.nav.notifications",
    icon: "bubble-5" as const,
    color: "rgb(168,85,247)",
  },
]

function NavItem(props: { href: string; label: string; icon: string; color: string; active: boolean }) {
  return (
    <A
      href={props.href}
      class="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer"
      activeClass="bg-surface-base text-text-strong font-medium shadow-xs-border-base/30"
      inactiveClass="text-text-weak hover:text-text-strong hover:bg-surface-base/60"
    >
      <span
        class="flex items-center justify-center size-8 rounded-lg shrink-0"
        style={{
          "background-color": `color-mix(in srgb, ${props.color} ${props.active ? "15%" : "8%"}, transparent)`,
          color: props.active ? props.color : undefined,
        }}
        classList={{
          "text-icon-weak-base group-hover:text-icon-base": !props.active,
        }}
      >
        <Icon name={props.icon as any} size="normal" />
      </span>
      <span class="truncate">{props.label}</span>
    </A>
  )
}

export default function DashboardSidebar() {
  const location = useLocation()
  const language = useLanguage()

  const active = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/")

  return (
    <aside
      class="flex w-72 flex-col bg-surface-base shrink-0 h-full"
      style={{ "border-right": "1px solid var(--border-weak-base)" }}
    >
      <div class="shrink-0 px-3 py-3 border-b border-border-weak-base">
        <div class="flex items-center gap-2.5 px-2.5 py-2">
          <Icon name="sliders" size="normal" class="text-icon-strong-base shrink-0" />
          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-sm font-semibold text-text-strong truncate">{language.t("store.dashboard.title")}</span>
          </div>
        </div>
      </div>
      <nav class="flex flex-col flex-1 overflow-y-auto px-2 py-3 gap-1">
        <For each={DASHBOARD_NAV}>
          {(item) => (
            <NavItem
              href={item.href}
              label={language.t(item.label)}
              icon={item.icon}
              color={item.color}
              active={active(item.href)}
            />
          )}
        </For>
      </nav>
    </aside>
  )
}
