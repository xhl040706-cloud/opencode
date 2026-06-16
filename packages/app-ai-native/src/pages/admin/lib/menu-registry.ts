import type { IconProps } from "@opencode-ai/ui/icon"

export interface AdminMenuItem {
  code: string
  href: string
  labelKey: string
  icon: IconProps["name"]
  exact?: boolean
}

// 第一刀仅大客户配置（M4）。后续模块（成员/权限/下发/运营）按此结构追加即可。
export const ALL_ADMIN_MENUS: readonly AdminMenuItem[] = [
  { code: "admin.enterprise", href: "/admin/enterprise", labelKey: "admin.nav.enterprise", icon: "store" as IconProps["name"] },
  // 预留位（后续分期）：
  // { code: "admin.members", href: "/admin/members", labelKey: "admin.nav.members", icon: "..." as IconProps["name"] },
  // { code: "admin.permissions", href: "/admin/permissions", labelKey: "admin.nav.permissions", icon: "shield" as IconProps["name"] },
  // { code: "admin.distributions", href: "/admin/distributions", labelKey: "admin.nav.distributions", icon: "..." as IconProps["name"] },
  // { code: "admin.ops", href: "/admin/ops", labelKey: "admin.nav.ops", icon: "settings" as IconProps["name"] },
] as const
