import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Back from "../components/back"
import { ChartCard } from "../components/charts/chart-card"
import { DateRangePicker } from "../components/filters/date-range-picker"
import { SearchCreateSelect } from "../components/filters/search-create-select"
import { MetricCard } from "../components/metric-card"
import { getUserDetail, listUsers } from "../lib/api"
import { defaultWideRange, parseQueryRange, rangeQuery, searchQuery } from "../lib/date-range"
import { chart } from "../lib/chart-options"
import { formatDuration, formatLocalTime, formatV2Ratio, shortId } from "../lib/formatters"
import type { NeedRow, UserOption, UserWeekRow } from "../lib/types"
import type { EChartsOption } from "echarts"

function fmtDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

// V2 提效比小数口径，×100 显示；着色按提效幅度。
function V2Ratio(props: { value?: number | null }) {
  const tone = () => {
    const v = props.value
    if (v == null) return "border-border bg-muted/40 text-muted-foreground"
    if (v < 0) return "border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300"
    if (v >= 1) return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
    if (v >= 0.3) return "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300"
    return "border-border bg-muted/50 text-muted-foreground"
  }
  return (
    <span class={`inline-flex min-w-[4.5rem] items-center justify-center rounded-full border px-2 py-1 text-xs font-medium tabular-nums ${tone()}`}>
      {formatV2Ratio(props.value)}
    </span>
  )
}

function statusTone(status?: string) {
  if (status === "merged") return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  if (status === "active") return "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300"
  return "border-border bg-muted/40 text-muted-foreground"
}

function queryOf(range: [string, string]) {
  const next = rangeQuery(range)
  return searchQuery([
    ["startDate", next.startDate],
    ["endDate", next.endDate],
  ])
}

export default function KanbanUserDetail() {
  const language = useLanguage()
  const params = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string }>()

  const userId = createMemo(() => decodeURIComponent(params.userId ?? "").trim())
  const dateRange = createMemo(() => parseQueryRange(search.startDate, search.endDate))

  const [users] = createResource(
    () => true,
    async () => {
      try {
        return await listUsers()
      } catch (err) {
        showToast({
          variant: "error",
          title: language.t("kanban.loading.userList"),
          description: err instanceof Error ? err.message : String(err),
        })
        return [] as UserOption[]
      }
    },
  )

  const detailHref = (id: string) => `/kanban/user/${encodeURIComponent(id)}?${queryOf(dateRange()).toString()}`

  const userOptions = createMemo(() =>
    (users() ?? []).map((item) => ({
      label: item.user_name || item.user_id,
      value: item.user_id,
    })),
  )

  const userDisplayValue = createMemo(() => {
    const id = userId()
    if (!id) return undefined
    return userOptions().find((o) => o.value === id)?.label
  })

  const [detail, { refetch }] = createResource(
    () => ({ userId: userId(), dateRange: dateRange() }),
    async (input) => {
      if (!input.userId) return null
      try {
        return await getUserDetail(input)
      } catch (err) {
        showToast({
          variant: "error",
          title: language.t("kanban.loading.userDetail"),
          description: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    },
  )

  const [cachedDetail, setCachedDetail] = createSignal<{ key: string; data: NonNullable<Awaited<ReturnType<typeof getUserDetail>>> } | null>(null)

  createEffect(() => {
    const data = detail()
    if (!data) return
    setCachedDetail({ key: userId(), data })
  })

  const view = createMemo(() => {
    const data = detail()
    if (data) return data
    const cached = cachedDetail()
    if (cached?.key === userId()) return cached.data
    return null
  })

  const summary = createMemo(() => view()?.summary ?? {})
  const weeks = createMemo<UserWeekRow[]>(() => view()?.weeks ?? [])
  const needs = createMemo<NeedRow[]>(() => view()?.needs ?? [])
  const commits = createMemo(() => view()?.commits ?? [])

  // 周趋势：按 week_start 升序，日历提效（%）折线 + 合并需求柱状。
  const weeklyChart = createMemo<EChartsOption | undefined>(() => {
    if (!weeks().length) return undefined
    const ordered = [...weeks()].sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)))
    const labels = ordered.map((w) => fmtDate(w.week_start))
    return chart(language.t("kanban.user.chart.weekly"), labels, [
      { name: language.t("kanban.user.col.calendarEfficiency"), type: "line", data: ordered.map((w) => Number((((w.efficiency_ratio ?? 0) as number) * 100).toFixed(1))) },
      { name: language.t("kanban.user.col.mergedNeeds"), type: "bar", data: ordered.map((w) => Number(w.merged_need_count ?? 0)) },
    ], { titleSize: 14 })
  })

  const needHref = (n: NeedRow) => {
    const id = n.need_id?.trim()
    if (!id) return ""
    return `/kanban/need/${encodeURIComponent(id)}?${queryOf(dateRange()).toString()}`
  }

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <div class="flex w-full flex-col gap-5">
        <header class="flex flex-col gap-3">
          <Back />

          <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 class="font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">{language.t("kanban.detail.user")}</h1>
              <p class="mt-1 text-sm text-[var(--native-muted)]">{summary().user_name || summary().user_id || userId()}</p>
            </div>

            <div class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-end">
              <label class="flex min-w-0 flex-col gap-2 md:min-w-[14rem]">
                <SearchCreateSelect
                  value={userId()}
                  displayValue={userDisplayValue()}
                  options={userOptions()}
                  loading={users.loading}
                  allowCreate={false}
                  showValue={false}
                  placeholder={language.t("kanban.label.selectUser")}
                  onChange={(val) => {
                    if (!val || val === userId()) return
                    navigate(detailHref(val))
                  }}
                  class="h-10 min-w-[14rem]"
                />
              </label>

              <label class="flex min-w-0 flex-col gap-2">
                <DateRangePicker
                  value={dateRange()}
                  onChange={(value) => {
                    const next = value ?? defaultWideRange()
                    setSearch(Object.fromEntries(queryOf(next).entries()), { replace: true })
                  }}
                  clearable={false}
                  placeholder={language.t("kanban.filter.selectDateRange")}
                />
              </label>

              <div class="flex items-end">
                <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={detail.loading}>{language.t("kanban.action.refresh")}</Button>
              </div>
            </div>
          </div>
        </header>

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label={language.t("kanban.user.col.mergedNeeds")} value={String(summary().merged_need_count ?? 0)} accent="var(--native-primary)" />
          <MetricCard label={language.t("kanban.user.col.calendarEfficiency")} value={formatV2Ratio(summary().calendar_ratio)} accent="var(--native-success)" />
          <MetricCard label={language.t("kanban.user.col.workEfficiency")} value={formatV2Ratio(summary().work_ratio)} accent="var(--native-info)" />
          <MetricCard label={language.t("kanban.user.col.actualCalendar")} value={formatDuration(summary().actual_calendar_min, language.t)} accent="var(--native-warning)" />
          <MetricCard label={language.t("kanban.user.col.baselineCalendar")} value={formatDuration(summary().baseline_calendar_min, language.t)} accent="var(--native-warning)" />
          <MetricCard label={language.t("kanban.user.metric.commitAndLines")} value={`${summary().commit_count ?? 0} / ${summary().commit_diff_lines ?? 0}`} accent="#8a4cf6" />
        </section>

        <section class="grid gap-4 lg:grid-cols-2">
          <section class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
            <div class="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
              <span>{language.t("kanban.user.section.weekly")}</span>
              <span class="text-xs font-normal text-[var(--native-muted)]">{language.t("kanban.user.weeklyCount", { count: String(weeks().length) })}</span>
            </div>
            <div class="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="min-w-[120px]">{language.t("kanban.user.col.weekStart")}</TableHead>
                    <TableHead class="min-w-[70px] text-left">{language.t("kanban.user.col.mergedNeeds")}</TableHead>
                    <TableHead class="min-w-[70px] text-left">{language.t("kanban.user.col.activeNeeds")}</TableHead>
                    <TableHead class="min-w-[100px] text-left">{language.t("kanban.user.col.calendarEfficiency")}</TableHead>
                    <TableHead class="min-w-[100px] text-left">{language.t("kanban.user.col.workEfficiency")}</TableHead>
                    <TableHead class="min-w-[70px] text-left">{language.t("kanban.table.commitCount")}</TableHead>
                    <TableHead class="min-w-[80px] text-left">{language.t("kanban.user.col.confidence")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <Show when={weeks().length > 0} fallback={<TableRow><TableCell colSpan={7} class="py-8 text-left text-sm text-[var(--native-muted)]">{language.t("kanban.user.empty.weekly")}</TableCell></TableRow>}>
                    <For each={weeks()}>
                      {(w) => (
                        <TableRow>
                          <TableCell>{fmtDate(w.week_start)}</TableCell>
                          <TableCell class="text-left tabular-nums">{w.merged_need_count ?? 0}</TableCell>
                          <TableCell class="text-left tabular-nums">{w.active_need_count ?? 0}</TableCell>
                          <TableCell class="text-left"><V2Ratio value={w.efficiency_ratio} /></TableCell>
                          <TableCell class="text-left"><V2Ratio value={w.work_efficiency_ratio} /></TableCell>
                          <TableCell class="text-left tabular-nums">{w.commit_count ?? 0}</TableCell>
                          <TableCell class="text-left">
                            <Show
                              when={w.confidence_limited}
                              fallback={<span class="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">{language.t("kanban.user.tag.normal")}</span>}
                            >
                              <span class="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300" title={w.confidence_reason || undefined}>{language.t("kanban.user.tag.limited")}</span>
                            </Show>
                          </TableCell>
                        </TableRow>
                      )}
                    </For>
                  </Show>
                </TableBody>
              </Table>
            </div>
          </section>

          <ChartCard option={weeklyChart()} empty={language.t("kanban.user.empty.weeklyChart")} />
        </section>

        <section class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
          <div class="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
            <span>{language.t("kanban.user.section.needs")}</span>
            <span class="text-xs font-normal text-[var(--native-muted)]">{language.t("kanban.user.needsCount", { count: String(needs().length) })}</span>
          </div>
          <div class="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-[200px]">{language.t("kanban.need.col.needId")}</TableHead>
                  <TableHead class="min-w-[90px]">{language.t("kanban.need.col.status")}</TableHead>
                  <TableHead class="min-w-[200px]">{language.t("kanban.need.col.repo")}</TableHead>
                  <TableHead class="min-w-[130px]">{language.t("kanban.need.col.branch")}</TableHead>
                  <TableHead class="min-w-[110px] text-left">{language.t("kanban.need.col.actualCalendar")}</TableHead>
                  <TableHead class="min-w-[100px] text-left">{language.t("kanban.user.col.calendarEfficiency")}</TableHead>
                  <TableHead class="min-w-[100px] text-left">{language.t("kanban.user.col.workEfficiency")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Show when={needs().length > 0} fallback={<TableRow><TableCell colSpan={7} class="py-8 text-left text-sm text-[var(--native-muted)]">{language.t("kanban.user.empty.needs")}</TableCell></TableRow>}>
                  <For each={needs()}>
                    {(n) => {
                      const href = needHref(n)
                      return (
                        <TableRow>
                          <TableCell>
                            <Show when={href} fallback={<span class="block max-w-[18rem] truncate" title={n.need_id ?? undefined}>{shortId(n.need_id, 18)}</span>}>
                              <button type="button" class="block max-w-[18rem] truncate text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer" title={n.need_id ?? undefined} onClick={() => navigate(href)}>{shortId(n.need_id, 18)}</button>
                            </Show>
                          </TableCell>
                          <TableCell><span class={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(n.status)}`}>{n.status || "-"}</span></TableCell>
                          <TableCell><div class="max-w-[18rem] truncate" title={n.repo_addr ?? undefined}>{n.repo_addr || "-"}</div></TableCell>
                          <TableCell><div class="max-w-[12rem] truncate" title={n.repo_branch ?? undefined}>{n.repo_branch || "-"}</div></TableCell>
                          <TableCell class="text-left">{formatDuration(n.total_calendar_min, language.t)}</TableCell>
                          <TableCell class="text-left"><V2Ratio value={n.efficiency_ratio} /></TableCell>
                          <TableCell class="text-left"><V2Ratio value={n.work_efficiency_ratio} /></TableCell>
                        </TableRow>
                      )
                    }}
                  </For>
                </Show>
              </TableBody>
            </Table>
          </div>
        </section>

        <section class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
          <div class="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
            <span>{language.t("kanban.user.section.commits")}</span>
            <span class="text-xs font-normal text-[var(--native-muted)]">{language.t("kanban.user.commitsCount", { count: String(commits().length) })}</span>
          </div>
          <div class="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-[120px]">{language.t("kanban.table.commitId")}</TableHead>
                  <TableHead class="min-w-[160px]">{language.t("kanban.label.commitTime")}</TableHead>
                  <TableHead class="min-w-[200px]">{language.t("kanban.need.col.repo")}</TableHead>
                  <TableHead class="min-w-[90px] text-left">{language.t("kanban.table.commitCodeLines")}</TableHead>
                  <TableHead class="min-w-[200px]">{language.t("kanban.table.comment")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Show when={commits().length > 0} fallback={<TableRow><TableCell colSpan={5} class="py-8 text-left text-sm text-[var(--native-muted)]">{language.t("kanban.user.empty.commits")}</TableCell></TableRow>}>
                  <For each={commits()}>
                    {(c) => (
                      <TableRow>
                        <TableCell>
                          <button type="button" class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer" onClick={() => { const id = c.commit_id?.trim(); if (id) navigate(`/kanban/commit/${encodeURIComponent(id)}`) }}>{shortId(c.commit_id, 10)}</button>
                        </TableCell>
                        <TableCell>{formatLocalTime(c.commit_time)}</TableCell>
                        <TableCell><div class="max-w-[18rem] truncate" title={c.repo_addr ?? undefined}>{c.repo_addr || "-"}</div></TableCell>
                        <TableCell class="text-left tabular-nums">{c.diff_lines ?? 0}</TableCell>
                        <TableCell><div class="max-w-[20rem] truncate" title={c.comment ?? undefined}>{c.comment || "-"}</div></TableCell>
                      </TableRow>
                    )}
                  </For>
                </Show>
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  )
}
