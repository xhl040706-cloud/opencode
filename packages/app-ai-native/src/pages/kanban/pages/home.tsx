import { A, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, For, on, untrack, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { createStore } from "solid-js/store"
import { ArrowRight, Braces, Building2, ChevronDown, ClipboardList, FolderGit2, FolderOpen, GitMerge, GitPullRequest, Users } from "lucide-solid"
import { showToast } from "@opencode-ai/ui/toast"
import { cn } from "@/lib/utils"
import { env } from "@/lib/env"
import { DateRangePicker } from "../components/filters/date-range-picker"
import { queryDashboardSummary } from "../lib/api"
import { normalizeDateRange, parseQueryRange, rangeQuery, readQueryRange, searchQuery, sameRange } from "../lib/date-range"
import { formatV2Ratio } from "../lib/formatters"
import type { DashboardSummary } from "../lib/types"

function fmtInt(value?: number | null) {
  if (value == null) return "-"
  return new Intl.NumberFormat("zh-CN").format(Math.round(value))
}

function fmtRatio(value?: number | null) {
  return formatV2Ratio(value)
}

function days(value?: number | null) {
  if (value == null || value <= 0) return "-"
  const minutes = Math.round(Number(value))
  if (!Number.isFinite(minutes) || minutes <= 0) return "-"
  return (minutes / 480).toFixed(1)
}

function saved(summary: DashboardSummary) {
  return Math.max(0, (summary.need_baseline_calendar_min ?? 0) - (summary.need_actual_calendar_min ?? 0))
}

function blank(): DashboardSummary {
  return {
    total_users: 0,
    total_repos: 0,
    total_commits: 0,
    total_diff_lines: 0,
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
        "group relative h-full min-h-[11rem] min-w-0 overflow-hidden rounded-[20px] border border-[color:color-mix(in_oklab,var(--native-border)_40%,var(--native-bg))] bg-[var(--native-panel)] px-5 py-4 shadow-[0_10px_26px_-20px_rgba(31,53,120,0.22),0_2px_10px_-6px_rgba(71,85,145,0.12)] transition-transform duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-0.5 active:scale-[0.98]",
        props.live && "cursor-pointer",
      )}
      style={{ "--card-tone": props.tone, "touch-action": "manipulation" }}
    >
      <div class="flex items-start justify-between gap-4">
        <p class="m-0 text-[0.95rem] font-medium tracking-[-0.02em] text-[var(--native-foreground)]">{props.label}</p>
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
      <p class="mt-5 line-clamp-2 text-[0.95rem] leading-6 text-[var(--native-muted)]" title={props.hint}>{props.hint}</p>
    </article>
  )

  return props.href && props.live
    ? <A href={props.href} class="block h-full">{body}</A>
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
        "group relative flex min-h-[7.25rem] items-center justify-between gap-4 rounded-[18px] border border-[color:color-mix(in_oklab,var(--native-border)_40%,var(--native-bg))] bg-[var(--native-panel)] px-5 py-4 shadow-[0_10px_24px_-22px_rgba(43,63,129,0.3),0_2px_12px_-8px_rgba(71,85,145,0.14)] transition-transform duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-0.5 active:scale-[0.98]",
        props.live && "cursor-pointer",
      )}
      style={{ "touch-action": "manipulation" }}
    >
      <div class="flex min-w-0 items-center gap-4">
        <div class={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", props.iconShell)}>
          {props.icon}
        </div>
        <h3 class="m-0 text-[1.18rem] font-medium tracking-[-0.03em] text-[var(--native-foreground)]">{props.title}</h3>
      </div>

      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--native-muted)] transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:text-[var(--native-foreground)]">
        <ArrowRight class="h-5 w-5" stroke-width={1.9} />
      </div>
    </article>
  )

  return props.href && props.live
    ? <A href={props.href} class="block">{body}</A>
    : body
}

function TopLink(props: { title: string; href: string; active?: boolean }) {
  return (
    <A
      href={props.href}
      class={cn(
        "inline-flex h-11 items-center rounded-full px-4 text-[0.95rem] font-medium tracking-[-0.02em] transition-all duration-200 ease-out active:scale-[0.98]",
        props.active
          ? "bg-[var(--native-panel)] text-[var(--native-foreground)] shadow-[0_10px_22px_-18px_rgba(43,63,129,0.4)]"
          : "text-[var(--native-muted)] [@media(hover:hover)]:hover:bg-[var(--native-panel)]/88 [@media(hover:hover)]:hover:text-[var(--native-foreground)]",
      )}
      style={{ "touch-action": "manipulation" }}
    >
      {props.title}
    </A>
  )
}

function TopMenu(props: { title: string; items: Array<{ title: string; href: string }> }) {
  return (
    <div class="group relative">
      <div class="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[0.95rem] font-medium tracking-[-0.02em] text-[var(--native-muted)] transition-all duration-200 ease-out [@media(hover:hover)]:group-hover:bg-[var(--native-panel)]/88 [@media(hover:hover)]:group-hover:text-[var(--native-foreground)]">
        <span>{props.title}</span>
        <ChevronDown class="h-4 w-4 transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:rotate-180" stroke-width={1.8} />
      </div>

      <div class="pointer-events-none invisible absolute left-0 top-full z-20 min-w-[12rem] pt-3 translate-y-2 transition-transform duration-150 ease-out group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0">
        <div
          class="relative isolate overflow-hidden rounded-[18px] border border-[var(--native-border)] shadow-[0_18px_34px_-24px_rgba(34,58,120,0.28),0_8px_16px_-12px_rgba(72,90,140,0.14)]"
          style={{ "background-color": "var(--native-panel)" }}
        >
          <div class="absolute inset-0" style={{ "background-color": "var(--native-panel)" }} />
          <div class="relative flex flex-col gap-1 p-2">
            <For each={props.items}>{(item) => (
              <A
                href={item.href}
                class="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-[0.92rem] font-medium tracking-[-0.02em] text-[var(--native-foreground)] transition-colors duration-150 [@media(hover:hover)]:hover:bg-[color:color-mix(in_oklab,var(--native-primary)_10%,var(--native-bg))] [@media(hover:hover)]:hover:text-[var(--native-foreground)]"
              >
                <span>{item.title}</span>
                <ArrowRight class="h-4 w-4 text-[var(--native-muted)]" stroke-width={1.9} />
              </A>
            )}</For>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function KanbanHome() {
  const language = useLanguage()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string }>()
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
    ])
    const current = searchQuery([
      ["startDate", search.startDate],
      ["endDate", search.endDate],
    ])
    if (mirror.toString() !== current.toString()) setSearch(Object.fromEntries(mirror.entries()), { replace: true })
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
          title: language.t("kanban.home.loadFailed"),
          description: msg,
        })
        return blank()
      }
    },
  )

  const view = createMemo(() => summary.latest ?? summary() ?? blank())
  const query = createMemo(() => searchQuery([
    ["startDate", rangeQuery(state.dateRange).startDate],
    ["endDate", rangeQuery(state.dateRange).endDate],
  ]).toString())
  const href = (path: string) => query() ? `${path}?${query()}` : path

  const metrics = createMemo(() => [
    {
      label: language.t("kanban.home.metric.totalRepos"),
      value: fmtInt(view().total_repos),
      hint: language.t("kanban.home.metric.branchs", { count: fmtInt(view().total_branchs) }),
      tone: "#2d6bff",
      iconShell: "bg-[color:color-mix(in_oklab,var(--native-primary)_12%,var(--native-bg))] text-[var(--native-primary)]",
      icon: <FolderGit2 class="h-5 w-5" stroke-width={1.9} />,
      href: href("/kanban/repo"),
      live: true,
    },
    {
      label: language.t("kanban.home.metric.totalUsers"),
      value: fmtInt(view().total_users),
      hint: language.t("kanban.home.metric.usersHint"),
      tone: "#18a957",
      iconShell: "bg-[color:color-mix(in_oklab,var(--native-success)_12%,var(--native-bg))] text-[var(--native-success)]",
      icon: <Users class="h-5 w-5" stroke-width={1.9} />,
      href: href("/kanban/user"),
      live: true,
    },
    {
      label: language.t("kanban.home.metric.totalNeeds"),
      value: fmtInt(view().total_needs),
      hint: language.t("kanban.home.metric.needsHint", { merged: fmtInt(view().merged_needs), eligible: fmtInt(view().eligible_needs) }),
      tone: "#2e86ab",
      iconShell: "bg-[color:color-mix(in_oklab,#2e86ab_12%,var(--native-bg))] text-[#2e86ab]",
      icon: <GitPullRequest class="h-5 w-5" stroke-width={1.9} />,
      href: href("/kanban/need"),
      live: true,
    },
    {
      label: language.t("kanban.home.metric.totalCommits"),
      value: fmtInt(view().total_commits),
      hint: language.t("kanban.home.metric.diffLines", { count: fmtInt(view().total_commit_lines ?? view().total_diff_lines) }),
      tone: "#8a4cf6",
      iconShell: "bg-[color:color-mix(in_oklab,#8a4cf6_12%,var(--native-bg))] text-[#8a4cf6]",
      icon: <GitMerge class="h-5 w-5" stroke-width={1.9} />,
      href: href("/kanban/commit"),
      live: true,
    },
    {
      label: language.t("kanban.home.metric.totalCommitLines"),
      value: fmtInt(view().total_commit_lines ?? view().total_diff_lines),
      hint: language.t("kanban.home.metric.commitLinesHint"),
      tone: "#ff7a00",
      iconShell: "bg-[color:color-mix(in_oklab,var(--native-warning)_12%,var(--native-bg))] text-[var(--native-warning)]",
      icon: <Braces class="h-5 w-5" stroke-width={1.9} />,
    },
  ])

  const nav = createMemo(() => [
    {
      title: language.t("kanban.home.nav.need"),
      iconShell: "bg-[color:color-mix(in_oklab,#2e86ab_12%,var(--native-bg))] text-[#2e86ab]",
      icon: <GitPullRequest class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/need",
      live: true,
    },
    {
      title: language.t("kanban.home.nav.repo"),
      iconShell: "bg-[color:color-mix(in_oklab,var(--native-primary)_12%,var(--native-bg))] text-[var(--native-primary)]",
      icon: <FolderGit2 class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/repo",
      live: true,
    },
    {
      title: language.t("kanban.home.nav.user"),
      iconShell: "bg-[color:color-mix(in_oklab,var(--native-success)_12%,var(--native-bg))] text-[var(--native-success)]",
      icon: <Users class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/user",
      live: true,
    },
    {
      title: language.t("kanban.home.nav.org"),
      iconShell: "bg-[color:color-mix(in_oklab,#b188ef_12%,var(--native-bg))] text-[#b188ef]",
      icon: <Building2 class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/org",
      live: true,
    },
    {
      title: language.t("kanban.home.nav.commit"),
      iconShell: "bg-[color:color-mix(in_oklab,var(--native-warning)_12%,var(--native-bg))] text-[var(--native-warning)]",
      icon: <GitMerge class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/commit",
      live: true,
    },
    {
      title: language.t("kanban.home.nav.task"),
      iconShell: "bg-[color:color-mix(in_oklab,#f0b93f_12%,var(--native-bg))] text-[#f0b93f]",
      icon: <ClipboardList class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/task",
      live: true,
    },
    {
      title: language.t("kanban.home.nav.project"),
      iconShell: "bg-[color:color-mix(in_oklab,var(--native-primary)_12%,var(--native-bg))] text-[var(--native-primary)]",
      icon: <FolderOpen class="h-5 w-5" stroke-width={1.9} />,
      href: "/kanban/project",
      live: true,
    },
  ])

  const summaryStat = createMemo(() => [
    {
      label: language.t("kanban.home.summary.savedTime"),
      value: days(saved(view())),
      tone: "text-[var(--native-foreground)]",
    },
    {
      label: language.t("kanban.home.summary.baselineEst"),
      value: days(view().need_baseline_calendar_min),
      tone: "text-[var(--native-foreground)]",
    },
    {
      label: language.t("kanban.home.summary.actualTime"),
      value: days(view().need_actual_calendar_min),
      tone: "text-[var(--native-foreground)]",
    },
  ])

  const top = createMemo(() => ({
    org: [
      { title: language.t("kanban.home.shortNav.org"), href: href("/kanban/org") },
      { title: language.t("kanban.home.shortNav.user"), href: href("/kanban/user") },
    ],
    project: [
      { title: language.t("kanban.home.shortNav.project"), href: href("/kanban/project") },
      { title: language.t("kanban.home.shortNav.need"), href: href("/kanban/need") },
      { title: language.t("kanban.home.shortNav.repo"), href: href("/kanban/repo") },
      { title: language.t("kanban.home.shortNav.commit"), href: href("/kanban/commit") },
      { title: language.t("kanban.home.shortNav.task"), href: href("/kanban/task") },
    ],
  }))

  return (
    <div class="min-h-full overflow-x-clip bg-[var(--native-bg)] px-[clamp(1rem,3vw,4.5rem)] pb-[clamp(1rem,2vw,2rem)]">
      <div class="mx-auto flex w-full flex-col gap-6">
        <nav class="flex min-h-[80px] flex-col gap-3 border-b border-[var(--native-border)] px-1 py-3 lg:h-[80px] lg:flex-row lg:items-center lg:justify-between lg:px-0">
          <div class="flex flex-wrap items-center gap-2.5">
            <TopLink title={language.t("kanban.home.topMenu.home")} href={href("/kanban")} active={true} />
            <TopMenu title={language.t("kanban.home.topMenu.org")} items={top().org} />
            <TopMenu title={language.t("kanban.home.topMenu.project")} items={top().project} />
          </div>

          <div class="flex items-center gap-2 w-full lg:w-auto lg:flex-none">
            <div class="w-full lg:w-[15.5rem] lg:flex-none lg:[&>div]:min-w-0 lg:[&>div]:gap-1.5 lg:[&>div]:px-3 lg:[&>div>div:last-child]:gap-1 lg:[&_[aria-label='Open_date_range_picker']]:h-7 lg:[&_[aria-label='Open_date_range_picker']]:w-7">
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
        </nav>

        <header class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 flex-1 pt-1">
            <h1 class="whitespace-nowrap font-[var(--native-font-display)] text-[clamp(2rem,4vw,2.7rem)] leading-[1.18] font-medium tracking-[-0.05em] text-[var(--native-foreground)]">
                {language.t("kanban.home.title")}
            </h1>
          </div>
        </header>

        <section class="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(25rem,0.88fr)]">
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <For each={metrics()}>{(item, index) => (
              <div class={cn(index() === 4 && "xl:col-span-2") }>
                <MetricCard {...item} />
              </div>
            )}</For>
          </div>

          <section class="relative overflow-hidden rounded-[22px] border border-[color:color-mix(in_oklab,var(--native-primary)_25%,var(--native-bg))] bg-[linear-gradient(115deg,color-mix(in_oklab,var(--native-primary)_8%,var(--native-panel))_42%,color-mix(in_oklab,var(--native-primary)_15%,var(--native-panel))_100%)] px-6 pt-6 pb-10 shadow-[0_18px_38px_-30px_rgba(50,92,191,0.42),0_10px_24px_-18px_rgba(89,118,195,0.22)]">
            <div class="flex h-full flex-col justify-between gap-8">
              <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div class="max-w-[16rem]">
                  <div class="flex items-center gap-2 text-[var(--native-foreground)]">
                    <p class="m-0 text-[0.95rem] font-medium tracking-[-0.02em]">{language.t("kanban.home.summary.calendarEfficiency")}</p>
                  </div>
                  <p class="mt-10 text-[clamp(2.4rem,5vw,4rem)] leading-none font-medium tracking-[-0.08em] text-[#2d6bff] tabular-nums">{fmtRatio(view().need_calendar_ratio)}</p>
                  <p class="mt-3 text-[0.8rem] leading-5 text-[var(--native-muted)]">{language.t("kanban.home.summary.calendarDesc", { count: fmtInt(view().eligible_needs), work: fmtRatio(view().need_work_ratio) })}</p>
                </div>

                <div class="relative mx-auto h-[12rem] w-full max-w-[20rem] shrink-0 overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_50%_65%,color-mix(in_oklab,var(--native-primary)_12%,transparent)_54%,transparent_55%),radial-gradient(circle_at_68%_22%,color-mix(in_oklab,var(--native-primary)_14%,transparent)_28%,transparent_29%),transparent]">
                  <img
                    src={`${(env.BASE_PATH || "").replace(/\/+$/, "")}/kanban/ratio.webp`}
                    alt={language.t("kanban.home.summary.efficiency")}
                    class="absolute inset-0 h-full w-full object-contain object-center"
                    loading="eager"
                  />
                </div>
              </div>

              <div class="grid gap-4 border-t border-[var(--native-border)] pt-5 md:grid-cols-3 md:divide-x md:divide-[var(--native-border)] md:gap-0">
                <For each={summaryStat()}>
                  {(item) => (
                    <div class="space-y-2 md:px-5 first:md:pl-0 last:md:pr-0">
                      <p class="text-[0.95rem] text-[var(--native-foreground)]">{item.label}</p>
                      <p class={`text-[2.2rem] leading-none font-medium tracking-[-0.06em] tabular-nums ${item.tone}`}>{item.value}</p>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <p class="absolute right-6 bottom-4 text-[0.78rem] leading-none tracking-[-0.01em] text-[var(--native-muted)]">
              {language.t("kanban.home.summary.unit", { unit: language.t("kanban.unit.manDays") })}
            </p>
          </section>
        </section>

        <section class="grid gap-4">
          <div>
            <h2 class="text-[1.55rem] font-medium tracking-[-0.04em] text-[var(--native-foreground)]">{language.t("kanban.home.nav.entry")}</h2>
          </div>

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <For each={nav()}>{(item) => <NavCard {...item} />}</For>
          </div>
        </section>
      </div>
    </div>
  )
}