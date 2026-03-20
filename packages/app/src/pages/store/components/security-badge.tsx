import { Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SecurityStatus } from "../lib/api"

interface SecurityBadgeConfig {
  label: string
  labelKey: string
  bgClass: string
  textClass: string
  icon?: string
  animate?: boolean
}

const STATUS_CONFIG: Record<SecurityStatus, SecurityBadgeConfig> = {
  unscanned: {
    label: "待扫描",
    labelKey: "store.security.unscanned",
    bgClass: "bg-gray-100 dark:bg-gray-800",
    textClass: "text-gray-500 dark:text-gray-400",
  },
  pending: {
    label: "扫描中...",
    labelKey: "store.security.pending",
    bgClass: "bg-gray-100 dark:bg-gray-800",
    textClass: "text-gray-500 dark:text-gray-400",
    animate: true,
  },
  scanning: {
    label: "扫描中...",
    labelKey: "store.security.scanning",
    bgClass: "bg-gray-100 dark:bg-gray-800",
    textClass: "text-gray-500 dark:text-gray-400",
    animate: true,
  },
  clean: {
    label: "安全",
    labelKey: "store.security.clean",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-600 dark:text-green-400",
    icon: "🟢",
  },
  low: {
    label: "安全",
    labelKey: "store.security.low",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-600 dark:text-green-400",
    icon: "🟢",
  },
  medium: {
    label: "注意",
    labelKey: "store.security.medium",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-600 dark:text-yellow-400",
    icon: "🟡",
  },
  high: {
    label: "高风险",
    labelKey: "store.security.high",
    bgClass: "bg-orange-100 dark:bg-orange-900/30",
    textClass: "text-orange-600 dark:text-orange-400",
    icon: "🔴",
  },
  extreme: {
    label: "极高风险",
    labelKey: "store.security.extreme",
    bgClass: "bg-red-100 dark:bg-red-900/30",
    textClass: "text-red-600 dark:text-red-400",
    icon: "⛔",
  },
  error: {
    label: "扫描失败",
    labelKey: "store.security.error",
    bgClass: "bg-gray-100 dark:bg-gray-800",
    textClass: "text-gray-500 dark:text-gray-400",
  },
  skipped: {
    label: "已跳过",
    labelKey: "store.security.skipped",
    bgClass: "bg-gray-100 dark:bg-gray-800",
    textClass: "text-gray-500 dark:text-gray-400",
  },
}

export interface SecurityBadgeProps {
  status?: SecurityStatus
  size?: "sm" | "md"
  showIcon?: boolean
}

export default function SecurityBadge(props: SecurityBadgeProps) {
  const language = useLanguage()
  const config = () => STATUS_CONFIG[props.status ?? "unscanned"]
  const size = () => props.size ?? "sm"

  return (
    <Show when={props.status}>
      <span
        class={`inline-flex items-center gap-1 rounded font-medium ${
          size() === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        } ${config().bgClass} ${config().textClass} ${
          config().animate ? "animate-pulse" : ""
        }`}
        title={language.t(config().labelKey)}
      >
        <Show when={props.showIcon !== false && config().icon}>
          <span>{config().icon}</span>
        </Show>
        <span>{language.t(config().labelKey)}</span>
      </span>
    </Show>
  )
}

// Verdict badge for scan results
export type Verdict = "safe" | "caution" | "reject"

interface VerdictConfig {
  label: string
  labelKey: string
  bgClass: string
  textClass: string
  icon: string
}

const VERDICT_CONFIG: Record<Verdict, VerdictConfig> = {
  safe: {
    label: "可安装",
    labelKey: "store.verdict.safe",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-600 dark:text-green-400",
    icon: "✅",
  },
  caution: {
    label: "需确认",
    labelKey: "store.verdict.caution",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-600 dark:text-yellow-400",
    icon: "⚠️",
  },
  reject: {
    label: "不建议安装",
    labelKey: "store.verdict.reject",
    bgClass: "bg-red-100 dark:bg-red-900/30",
    textClass: "text-red-600 dark:text-red-400",
    icon: "❌",
  },
}

export interface VerdictBadgeProps {
  verdict?: Verdict
  size?: "sm" | "md"
}

export function VerdictBadge(props: VerdictBadgeProps) {
  const language = useLanguage()
  const config = () => VERDICT_CONFIG[props.verdict ?? "safe"]
  const size = () => props.size ?? "sm"

  return (
    <Show when={props.verdict}>
      <span
        class={`inline-flex items-center gap-1 rounded font-medium ${
          size() === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        } ${config().bgClass} ${config().textClass}`}
      >
        <span>{config().icon}</span>
        <span>{language.t(config().labelKey)}</span>
      </span>
    </Show>
  )
}
