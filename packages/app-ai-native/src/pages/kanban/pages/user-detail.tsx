import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { createMemo, createResource, For, Show } from "solid-js"
import { showToast } from "@opencode-ai/ui/toast"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartCard } from "../components/charts/chart-card"
import { DateRangePicker } from "../components/filters/date-range-picker"
import { MetricCard } from "../components/metric-card"
import { RatioPill } from "../components/ratio-pill"
import { getUserDetail, listUsers } from "../lib/api"
import { defaultWideRange } from "../lib/date-range"
import { formatDuration } from "../lib/formatters"
import type { Granularity, UserDetailPeriodRow, UserOption } from "../lib/types"
import type { EChartsOption } from "echarts"

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

function parseGranularity(value?: string): Granularity {
  if (value === "week" || value === "month" || value === "year") return value
  return "day"
}

function fmtCost(value?: number | null) {
  if (value == null || value === 0) return "-"
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtTokens(up?: number, down?: number) {
  const total = (up ?? 0) + (down ?? 0)
  if (!total) return "-"
  if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`
  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`
  return String(total)
}

function periodRange(row: UserDetailPeriodRow, granularity: Granularity) {
  const key = row.period_key?.trim() || row.period_label?.trim() || ""
  if (!key) return { start: "", end: "" }
  if (granularity === "day") return { start: key.replace(/-/g, ""), end: key.replace(/-/g, "") }
  if (granularity === "week") {
    const match = key.match(/^(\d{4})-W(\d{2})$/)
    if (!match) return { start: "", end: "" }
    const year = Number(match[1])
    const week = Number(match[2])
    const jan4 = new Date(year, 0, 4)
    const day = jan4.getDay() || 7
    const monday = new Date(jan4)
    monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const start = `${monday.getFullYear()}${String(monday.getMonth() + 1).padStart(2, "0")}${String(monday.getDate()).padStart(2, "0")}`
    const end = `${sunday.getFullYear()}${String(sunday.getMonth() + 1).padStart(2, "0")}${String(sunday.getDate()).padStart(2, "0")}`
    return { start, end }
  }
  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number)
    const last = new Date(year, month, 0).getDate()
    return {
      start: `${year}${String(month).padStart(2, "0")}01`,
      end: `${year}${String(month).padStart(2, "0")}${String(last).padStart(2, "0")}`,
    }
  }
  return { start: `${key}0101`, end: `${key}1231` }
}

function bar(title: string, labels: string[], list: Array<{ name: string; type?: "bar" | "line"; data: number[] }>, format?: (value: number) => string): EChartsOption {
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14, fontWeight: "bold" } },
    tooltip: format ? {
      trigger: "axis",
      formatter(items) {
        const rows = Array.isArray(items) ? items : [items]
        return rows.reduce((txt, item, index) => `${txt}${index === 0 ? `${item.axisValue}<br/>` : ""}${item.marker}${item.seriesName}: ${format(Number(item.value ?? 0))}<br/>`, "")
      },
    } : { trigger: "axis" },
    legend: { data: list.map((item) => item.name), top: "8%", type: "scroll" },
    grid: { left: "5%", right: "5%", top: list.length > 3 ? "25%" : "20%", bottom: "10%", containLabel: true },
    xAxis: { type: "category", data: labels, axisLabel: { rotate: 45, fontSize: 11 } },
    yAxis: title.includes("提效比") ? { type: "value", axisLabel: { formatter: "{value}%" } } : { type: "value" },
    series: list.map((item) => ({ name: item.name, type: item.type ?? "bar", data: item.data, smooth: item.type === "line" })),
  }
}

export default function KanbanUserDetail() {
  const params = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string; granularity?: string; mock?: string }>()

  const userId = createMemo(() => decodeURIComponent(params.userId ?? "").trim())
  const dateRange = createMemo(() => parseQueryRange(search.startDate, search.endDate))
  const granularity = createMemo(() => parseGranularity(search.granularity))
  const listHref = createMemo(() => {
    const q = new URLSearchParams()
    const next = rangeQuery(dateRange())
    q.set("startDate", next.startDate)
    q.set("endDate", next.endDate)
    q.set("granularity", granularity())
    if (search.mock?.trim()) q.set("mock", search.mock.trim())
    return `/kanban/user?${q.toString()}`
  })

  const detailHref = (id: string) => {
    const q = new URLSearchParams()
    const next = rangeQuery(dateRange())
    q.set("startDate", next.startDate)
    q.set("endDate", next.endDate)
    q.set("granularity", granularity())
    if (search.mock?.trim()) q.set("mock", search.mock.trim())
    return `/kanban/user/${encodeURIComponent(id)}?${q.toString()}`
  }

  const [users] = createResource(
    () => true,
    async () => {
      try {
        return await listUsers()
      } catch (err) {
        showToast({
          variant: "error",
          title: "用户列表加载失败",
          description: err instanceof Error ? err.message : String(err),
        })
        return [] as UserOption[]
      }
    },
  )

  const [detail, { refetch }] = createResource(
    () => ({ userId: userId(), dateRange: dateRange(), granularity: granularity() }),
    async (input) => {
      if (!input.userId) return null
      try {
        return await getUserDetail(input)
      } catch (err) {
        showToast({
          variant: "error",
          title: "用户详情加载失败",
          description: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    },
  )

  const summary = createMemo(() => detail()?.summary ?? {})
  const commits = createMemo(() => detail()?.commits ?? [])
  const tasks = createMemo(() => detail()?.tasks ?? [])
  const labels = createMemo(() => (commits().length ? commits() : tasks()).map((item) => item.period_label || item.period_key || "-"))
  const taskRatio = createMemo(() => summary().task_efficiency_ratio)
  const commitRatio = createMemo(() => summary().commit_efficiency_ratio)
  const userName = createMemo(() => summary().user_name?.trim() || "")

  const chart1 = createMemo<EChartsOption | undefined>(() => {
    if (!labels().length) return undefined
    return bar("Task数 & Commit数", labels(), [
      { name: "Task数", data: tasks().map((item) => Number(item.task_count ?? 0)) },
      { name: "Commit数", data: commits().map((item) => Number(item.commit_count ?? 0)) },
    ])
  })

  const chart2 = createMemo<EChartsOption | undefined>(() => {
    if (!labels().length) return undefined
    return bar("代码行数", labels(), [
      { name: "Task代码行数", data: tasks().map((item) => Number(item.task_diff_lines ?? 0)) },
      { name: "Commit代码行数", data: commits().map((item) => Number(item.commit_diff_lines ?? 0)) },
    ])
  })

  const chart3 = createMemo<EChartsOption | undefined>(() => {
    if (!labels().length) return undefined
    return bar("耗时对比", labels(), [
      { name: "Task传统耗时", data: tasks().map((item) => Number(item.task_ancient_minutes ?? 0)) },
      { name: "Task实际耗时", data: tasks().map((item) => Number(item.task_real_minutes ?? 0)) },
      { name: "Commit传统耗时", data: commits().map((item) => Number(item.commit_ancient_minutes ?? 0)) },
      { name: "Commit实际耗时", data: commits().map((item) => Number(item.commit_real_minutes ?? 0)) },
    ], (value) => formatDuration(value))
  })

  const chart4 = createMemo<EChartsOption | undefined>(() => {
    if (!labels().length) return undefined
    return bar("费用", labels(), [
      { name: "费用", data: commits().map((item) => Number(item.cost ?? 0)) },
    ], (value) => `${value.toFixed(2)} 元`)
  })

  const chart5 = createMemo<EChartsOption | undefined>(() => {
    if (!labels().length) return undefined
    return bar("提效比趋势", labels(), [
      { name: "Task提效比", type: "line", data: tasks().map((item) => Number(item.task_efficiency_ratio ?? 0)) },
      { name: "Commit提效比", type: "line", data: commits().map((item) => Number(item.commit_efficiency_ratio ?? 0)) },
    ], (value) => `${value.toFixed(1)}%`)
  })

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <header class="flex flex-col gap-3">
          <A href={listHref()} class="inline-flex items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)]">
            <span>←</span>
            <span>返回用户列表</span>
          </A>

          <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div class="flex flex-col gap-2 md:flex-row md:items-end md:gap-4">
                <div>
                  <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--native-success)]">Kanban / User Detail</p>
                  <h1 class="mt-2 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">用户详情</h1>
                </div>

                <label class="flex min-w-0 flex-col gap-2 md:min-w-[14rem]">
                  <span class="text-[0.75rem] text-[var(--native-muted)]">选择用户</span>
                  <select
                    class="flex h-10 min-w-[14rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={userId()}
                    onChange={(e) => {
                      const txt = e.currentTarget.value.trim()
                      if (!txt || txt === userId()) return
                      navigate(detailHref(txt))
                    }}
                  >
                    <option value="">选择用户</option>
                    <For each={users() ?? []}>
                      {(item) => <option value={item.user_id}>{item.user_name || item.user_id}</option>}
                    </For>
                  </select>
                </label>
              </div>

              <div class="flex flex-col gap-3 md:flex-row md:items-end">
                <label class="flex min-w-0 flex-col gap-2">
                  <span class="text-[0.75rem] text-[var(--native-muted)]">日期范围</span>
                  <DateRangePicker
                    value={dateRange()}
                    onChange={(value) => {
                      const next = value ?? defaultWideRange()
                      const query = rangeQuery(next)
                      if (search.mock?.trim()) setSearch({ ...query, granularity: granularity(), mock: search.mock.trim() })
                      else setSearch({ ...query, granularity: granularity() })
                    }}
                    clearable={false}
                    placeholder="选择日期范围"
                  />
                </label>

                <label class="flex min-w-0 flex-col gap-2">
                  <span class="text-[0.75rem] text-[var(--native-muted)]">聚合粒度</span>
                  <select
                    class="flex h-10 min-w-[8rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={granularity()}
                    onChange={(e) => {
                      const next = e.currentTarget.value as Granularity
                      const query = rangeQuery(dateRange())
                      if (search.mock?.trim()) setSearch({ ...query, granularity: next, mock: search.mock.trim() })
                      else setSearch({ ...query, granularity: next })
                    }}
                  >
                    <option value="day">天</option>
                    <option value="week">周</option>
                    <option value="month">月</option>
                    <option value="year">年</option>
                  </select>
                </label>

                <div class="flex items-end">
                  <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={detail.loading}>刷新</Button>
                </div>
              </div>
            </div>
          </section>
        </header>

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="总活跃天数" value={String(summary().day_count ?? 0)} accent="var(--native-success)" />
          <MetricCard label="总Task数" value={String(summary().task_count ?? 0)} accent="var(--native-warning)" />
          <MetricCard label="总Commit数" value={String(summary().commit_count ?? 0)} accent="var(--native-primary)" />
          <MetricCard label="Task提效比" value={taskRatio() == null ? "-" : `${taskRatio()!.toFixed(1)}%`} accent="var(--native-success)" />
          <MetricCard label="Commit提效比" value={commitRatio() == null ? "-" : `${commitRatio()!.toFixed(1)}%`} accent="var(--native-primary)" />
          <MetricCard label="总费用" value={fmtCost(summary().cost)} accent="var(--native-warning)" />
        </section>

        <section class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
          <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">Commits 列表</div>
          <div class="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-[140px]">时间</TableHead>
                  <TableHead class="min-w-[90px] text-right">Task数</TableHead>
                  <TableHead class="min-w-[90px] text-right">代码量</TableHead>
                  <TableHead class="min-w-[110px] text-right">实际耗时</TableHead>
                  <TableHead class="min-w-[150px] text-right">传统开发时长预估</TableHead>
                  <TableHead class="min-w-[100px] text-center">提效比</TableHead>
                  <TableHead class="min-w-[120px] text-right">Tokens消耗</TableHead>
                  <TableHead class="min-w-[100px] text-right">费用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Show when={commits().length > 0} fallback={<TableRow><TableCell colSpan={8} class="py-8 text-center text-sm text-[var(--native-muted)]">暂无 Commit 数据</TableCell></TableRow>}>
                  <For each={commits()}>
                    {(row) => {
                      const link = () => {
                        const span = periodRange(row, granularity())
                        const q = new URLSearchParams()
                        if (span.start && span.end) {
                          q.set("startDate", span.start)
                          q.set("endDate", span.end)
                        }
                        if (userName()) q.set("userName", userName())
                        return `/kanban/task?${q.toString()}`
                      }

                      return (
                        <TableRow>
                          <TableCell>{row.period_label || row.period_key || "-"}</TableCell>
                          <TableCell class="text-right tabular-nums">{(row.task_count ?? 0) > 0 ? <button type="button" class="text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => navigate(link())}>{row.task_count}</button> : 0}</TableCell>
                          <TableCell class="text-right tabular-nums">{row.commit_diff_lines ?? 0}</TableCell>
                          <TableCell class="text-right">{formatDuration(row.commit_real_minutes)}</TableCell>
                          <TableCell class="text-right">{formatDuration(row.commit_ancient_minutes)}</TableCell>
                          <TableCell class="text-center"><RatioPill value={row.commit_efficiency_ratio} /></TableCell>
                          <TableCell class="text-right tabular-nums">{fmtTokens(row.upstream_tokens, row.downstream_tokens)}</TableCell>
                          <TableCell class="text-right tabular-nums">{fmtCost(row.cost)}</TableCell>
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
          <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">Tasks 列表</div>
          <div class="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-[140px]">时间</TableHead>
                  <TableHead class="min-w-[90px] text-right">Commit数</TableHead>
                  <TableHead class="min-w-[90px] text-right">代码量</TableHead>
                  <TableHead class="min-w-[110px] text-right">实际耗时</TableHead>
                  <TableHead class="min-w-[150px] text-right">传统开发时长预估</TableHead>
                  <TableHead class="min-w-[100px] text-center">提效比</TableHead>
                  <TableHead class="min-w-[120px] text-right">Tokens消耗</TableHead>
                  <TableHead class="min-w-[100px] text-right">费用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Show when={tasks().length > 0} fallback={<TableRow><TableCell colSpan={8} class="py-8 text-center text-sm text-[var(--native-muted)]">暂无 Task 数据</TableCell></TableRow>}>
                  <For each={tasks()}>
                    {(row) => {
                      const link = () => {
                        const span = periodRange(row, granularity())
                        const q = new URLSearchParams()
                        if (span.start && span.end) {
                          q.set("startDate", span.start)
                          q.set("endDate", span.end)
                        }
                        if (userName()) q.set("userName", userName())
                        return `/kanban/commit?${q.toString()}`
                      }

                      return (
                        <TableRow>
                          <TableCell>{row.period_label || row.period_key || "-"}</TableCell>
                          <TableCell class="text-right tabular-nums">{(row.commit_count ?? 0) > 0 ? <button type="button" class="text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => navigate(link())}>{row.commit_count}</button> : 0}</TableCell>
                          <TableCell class="text-right tabular-nums">{row.task_diff_lines ?? 0}</TableCell>
                          <TableCell class="text-right">{formatDuration(row.task_real_minutes)}</TableCell>
                          <TableCell class="text-right">{formatDuration(row.task_ancient_minutes)}</TableCell>
                          <TableCell class="text-center"><RatioPill value={row.task_efficiency_ratio} /></TableCell>
                          <TableCell class="text-right tabular-nums">{fmtTokens(row.upstream_tokens, row.downstream_tokens)}</TableCell>
                          <TableCell class="text-right tabular-nums">{fmtCost(row.cost)}</TableCell>
                        </TableRow>
                      )
                    }}
                  </For>
                </Show>
              </TableBody>
            </Table>
          </div>
        </section>

        <section class="grid gap-4 lg:grid-cols-2">
          <ChartCard option={chart1()} empty="暂无数量图表数据" />
          <ChartCard option={chart2()} empty="暂无代码量图表数据" />
          <ChartCard option={chart3()} empty="暂无耗时图表数据" />
          <ChartCard option={chart4()} empty="暂无费用图表数据" />
        </section>

        <ChartCard option={chart5()} empty="暂无提效比图表数据" />
      </div>
    </div>
  )
}