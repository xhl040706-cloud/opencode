import { A, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, For, on, untrack, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { ArrowRight, BadgeInfo, Building2, ClipboardList, FolderGit2, FolderOpen, GitCommitHorizontal, Users, Wallet } from "lucide-solid"
import { showToast } from "@opencode-ai/ui/toast"
import { cn } from "@/lib/utils"
import { DateRangePicker } from "../components/filters/date-range-picker"
import { queryDashboardSummary } from "../lib/api"
import { normalizeDateRange, parseQueryRange, rangeQuery, readQueryRange, searchQuery, sameRange } from "../lib/date-range"
import { formatDuration } from "../lib/formatters"
import type { DashboardSummary } from "../lib/types"

function fmtInt(value?: number | null) {
  if (value == null) return "-"
  return new Intl.NumberFormat("zh-CN").format(Math.round(value))
}

function fmtCost(value?: number | null) {
  if (value == null || value === 0) return null
  return {
    prefix: "¥",
    amount: value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  }
}

function fmtRatio(value?: number | null) {
  if (value == null) return "-"
  return `${value.toFixed(1)}%`
}

function saved(summary: DashboardSummary) {
  return Math.max(0, summary.total_task_ancient_minutes - summary.total_real_minutes)
}

function stat(value?: number | null) {
  if (value == null || value <= 0) return "-"
  return formatDuration(value)
}

function splitHumanDays(value?: number | null) {
  const text = stat(value)
  const match = text.match(/^(.+?)(人天)$/)
  if (!match) return null
  return { amount: match[1], unit: match[2] }
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
  value: string | { prefix: string; amount: string }
  hint: string
  tone: string
  iconShell: string
  icon: JSX.Element
  href?: string
  live?: boolean
}) {
  const body = (
    <article
      class={cn(
        "group relative min-h-[11rem] overflow-hidden rounded-[20px] border border-[color:color-mix(in_oklab,var(--native-border)_18%,white)] bg-white px-5 py-4 shadow-[0_10px_26px_-20px_rgba(31,53,120,0.22),0_2px_10px_-6px_rgba(71,85,145,0.12)] transition-transform duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-0.5 active:scale-[0.98]",
        props.live && "cursor-pointer",
      )}
      style={{ "--card-tone": props.tone, "touch-action": "manipulation" }}
    >
      <div class="flex items-start justify-between gap-4">
        <p class="m-0 text-[0.95rem] font-medium tracking-[-0.02em] text-[#2a3348]">{props.label}</p>
        <div class={cn("flex h-12 w-12 items-center justify-center rounded-full", props.iconShell)}>
          {props.icon}
        </div>
      </div>

      {typeof props.value === "string"
        ? <p class="mt-4 text-[3rem] leading-none font-medium tracking-[-0.07em] text-[var(--card-tone)] tabular-nums">{props.value}</p>
        : <p class="mt-4 flex items-baseline gap-1.5 text-[var(--card-tone)] tabular-nums">
            <span class="text-[1.55rem] leading-none font-medium tracking-[-0.03em]">{props.value.prefix}</span>
            <span class="text-[3rem] leading-none font-medium tracking-[-0.07em]">{props.value.amount}</span>
          </p>}
      <p class="mt-5 text-[0.95rem] leading-6 text-[#97a2b8]">{props.hint}</p>
    </article>
  )

  return props.href && props.live
    ? <A href={props.href} class="block">{body}</A>
    : body
}

function NavCard(props: {
  title: string
  iconShell: string
  icon: JSX.Element
  href?: string
  live?: boolean
}) {
  const body = (
    <article
      class={cn(
        "group relative flex min-h-[7.25rem] items-center justify-between gap-4 rounded-[18px] border border-[color:color-mix(in_oklab,var(--native-border)_16%,white)] bg-white px-5 py-4 shadow-[0_10px_24px_-22px_rgba(43,63,129,0.3),0_2px_12px_-8px_rgba(71,85,145,0.14)] transition-transform duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-0.5 active:scale-[0.98]",
        props.live && "cursor-pointer",
      )}
      style={{ "touch-action": "manipulation" }}
    >
      <div class="flex min-w-0 items-center gap-4">
        <div class={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", props.iconShell)}>
          {props.icon}
        </div>
        <h3 class="m-0 text-[1.18rem] font-medium tracking-[-0.03em] text-[#2a3348]">{props.title}</h3>
      </div>

      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7280a0] transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:text-[#4f648f]">
        <ArrowRight class="h-5 w-5" stroke-width={1.9} />
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

  createEffect(on(
    () => [search.startDate, search.endDate],
    () => {
      const next = readQueryRange(search.startDate, search.endDate)
      if (next && !sameRange(untrack(() => state.dateRange), next)) setState("dateRange", next)
    },
  ))

  createEffect(() => {
    const next = normalizeDateRange(state.dateRange)
    if (!next) return

    const query = rangeQuery(next)
    const mirror = searchQuery([
      ["startDate", query.startDate],
      ["endDate", query.endDate],
      ["mock", search.mock],
    ])
    const current = searchQuery([
      ["startDate", search.startDate],
      ["endDate", search.endDate],
      ["mock", search.mock],
    ])
    if (mirror.toString() !== current.toString()) setSearch(Object.fromEntries(mirror.entries()))
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

  const metrics = createMemo(() => [
    {
      label: "总仓数",
      value: fmtInt(view().total_repos),
      hint: `工作目录 ${fmtInt(view().total_work_dirs)}`,
      tone: "#2d6bff",
      iconShell: "bg-[#eef4ff] text-[#2d6bff]",
      icon: <FolderGit2 class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/repo",
      live: true,
    },
    {
      label: "总用户数",
      value: fmtInt(view().total_users),
      hint: `覆盖 ${fmtInt(view().total_tasks)} 个任务样本`,
      tone: "#18a957",
      iconShell: "bg-[#edf9f0] text-[#18a957]",
      icon: <Users class="h-5 w-5" stroke-width={1.9} />,
    },
    {
      label: "总 Task 数",
      value: fmtInt(view().total_tasks),
      hint: "总 TASK 数",
      tone: "#ff7a00",
      iconShell: "bg-[#fff3e8] text-[#ff7a00]",
      icon: <ClipboardList class="h-5 w-5" stroke-width={1.9} />,
    },
    {
      label: "总 Commit 数",
      value: fmtInt(view().total_commits),
      hint: `Diff 行数 ${fmtInt(view().total_diff_lines)}`,
      tone: "#8a4cf6",
      iconShell: "bg-[#f5eefe] text-[#8a4cf6]",
      icon: <GitCommitHorizontal class="h-5 w-5" stroke-width={1.9} />,
    },
    {
      label: "总费用",
      value: fmtCost(view().total_cost) ?? "-",
      hint: `Tokens ${fmtInt(view().total_tokens)}`,
      tone: "#2d6bff",
      iconShell: "bg-[#eef4ff] text-[#2d6bff]",
      icon: <Wallet class="h-5 w-5" stroke-width={1.9} />,
    },
  ])

  const nav = createMemo(() => [
    {
      title: "仓库视图",
      iconShell: "bg-[#eef4ff] text-[#2d6bff]",
      icon: <FolderGit2 class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/repo",
      live: true,
    },
    {
      title: "用户视图",
      iconShell: "bg-[#edf9f0] text-[#18a957]",
      icon: <Users class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/user",
      live: true,
    },
    {
      title: "组织视图",
      iconShell: "bg-[#f3ecff] text-[#b188ef]",
      icon: <Building2 class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/org",
      live: true,
    },
    {
      title: "提交视图",
      iconShell: "bg-[#fff3e8] text-[#ff8a24]",
      icon: <GitCommitHorizontal class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/commit",
      live: true,
    },
    {
      title: "任务视图",
      iconShell: "bg-[#fff8df] text-[#f0b93f]",
      icon: <ClipboardList class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/task",
      live: true,
    },
    {
      title: "项目视图",
      iconShell: "bg-[#eef4ff] text-[#5c88ff]",
      icon: <FolderOpen class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/project",
      live: true,
    },
  ])

  const summaryStat = createMemo(() => [
    {
      label: "节省时间",
      value: splitHumanDays(saved(view())) ?? stat(saved(view())),
      tone: "text-[#1f2937]",
      unitTone: "text-[#6f7d96]",
    },
    {
      label: "传统预估",
      value: splitHumanDays(view().total_task_ancient_minutes) ?? stat(view().total_task_ancient_minutes),
      tone: "text-[#1f2937]",
      unitTone: "text-[#6f7d96]",
    },
    {
      label: "实际耗时",
      value: stat(view().total_real_minutes),
      tone: "text-[#1f2937]",
      unitTone: "text-[#6f7d96]",
    },
  ])

  return (
    <div class="min-h-full overflow-x-clip bg-[#fafbfe] px-[clamp(1rem,3vw,4.5rem)] py-[clamp(1rem,2vw,2rem)]">
      <div class="mx-auto flex w-full flex-col gap-6">
        <header class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 flex-1 pt-2">
            <h1 class="whitespace-nowrap font-[var(--native-font-display)] text-[clamp(2rem,4vw,2.7rem)] leading-[1.18] font-medium tracking-[-0.05em] text-[#182235]">
                AI Coding 指标看板
            </h1>
          </div>

          <div class="w-full max-w-[21rem] lg:flex-none">
            <div class="rounded-[18px] border border-[color:color-mix(in_oklab,var(--native-border)_20%,white)] bg-white p-1.5 shadow-[0_10px_24px_-22px_rgba(43,63,129,0.28),0_2px_12px_-8px_rgba(71,85,145,0.12)]">
              <DateRangePicker
                value={state.dateRange}
                onChange={(value) => {
                  if (!value) return
                  setState("dateRange", value)
                }}
                clearable={false}
                size="sm"
                fullWidth={true}
              />
            </div>
          </div>
        </header>

        <section class="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(25rem,0.88fr)]">
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <For each={metrics()}>{(item) => <MetricCard {...item} />}</For>
          </div>

          <section class="overflow-hidden rounded-[22px] border border-[color:color-mix(in_oklab,var(--native-primary)_14%,white)] bg-[linear-gradient(115deg,#f7faff_42%,#e8f0ff_100%)] px-6 py-6 shadow-[0_18px_38px_-30px_rgba(50,92,191,0.42),0_10px_24px_-18px_rgba(89,118,195,0.22)]">
            <div class="flex h-full flex-col justify-between gap-8">
              <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div class="max-w-[16rem]">
                  <div class="flex items-center gap-2 text-[#2a3348]">
                    <p class="m-0 text-[0.95rem] font-medium tracking-[-0.02em]">综合提效比</p>
                    <span class="flex h-5 w-5 items-center justify-center rounded-full border border-[#d9e6ff] text-[#8c9bb7]">
                      <BadgeInfo class="h-3.5 w-3.5" stroke-width={2} />
                    </span>
                  </div>
                  <p class="mt-10 text-[clamp(2.4rem,5vw,4rem)] leading-none font-medium tracking-[-0.08em] text-[#2d6bff] tabular-nums">{fmtRatio(view().avg_efficiency_ratio)}</p>
                </div>

                <div class="relative mx-auto flex min-h-[12rem] w-full max-w-[20rem] items-center justify-center overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_50%_65%,rgba(91,132,255,0.12),transparent_54%),radial-gradient(circle_at_68%_22%,rgba(137,172,255,0.14),transparent_28%),transparent]">
                  <div class="absolute inset-x-[18%] bottom-[20%] h-10 rounded-full bg-[radial-gradient(circle,rgba(115,150,255,0.12),rgba(115,150,255,0.04)_55%,transparent_72%)]" />
                  <div class="absolute left-[10%] top-[12%] h-32 w-44 rounded-full border border-[#dbe7ff]" />
                  <div class="absolute right-[6%] top-[28%] h-28 w-28 rounded-full border border-[#dbe7ff]" />
                  <div class="absolute left-[22%] top-[24%] h-2.5 w-2.5 rounded-full bg-[#d7e5ff]" />
                  <div class="absolute right-[3%] top-[58%] h-3.5 w-3.5 rounded-full bg-[#85a8ff]" />
                  <div class="absolute left-[22%] top-[39%] h-1.5 w-[5.2rem] rotate-[-46deg] rounded-full bg-[#5b85ff]" />
                  <div class="absolute left-[42%] top-[28%] h-1.5 w-[3.1rem] rotate-[36deg] rounded-full bg-[#5b85ff]" />
                  <div class="absolute left-[55%] top-[20%] h-1.5 w-[3.8rem] rotate-[-54deg] rounded-full bg-[#5b85ff]" />
                  <div class="absolute left-[68%] top-[11%] h-1.5 w-[2.4rem] rotate-[97deg] rounded-full bg-[#5b85ff]" />
                  <div class="absolute left-[60%] top-[11%] h-4 w-4 rotate-[14deg] border-r-[4px] border-t-[4px] border-[#5b85ff]" />
                  <div class="absolute bottom-[24%] left-[37%] flex items-end gap-3">
                    <div class="h-7 w-4 rounded-[4px] bg-[linear-gradient(180deg,#95b4ff,#6f95ff)] shadow-[0_8px_18px_-14px_rgba(61,107,255,0.7)]" />
                    <div class="h-10 w-4 rounded-[4px] bg-[linear-gradient(180deg,#95b4ff,#6f95ff)] shadow-[0_8px_18px_-14px_rgba(61,107,255,0.7)]" />
                    <div class="h-14 w-4 rounded-[4px] bg-[linear-gradient(180deg,#95b4ff,#6f95ff)] shadow-[0_8px_18px_-14px_rgba(61,107,255,0.7)]" />
                  </div>
                </div>
              </div>

              <div class="grid gap-4 border-t border-[#d9e4fb] pt-5 md:grid-cols-3 md:divide-x md:divide-[#d9e4fb] md:gap-0">
                <For each={summaryStat()}>
                  {(item) => (
                    <div class="space-y-2 md:px-5 first:md:pl-0 last:md:pr-0">
                      <p class="text-[0.95rem] text-[#33405b]">{item.label}</p>
                      {typeof item.value === "string"
                        ? <p class={`text-[2.2rem] leading-none font-medium tracking-[-0.06em] tabular-nums ${item.tone}`}>{item.value}</p>
                        : <p class={`flex items-baseline gap-1.5 text-[2.2rem] leading-none font-medium tracking-[-0.06em] tabular-nums ${item.tone}`}>
                            <span>{item.value.amount}</span>
                            <span class={`text-[1.15rem] font-normal tracking-[-0.02em] ${item.unitTone}`}>{item.value.unit}</span>
                          </p>}
                    </div>
                  )}
                </For>
              </div>
            </div>
          </section>
        </section>

        <section class="grid gap-4">
          <div>
            <h2 class="text-[1.55rem] font-medium tracking-[-0.04em] text-[#182235]">功能入口</h2>
          </div>

          <div class="w-full max-w-[72rem]">
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <For each={nav()}>{(item) => <NavCard {...item} />}</For>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}