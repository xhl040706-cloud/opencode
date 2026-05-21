import type { IconProps } from "@opencode-ai/ui/icon"
import type { LocalIconName } from "@/components/local-icon"

type Count = "devices" | "channels"

export interface ConsoleMenuItem {
  code: string
  href: string
  labelKey: string
  icon?: IconProps["name"]
  localIcon?: LocalIconName
  badge?: Count
  exact?: boolean
}

export const ALL_CONSOLE_MENUS: readonly ConsoleMenuItem[] = [
  // { code: "console.repositories", href: "/console", labelKey: "store.dashboard.nav.repositories", localIcon: "repo" as LocalIconName, exact: true },
  { code: "console.devices", href: "/console/devices", labelKey: "store.dashboard.nav.devices", icon: "server" as IconProps["name"], badge: "devices" as Count },
  { code: "console.usage", href: "/console/usage", labelKey: "store.dashboard.nav.usage", localIcon: "chart-bar" as LocalIconName },
  // { code: "console.notifications", href: "/console/notifications", labelKey: "store.dashboard.nav.notifications", localIcon: "bell" as LocalIconName, badge: "channels" as Count },
  { code: "console.kanban", href: "/console/kanban", labelKey: "store.dashboard.nav.kanban", icon: "chart" as IconProps["name"] },
] as const
