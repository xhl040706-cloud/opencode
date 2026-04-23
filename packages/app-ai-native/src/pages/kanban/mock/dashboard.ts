import type { DashboardSummary, DashboardSummaryQuery } from "../lib/types"

const key = "kanban:home:mock"

function days(range?: DashboardSummaryQuery["dateRange"]) {
  if (!range) return 90
  const start = new Date(range[0])
  const end = new Date(range[1])
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 90
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1)
}

export function dashboardMock() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false
  const query = new URLSearchParams(window.location.search)
  const flag = query.get("mock")?.trim()
  if (flag === "1" || flag === "home" || flag === "kanban") return true
  return typeof localStorage !== "undefined" && localStorage.getItem(key) === "1"
}

export function queryDashboardSummaryMock(input: DashboardSummaryQuery = {}): DashboardSummary {
  const span = days(input.dateRange)
  const scale = Math.max(0.55, span / 90)
  const reach = Math.min(1.35, scale + 0.12)
  const ratio = Math.max(132, 286 + (scale - 1) * 34)
  const real = Math.round(23840 * scale)
  const ancient = Math.round(real * (ratio / 100))

  return {
    total_tasks: Math.round(1720 * scale),
    total_users: Math.round(96 * reach),
    total_repos: Math.round(58 * reach),
    total_commits: Math.round(3140 * scale),
    total_work_dirs: Math.round(64 * reach),
    total_cost: Number((5628.4 * scale).toFixed(2)),
    total_tokens: Math.round(21400000 * scale),
    total_diff_lines: Math.round(512000 * scale),
    total_task_ancient_minutes: ancient,
    total_real_minutes: real,
    avg_efficiency_ratio: Number(ratio.toFixed(1)),
  }
}