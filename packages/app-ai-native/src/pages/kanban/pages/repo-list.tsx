import { A, useNavigate, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { showToast } from "@opencode-ai/ui/toast"
import { Button } from "@/components/ui/button"
import { FilterTable } from "../components/table/filter-table"
import { useTableFilters } from "../hooks/use-table-filters"
import { queryRepoRows } from "../lib/api"
import { defaultWideRange, normalizeDateRange } from "../lib/date-range"
import { applyClientFilters } from "../lib/filter-utils"
import { formatDuration } from "../lib/formatters"
import type { DateRangeValue, KanbanColumn, RepoAggregateRow } from "../lib/types"

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

function ratioTone(value?: number | null) {
  if (value == null) return "border-border bg-muted/40 text-muted-foreground"
  if (value >= 300) return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  if (value >= 150) return "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300"
  return "border-border bg-muted/50 text-muted-foreground"
}

function RatioPill(props: { value?: number | null }) {
  return (
    <span class={`inline-flex min-w-[4.5rem] items-center justify-center rounded-full border px-2 py-1 text-xs font-medium ${ratioTone(props.value)}`}>
      {props.value == null ? "-" : `${props.value.toFixed(1)}%`}
    </span>
  )
}

export default function KanbanRepoList() {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string; mock?: string }>()
  const [state, setState] = createStore({
    page: 1,
    pageSize: 250,
    serverRange: parseQueryRange(search.startDate, search.endDate),
  })

  const routeQuery = createMemo(() => {
    const q = new URLSearchParams()
    const next = rangeQuery(state.serverRange)
    q.set("startDate", next.startDate)
    q.set("endDate", next.endDate)
    if (search.mock?.trim()) q.set("mock", search.mock.trim())
    return q.toString()
  })

  const columns = createMemo<KanbanColumn<RepoAggregateRow>[]>(() => [
    {
      prop: "repo_addr",
      label: "仓库地址",
      minWidth: 300,
      filter: { type: "text" },
    },
    {
      prop: "repo_branch",
      label: "分支",
      minWidth: 120,
      filter: { type: "multi-select" },
    },
    {
      prop: "commit_count",
      label: "Commit数",
      minWidth: 110,
      align: "right",
      filter: { type: "number" },
    },
    {
      prop: "task_count",
      label: "Task数",
      minWidth: 110,
      align: "right",
      filter: { type: "number" },
    },
    {
      prop: "sum_ancient_minutes",
      label: "传统开发时长预估",
      minWidth: 150,
      align: "right",
      display: (row) => formatDuration(row.sum_ancient_minutes),
      filter: { type: "number" },
    },
    {
      prop: "sum_real_minutes",
      label: "实际耗时",
      minWidth: 130,
      align: "right",
      display: (row) => formatDuration(row.sum_real_minutes),
      filter: { type: "number" },
    },
    {
      prop: "efficiency_ratio",
      label: "提效比",
      minWidth: 110,
      align: "center",
      render: (row) => <RatioPill value={row.efficiency_ratio} />,
      filter: {
        type: "number",
        shortcuts: [
          { label: "> 100%", value: { min: 100 } },
          { label: "> 200%", value: { min: 200 } },
          { label: "> 300%", value: { min: 300 } },
        ],
      },
    },
    {
      prop: "start_time",
      label: "开始时间",
      minWidth: 150,
      filter: { type: "date", serverSide: true },
    },
  ])

  const controller = useTableFilters<RepoAggregateRow>({
    columns,
    onChange: () => setState("page", 1),
  })

  let seeded = false

  createEffect(() => {
    if (seeded) return
    seeded = true
    controller.setFilter("start_time", state.serverRange)
  })

  createEffect(() => {
    const next = normalizeDateRange(controller.filters.start_time as DateRangeValue)
    if (!next) {
      if (search.startDate || search.endDate) {
        const mock = search.mock?.trim()
        setSearch(mock ? { mock } : {})
      }
      return
    }

    const query = rangeQuery(next)
    if (!sameRange(state.serverRange, next)) {
      setState("serverRange", next)
      setState("page", 1)
    }
    if (search.startDate !== query.startDate || search.endDate !== query.endDate) {
      const mock = search.mock?.trim()
      setSearch(mock ? { ...query, mock } : query)
    }
  })

  const [repoRows, { refetch }] = createResource(
    () => ({
      start: state.serverRange[0],
      end: state.serverRange[1],
      page: state.page,
      pageSize: state.pageSize,
    }),
    async (input) => {
      try {
        return await queryRepoRows({
          dateRange: [input.start, input.end],
          page: input.page,
          pageSize: input.pageSize,
        })
      } catch (err) {
        showToast({
          variant: "error",
          title: "仓库列表加载失败",
          description: err instanceof Error ? err.message : String(err),
        })
        return {
          rows: [],
          total: 0,
          page: input.page,
          pageSize: input.pageSize,
        }
      }
    },
  )

  const filteredRows = createMemo(() => applyClientFilters(repoRows()?.rows ?? [], columns(), controller.filters))

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <header class="flex w-full flex-col gap-3">
        <A href="/kanban" class="inline-flex items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)]">
          <span>&lt;</span>
          <span>返回看板</span>
        </A>
        <h1 class="m-0 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">仓库视图</h1>
      </header>

      <div class="flex w-full flex-col gap-5">
        <FilterTable
          class="rounded-none"
          columns={columns()}
          rows={filteredRows()}
          rawRows={repoRows()?.rows ?? []}
          controller={controller}
          loading={repoRows.loading}
          total={repoRows()?.total ?? 0}
          page={state.page}
          pageSize={state.pageSize}
          pageSizeOptions={[250, 500, 1000]}
          dateRange={state.serverRange}
          emptyText={repoRows.loading ? "仓库聚合加载中..." : "当前时间范围内没有仓库数据"}
          actions={
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={repoRows.loading}>
              {repoRows.loading ? "刷新中..." : "刷新"}
            </Button>
          }
          onPageChange={(page) => setState("page", page)}
          onPageSizeChange={(size) => {
            setState("pageSize", size)
            setState("page", 1)
          }}
          onRowClick={(row) => {
            const repoAddr = row.repo_addr?.trim()
            if (!repoAddr) return
            const repoBranch = row.repo_branch?.trim()
            const tail = routeQuery()
            navigate(repoBranch
              ? `/kanban/repo/${encodeURIComponent(repoAddr)}/${encodeURIComponent(repoBranch)}?${tail}`
              : `/kanban/repo/${encodeURIComponent(repoAddr)}?${tail}`)
          }}
        />
      </div>
    </div>
  )
}