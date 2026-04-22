import { A, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, For } from "solid-js"
import { createStore } from "solid-js/store"
import { showToast } from "@opencode-ai/ui/toast"
import { cn } from "@/lib/utils"
import { DateRangePicker } from "../components/filters/date-range-picker"
import { queryDashboardSummary } from "../lib/api"
import { defaultWideRange, normalizeDateRange } from "../lib/date-range"
import { formatDuration } from "../lib/formatters"
import type { DashboardSummary, DateRangeValue } from "../lib/types"

function parseQueryRange(startDate?: string, endDate?: string) {
  if (startDate && endDate && /^\d{8}$/.test(startDate) && /^\d{8}$/.test(endDate)) {
    return [
      `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`,
      `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`,
    ] as [string, string]
  }
  return defaultWideRange()
}

function rangeQuery(value: [string, string]) {
  return {
    startDate: value[0].replace(/-/g, ""),
    endDate: value[1].replace(/-/g, ""),
  }
}

function sameRange(a: DateRangeValue, b: DateRangeValue) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a[0] === b[0] && a[1] === b[1]
}

function fmtInt(value?: number | null) {
  if (value == null) return "-"
  return new Intl.NumberFormat("zh-CN").format(Math.round(value))
}

function fmtCost(value?: number | null) {
  if (value == null || value === 0) return "-"
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtRatio(value?: number | null) {
  if (value == null) return "-"
  return `${value.toFixed(1)}%`
}

function saved(summary: DashboardSummary) {
  return Math.max(0, summary.total_task_ancient_minutes - summary.total_real_minutes)
}

function band(value?: number | null) {
  if (value == null || value === 0) {
    return {
      shell: "from-[color:color-mix(in_oklab,var(--native-dim)_48%,#2b3342)] via-[color:color-mix(in_oklab,var(--native-border)_36%,#1f2632)] to-[color:color-mix(in_oklab,var(--native-panel)_76%,#141a24)]",
      pill: "bg-white/10 text-white/82 border-white/12",
      tone: "text-white",
    }
  }
  if (value >= 300) {
    return {
      shell: "from-[color:color-mix(in_oklab,var(--native-success)_74%,#0d3f32)] via-[color:color-mix(in_oklab,var(--native-primary)_54%,#1457a8)] to-[color:color-mix(in_oklab,var(--native-info,var(--native-primary))_68%,#0c2e54)]",
      pill: "bg-white/12 text-white border-white/14",
      tone: "text-white",
    }
  }
  if (value >= 150) {
    return {
      shell: "from-[color:color-mix(in_oklab,var(--native-primary)_78%,#123e78)] via-[color:color-mix(in_oklab,var(--native-warning)_32%,#435d88)] to-[color:color-mix(in_oklab,var(--native-panel)_28%,#1f2840)]",
      pill: "bg-white/12 text-white border-white/14",
      tone: "text-white",
    }
  }
  return {
    shell: "from-[color:color-mix(in_oklab,var(--native-warning)_82%,#8a4f13)] via-[color:color-mix(in_oklab,var(--native-warning)_56%,#b26d22)] to-[color:color-mix(in_oklab,var(--native-critical,#8d3a2e)_46%,#7a3129)]",
    pill: "bg-white/14 text-white border-white/16",
    tone: "text-white",
  }
}

function blank(): DashboardSummary {
  return {
    total_tasks: 0,
    total_users: 0,
    total_repos: 0,
    total_commits: 0,
    total_work_dirs: 0,
    total_cost: 0,
    total_tokens: 0,
    total_diff_lines: 0,
    total_task_ancient_minutes: 0,
    total_real_minutes: 0,
    avg_efficiency_ratio: null,
  }
}

function MetricCard(props: {
  label: string
  value: string
  hint: string
  tone: string
  href?: string
  live?: boolean
}) {
  const body = (
    <article
      class={cn(
        "group relative overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_22%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_90%,var(--native-bg-subtle))] p-3 shadow-[var(--native-shadow-sm)] transition-all duration-200",
        props.live && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--native-shadow-md)] active:scale-[0.99]",
      )}
      style={{ "--card-tone": props.tone }}
    >
      <div class="absolute right-0 top-0 h-20 w-20 translate-x-5 -translate-y-5 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--card-tone)_14%,transparent),transparent_70%)]" />
      <div class="relative">
        <div>
          <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:color-mix(in_oklab,var(--card-tone)_72%,var(--native-dim))]">{props.label}</p>
          <p class="mt-2 text-[1.45rem] leading-none font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">{props.value}</p>
        </div>
      </div>
      <p class="relative mt-3 text-[0.78rem] leading-5 text-[var(--native-muted)]">{props.hint}</p>
    </article>
  )

  return props.href && props.live
    ? <A href={props.href} class="block">{body}</A>
    : body
}

function NavCard(props: {
  title: string
  tone: string
  href?: string
  live?: boolean
}) {
  const body = (
    <article
      class={cn(
        "group relative flex min-h-[4.75rem] flex-col justify-between rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_18%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_94%,var(--native-bg-subtle))] px-3 py-2.5 shadow-[var(--native-shadow-xs)] transition-all duration-200",
        props.live && "cursor-pointer hover:-translate-y-0.5 hover:border-[color:color-mix(in_oklab,var(--nav-tone)_14%,var(--native-border))] hover:shadow-[var(--native-shadow-sm)] active:scale-[0.99]",
      )}
      style={{ "--nav-tone": props.tone }}
    >
      <div class="relative grid gap-1">
        <h3 class="m-0 text-[0.84rem] font-semibold tracking-[-0.03em] text-[var(--native-foreground)]">{props.title}</h3>
      </div>

    </article>
  )

  return props.href && props.live
    ? <A href={props.href} class="block">{body}</A>
    : body
}

export default function KanbanHome() {
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string; mock?: string }>()
  const [state, setState] = createStore({
    dateRange: parseQueryRange(search.startDate, search.endDate),
  })

  createEffect(() => {
    const next = normalizeDateRange(state.dateRange)
    if (!next) return

    const current = parseQueryRange(search.startDate, search.endDate)
    if (sameRange(next, current)) return

    const query = rangeQuery(next)
    const mock = search.mock?.trim()
    setSearch(mock ? { ...query, mock } : query)
  })

  const [summary] = createResource(
    () => ({
      start: state.dateRange[0],
      end: state.dateRange[1],
    }),
    async (input) => {
      try {
        const data = await queryDashboardSummary({
          dateRange: [input.start, input.end],
        })
        return data
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        showToast({
          variant: "error",
          title: "首页概览加载失败",
          description: msg,
        })
        return blank()
      }
    },
  )

  const view = createMemo(() => summary() ?? blank())
  const skin = createMemo(() => band(view().avg_efficiency_ratio))

  const metrics = createMemo(() => [
    {
      label: "总仓库数",
      value: fmtInt(view().total_repos),
      hint: `工作目录 ${fmtInt(view().total_work_dirs)}`,
      tone: "var(--native-primary)",
      href: "/kanban/repo",
      live: true,
    },
    {
      label: "总用户数",
      value: fmtInt(view().total_users),
      hint: `覆盖 ${fmtInt(view().total_tasks)} 个任务样本`,
      tone: "var(--native-success)",
    },
    {
      label: "总 Task 数",
      value: fmtInt(view().total_tasks),
      hint: `传统预估 ${formatDuration(view().total_task_ancient_minutes)}`,
      tone: "var(--native-warning)",
    },
    {
      label: "总 Commit 数",
      value: fmtInt(view().total_commits),
      hint: `Diff 行数 ${fmtInt(view().total_diff_lines)}`,
      tone: "var(--native-critical, #b24b3b)",
    },
    {
      label: "总费用",
      value: fmtCost(view().total_cost),
      hint: `Tokens ${fmtInt(view().total_tokens)}`,
      tone: "var(--native-info, #4c84d8)",
    },
  ])

  const nav = createMemo(() => [
    {
      title: "仓库视图",
      tone: "var(--native-primary)",
      href: "/kanban/repo",
      live: true,
    },
    {
      title: "用户视图",
      tone: "var(--native-success)",
      href: "/kanban/user",
      live: true,
    },
    {
      title: "组织视图",
      tone: "var(--native-warning)",
      href: "/kanban/org",
      live: true,
    },
    {
      title: "提交视图",
      tone: "var(--native-critical, #b24b3b)",
      href: "/kanban/commit",
      live: true,
    },
    {
      title: "任务视图",
      tone: "var(--native-info, #4c84d8)",
      href: "/kanban/task",
      live: true,
    },
    {
      title: "项目视图",
      tone: "var(--native-dim)",
    },
  ])

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-3 overflow-x-clip p-[clamp(0.75rem,1.4vw,1.25rem)]">
      <div class="mx-auto flex w-full max-w-[1180px] flex-col gap-3">
        <header class="flex flex-wrap items-start justify-between gap-2.5">
            <div class="min-w-0 flex-1 basis-[18rem] pt-1">
              <h1 class="max-w-[13ch] font-[var(--native-font-display)] text-[clamp(2.2rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-[-0.06em] text-[var(--native-foreground)]">
                AI Coding 指标看板
              </h1>
            </div>

            <div class="ml-auto grid w-full max-w-[20rem] flex-none gap-2">
              <DateRangePicker
                value={state.dateRange}
                onChange={(value) => {
                  if (!value) return
                  setState("dateRange", value)
                }}
                clearable={false}
                size="sm"
                fullWidth={false}
              />

              <div class="grid gap-2 rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_18%,transparent)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--native-panel)_90%,var(--native-primary-soft)),color-mix(in_oklab,var(--native-surface)_88%,var(--native-bg-subtle)))] p-3 shadow-[var(--native-shadow-sm)]">
                <div class="flex items-start gap-3">
                  <div>
                    <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--native-dim)]">综合提效比</p>
                    <div class="mt-2">
                      <p class="text-[2.5rem] leading-none font-semibold tracking-[-0.08em] text-[var(--native-foreground)]">
                        {fmtRatio(view().avg_efficiency_ratio)}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="grid gap-1.5 border-t border-[color:color-mix(in_oklab,var(--native-border)_16%,transparent)] pt-2.5 text-[var(--native-muted)]">
                  <div class="flex items-center justify-between gap-4 text-[0.82rem]">
                    <span class="text-[11px] leading-none">节省时间</span>
                    <span class="font-medium text-[var(--native-foreground)]">{formatDuration(saved(view()))}</span>
                  </div>
                  <div class="flex items-center justify-between gap-4 text-[0.82rem]">
                    <span class="text-[11px] leading-none">传统预估</span>
                    <span class="font-medium text-[var(--native-foreground)]">{formatDuration(view().total_task_ancient_minutes)}</span>
                  </div>
                  <div class="flex items-center justify-between gap-4 text-[0.82rem]">
                    <span class="text-[11px] leading-none">实际耗时</span>
                    <span class="font-medium text-[var(--native-foreground)]">{formatDuration(view().total_real_minutes)}</span>
                  </div>
                </div>
              </div>
            </div>
        </header>

        <section class="grid gap-2 md:grid-cols-5">
          <For each={metrics()}>{(item) => <MetricCard {...item} />}</For>
        </section>

        <section class="grid gap-2">
          <div>
            <h2 class="text-[1rem] font-semibold tracking-[-0.04em] text-[var(--native-foreground)]">功能入口</h2>
          </div>

          <div class="grid gap-2 md:grid-cols-6">
            <For each={nav()}>{(item) => <NavCard {...item} />}</For>
          </div>
        </section>
      </div>
    </div>
  )
}