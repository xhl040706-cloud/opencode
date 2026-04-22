import { useNavigate, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { showToast } from "@opencode-ai/ui/toast"
import type { EChartsOption } from "echarts"
import { Button } from "@/components/ui/button"
import { FilterBar } from "../components/filters/filter-bar"
import { ChartCard } from "../components/charts/chart-card"
import { RatioPill } from "../components/ratio-pill"
import { FilterTable } from "../components/table/filter-table"
import { useTableFilters } from "../hooks/use-table-filters"
import { queryOrgRows } from "../lib/api"
import { defaultWideRange, normalizeDateRange } from "../lib/date-range"
import { applyClientFilters } from "../lib/filter-utils"
import type { Granularity, KanbanColumn, OrgAggregateQuery, OrgAggregateRow, OrgAggregateSeries, OrgCascadeValue } from "../lib/types"

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

function sameRange(a: [string, string] | null | undefined, b: [string, string] | null | undefined) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a[0] === b[0] && a[1] === b[1]
}

function parseGranularity(value?: string): Granularity {
  if (value === "week" || value === "month" || value === "year") return value
  return "day"
}

function parseOrg(search: { org1?: string; org2?: string; org3?: string; org4?: string }) {
  return {
    org1: search.org1?.trim() || undefined,
    org2: search.org2?.trim() || undefined,
    org3: search.org3?.trim() || undefined,
    org4: search.org4?.trim() || undefined,
  } satisfies OrgCascadeValue
}

function sameOrg(a: OrgCascadeValue, b: OrgCascadeValue) {
  return a.org1 === b.org1 && a.org2 === b.org2 && a.org3 === b.org3 && a.org4 === b.org4
}

function fmtCost(value?: number | null) {
  if (value == null || value === 0) return "-"
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function nextOrg(base: OrgCascadeValue, name?: string) {
  const txt = name?.trim()
  if (!txt) return base
  if (base.org3) return { ...base, org4: txt }
  if (base.org2) return { ...base, org3: txt }
  if (base.org1) return { ...base, org2: txt }
  return { org1: txt }
}

function orgPath(value: OrgCascadeValue) {
  return [value.org1, value.org2, value.org3, value.org4].filter(Boolean).join("/")
}

function queryOf(range: [string, string], granularity: Granularity, org: OrgCascadeValue, mock?: string) {
  const next = new URLSearchParams()
  const dates = rangeQuery(range)
  next.set("startDate", dates.startDate)
  next.set("endDate", dates.endDate)
  next.set("granularity", granularity)
  if (org.org1) next.set("org1", org.org1)
  if (org.org2) next.set("org2", org.org2)
  if (org.org3) next.set("org3", org.org3)
  if (org.org4) next.set("org4", org.org4)
  if (mock?.trim()) next.set("mock", mock.trim())
  return next.toString()
}

function queryString(search: Record<string, string | undefined>) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    const txt = value?.trim()
    if (txt) next.set(key, txt)
  }
  return next.toString()
}

function line(title: string, periods: string[], list: Array<{ name: string; data: number[] }>, format?: (value: number) => string): EChartsOption {
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 13, fontWeight: "bold" } },
    tooltip: format ? {
      trigger: "axis",
      formatter(items) {
        const rows = Array.isArray(items) ? items : [items]
        return rows.reduce((txt, item, index) => `${txt}${index === 0 ? `${item.axisValue}<br/>` : ""}${item.marker}${item.seriesName}: ${format(Number(item.value ?? 0))}<br/>`, "")
      },
    } : { trigger: "axis" },
    legend: { data: list.map((item) => item.name), top: "8%", type: "scroll" },
    grid: { left: "5%", right: "5%", top: "22%", bottom: "10%", containLabel: true },
    xAxis: { type: "category", data: periods, axisLabel: { rotate: 45, fontSize: 11 } },
    yAxis: title.includes("提效比") ? { type: "value", axisLabel: { formatter: "{value}%" } } : { type: "value" },
    series: list.map((item) => ({ name: item.name, type: "line", smooth: true, data: item.data })),
  }
}

function values(series: OrgAggregateSeries, field: keyof OrgAggregateSeries["points"][number]) {
  return series.points.map((item) => Number(item[field] ?? 0))
}

export default function KanbanOrgList() {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string; org1?: string; org2?: string; org3?: string; org4?: string; granularity?: string; mock?: string }>()
  const [state, setState] = createStore({
    page: 1,
    pageSize: 50,
    dateRange: parseQueryRange(search.startDate, search.endDate),
    org: parseOrg(search),
    granularity: parseGranularity(search.granularity),
  })

  createEffect(() => {
    const next = parseQueryRange(search.startDate, search.endDate)
    if (!sameRange(state.dateRange, next)) setState("dateRange", next)

    const org = parseOrg(search)
    if (!sameOrg(state.org, org)) setState("org", org)

    const granularity = parseGranularity(search.granularity)
    if (state.granularity !== granularity) setState("granularity", granularity)
  })

  createEffect(() => {
    const next = normalizeDateRange(state.dateRange)
    if (!next) return

    const mirror = queryOf(next, state.granularity, state.org, search.mock)
    const current = queryString(search as Record<string, string | undefined>)
    if (mirror !== current) setSearch(Object.fromEntries(new URLSearchParams(mirror).entries()))
  })

  const query = createMemo<OrgAggregateQuery>(() => ({
    dateRange: state.dateRange,
    org: state.org,
    granularity: state.granularity,
  }))

  const routeQuery = (org: OrgCascadeValue) => queryOf(state.dateRange, state.granularity, org, search.mock)

  const columns = createMemo<KanbanColumn<OrgAggregateRow>[]>(() => [
    {
      prop: "org_name",
      label: "组织",
      minWidth: 160,
      render: (row) => {
        const scope = nextOrg(state.org, row.org_name)
        const path = orgPath(scope)
        return path ? (
          <button type="button" class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => navigate(`/kanban/org/${encodeURIComponent(path)}?${routeQuery(scope)}`)}>
            {row.org_name || "-"}
          </button>
        ) : <span>{row.org_name || "-"}</span>
      },
      filter: { type: "text" },
    },
    {
      prop: "user_count",
      label: "成员数",
      minWidth: 90,
      align: "right",
      render: (row) => {
        const scope = nextOrg(state.org, row.org_name)
        return (row.user_count ?? 0) > 0 ? (
          <button type="button" class="text-right text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => navigate(`/kanban/user?${routeQuery(scope)}`)}>
            {row.user_count}
          </button>
        ) : <span>0</span>
      },
      filter: { type: "number" },
    },
    {
      prop: "task_count",
      label: "Task 数",
      minWidth: 90,
      align: "right",
      render: (row) => {
        const scope = nextOrg(state.org, row.org_name)
        return (row.task_count ?? 0) > 0 ? (
          <button type="button" class="text-right text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => navigate(`/kanban/task?${routeQuery(scope)}`)}>
            {row.task_count}
          </button>
        ) : <span>0</span>
      },
      filter: { type: "number" },
    },
    { prop: "task_diff_lines", label: "Task 代码量", minWidth: 110, align: "right", filter: { type: "number" } },
    { prop: "task_efficiency_ratio", label: "Task 提效比", minWidth: 120, align: "center", render: (row) => <RatioPill value={row.task_efficiency_ratio} />, filter: { type: "number" } },
    {
      prop: "commit_count",
      label: "Commit 数",
      minWidth: 100,
      align: "right",
      render: (row) => {
        const scope = nextOrg(state.org, row.org_name)
        return (row.commit_count ?? 0) > 0 ? (
          <button type="button" class="text-right text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => navigate(`/kanban/commit?${routeQuery(scope)}`)}>
            {row.commit_count}
          </button>
        ) : <span>0</span>
      },
      filter: { type: "number" },
    },
    { prop: "commit_diff_lines", label: "Commit 代码量", minWidth: 120, align: "right", filter: { type: "number" } },
    { prop: "commit_efficiency_ratio", label: "Commit 提效比", minWidth: 130, align: "center", render: (row) => <RatioPill value={row.commit_efficiency_ratio} />, filter: { type: "number" } },
    { prop: "total_tokens", label: "Tokens 消耗", minWidth: 120, align: "right", display: (row) => (row.total_tokens ?? 0) > 0 ? (row.total_tokens ?? 0).toLocaleString() : "-", filter: { type: "number" } },
    { prop: "total_cost", label: "总费用", minWidth: 100, align: "right", display: (row) => fmtCost(row.total_cost), filter: { type: "number" } },
  ])

  const table = useTableFilters<OrgAggregateRow>({
    columns,
    onChange: () => setState("page", 1),
  })

  const [data, { refetch }] = createResource(query, async (input) => {
    try {
      return await queryOrgRows(input)
    } catch (err) {
      showToast({ variant: "error", title: "组织列表加载失败", description: err instanceof Error ? err.message : String(err) })
      return { rows: [], periods: [], series: [] }
    }
  })

  const filtered = createMemo(() => applyClientFilters(data()?.rows ?? [], columns(), table.filters))
  const paged = createMemo(() => filtered().slice((state.page - 1) * state.pageSize, state.page * state.pageSize))
  const periods = createMemo(() => data()?.periods ?? [])
  const series = createMemo(() => data()?.series ?? [])

  const memberOption = createMemo<EChartsOption | undefined>(() => periods().length ? line("成员数", periods(), series().map((item) => ({ name: item.org_name || "-", data: values(item, "user_count") }))) : undefined)
  const countOption = createMemo<EChartsOption | undefined>(() => periods().length ? line("Task / Commit 数", periods(), series().flatMap((item) => ([{ name: `${item.org_name || "-"} / Task`, data: values(item, "task_count") }, { name: `${item.org_name || "-"} / Commit`, data: values(item, "commit_count") }]))) : undefined)
  const codeOption = createMemo<EChartsOption | undefined>(() => periods().length ? line("代码量", periods(), series().flatMap((item) => ([{ name: `${item.org_name || "-"} / Task`, data: values(item, "task_diff_lines") }, { name: `${item.org_name || "-"} / Commit`, data: values(item, "commit_diff_lines") }]))) : undefined)
  const ratioOption = createMemo<EChartsOption | undefined>(() => periods().length ? line("提效比", periods(), series().flatMap((item) => ([{ name: `${item.org_name || "-"} / Task`, data: values(item, "task_efficiency_ratio") }, { name: `${item.org_name || "-"} / Commit`, data: values(item, "commit_efficiency_ratio") }])), (value) => `${value.toFixed(1)}%`) : undefined)
  const tokenOption = createMemo<EChartsOption | undefined>(() => periods().length ? line("Tokens 消耗", periods(), series().map((item) => ({ name: item.org_name || "-", data: values(item, "total_tokens") })), (value) => value.toLocaleString()) : undefined)
  const costOption = createMemo<EChartsOption | undefined>(() => periods().length ? line("总费用", periods(), series().map((item) => ({ name: item.org_name || "-", data: values(item, "total_cost") })), (value) => fmtCost(value)) : undefined)

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-5 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <header>
          <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--native-success)]">Kanban / Org View</p>
          <h1 class="mt-2 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">组织视图</h1>
          <p class="mt-3 max-w-[76ch] text-[0.9375rem] leading-[1.7] text-[var(--native-muted)]">恢复旧版 org view 的组织聚合能力：层级筛选、组织总览表、跨用户/Task/Commit 跳转和时间序列图表。</p>
        </header>

        <FilterBar
          dateRange={state.dateRange}
          orgValue={state.org}
          showOrg
          onDateRangeChange={(value) => {
            setState("dateRange", value ?? defaultWideRange())
            setState("page", 1)
          }}
          onOrgChange={(value) => {
            setState("org", value)
            setState("page", 1)
          }}
          actions={
            <>
              <label class="flex min-w-0 flex-col gap-2">
                <span class="text-[0.75rem] text-[var(--native-muted)]">聚合粒度</span>
                <select class="flex h-9 min-w-[8rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={state.granularity} onChange={(e) => setState("granularity", e.currentTarget.value as Granularity)}>
                  <option value="day">天</option>
                  <option value="week">周</option>
                  <option value="month">月</option>
                  <option value="year">年</option>
                </select>
              </label>
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={data.loading}>{data.loading ? "刷新中..." : "刷新"}</Button>
            </>
          }
        />

        <FilterTable
          columns={columns()}
          rows={paged()}
          rawRows={data()?.rows ?? []}
          controller={table}
          loading={data.loading}
          total={filtered().length}
          page={state.page}
          pageSize={state.pageSize}
          pageSizeOptions={[25, 50, 100, 200]}
          emptyText={data.loading ? "组织列表加载中..." : "当前筛选条件下没有组织数据"}
          onPageChange={(page) => setState("page", page)}
          onPageSizeChange={(pageSize) => {
            setState("pageSize", pageSize)
            setState("page", 1)
          }}
        />

        <section class="grid gap-4 xl:grid-cols-2">
          <ChartCard option={memberOption()} empty="暂无成员数图表数据" />
          <ChartCard option={countOption()} empty="暂无 Task / Commit 数图表数据" />
          <ChartCard option={codeOption()} empty="暂无代码量图表数据" />
          <ChartCard option={ratioOption()} empty="暂无提效比图表数据" />
          <ChartCard option={tokenOption()} empty="暂无 Token 图表数据" />
          <ChartCard option={costOption()} empty="暂无费用图表数据" />
        </section>
      </div>
    </div>
  )
}