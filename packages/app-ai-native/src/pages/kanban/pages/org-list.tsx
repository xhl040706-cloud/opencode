import { useNavigate, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, on, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { Button } from "@/components/ui/button"
import Back from "../components/back"
import { FilterBar } from "../components/filters/filter-bar"
import { FilterTable, sortRows } from "../components/table/filter-table"
import { useTableFilters } from "../hooks/use-table-filters"
import { queryOrgRows } from "../lib/api"
import { defaultWideRange, normalizeDateRange, parseQueryRange, rangeQuery, readQueryRange, searchQuery, sameRange } from "../lib/date-range"
import { applyClientFilters } from "../lib/filter-utils"
import { formatDuration, formatV2Ratio } from "../lib/formatters"
import type { KanbanColumn, OrgAggregateQuery, OrgAggregateRow, OrgCascadeValue } from "../lib/types"

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

function queryOf(range: [string, string], org: OrgCascadeValue, order?: string) {
  const dates = rangeQuery(range)
  return searchQuery([
    ["startDate", dates.startDate],
    ["endDate", dates.endDate],
    ["org1", org.org1],
    ["org2", org.org2],
    ["org3", org.org3],
    ["org4", org.org4],
    ["order", order],
  ]).toString()
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

export default function KanbanOrgList() {
  const language = useLanguage()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string; org1?: string; org2?: string; org3?: string; org4?: string; order?: string }>()
  const [state, setState] = createStore({
    page: 1,
    pageSize: 50,
    dateRange: parseQueryRange(search.startDate, search.endDate),
    org: parseOrg(search),
    order: search.order?.trim() || undefined,
  })

  createEffect(on(
    () => [search.startDate, search.endDate, search.org1, search.org2, search.org3, search.org4, search.order],
    () => {
      const next = readQueryRange(search.startDate, search.endDate)
      if (next && !sameRange(untrack(() => state.dateRange), next)) setState("dateRange", next)

      const org = parseOrg(search)
      if (!sameOrg(untrack(() => state.org), org)) setState("org", org)

      const order = search.order?.trim() || undefined
      if (untrack(() => state.order) !== order) setState("order", order)
    },
  ))

  createEffect(() => {
    const next = normalizeDateRange(state.dateRange)
    if (!next) return

    const mirror = queryOf(next, state.org, state.order)
    const current = searchQuery([
      ["startDate", search.startDate],
      ["endDate", search.endDate],
      ["org1", search.org1],
      ["org2", search.org2],
      ["org3", search.org3],
      ["org4", search.org4],
      ["order", search.order],
    ]).toString()
    if (mirror !== current) setSearch(Object.fromEntries(new URLSearchParams(mirror).entries()), { replace: true })
  })

  const query = createMemo<OrgAggregateQuery>(() => ({
    dateRange: state.dateRange,
    org: { org1: state.org.org1, org2: state.org.org2, org3: state.org.org3, org4: state.org.org4 },
    order: state.order,
  }))

  const routeQuery = (org: OrgCascadeValue) => queryOf(state.dateRange, org, state.order)

  const columns = createMemo<KanbanColumn<OrgAggregateRow>[]>(() => [
    {
      prop: "org_name",
      label: language.t("kanban.table.org"),
      minWidth: 160,
      render: (row) => {
        const txt = row.org_name?.trim()
        const scope = nextOrg(state.org, txt)
        const path = orgPath(scope)
        if (!txt) return <span>-</span>
        return path ? (
          <button type="button" class="block max-w-[18rem] truncate text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer" title={txt} onClick={() => navigate(`/kanban/org/${encodeURIComponent(path)}?${routeQuery(scope)}`)}>
            {txt}
          </button>
        ) : <span class="block max-w-[18rem] truncate" title={txt}>{txt}</span>
      },
      filter: { type: "text" },
    },
    {
      prop: "user_count",
      label: language.t("kanban.metric.memberCount"),
      minWidth: 90,
      align: "left",
      sortable: true,
      sortField: "userCount",
      render: (row) => {
        const scope = nextOrg(state.org, row.org_name)
        return (row.user_count ?? 0) > 0 ? (
          <button type="button" class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer" onClick={() => navigate(`/kanban/user?${routeQuery(scope)}`)}>
            {row.user_count}
          </button>
        ) : <span>0</span>
      },
      filter: { type: "number", shortcuts: [{ label: "> 0", value: { min: 1 } }, { label: "> 50", value: { min: 50 } }, { label: "> 100", value: { min: 100 } }] },
    },
    {
      prop: "merged_need_count",
      label: language.t("kanban.user.col.mergedNeeds"),
      minWidth: 100,
      align: "left",
      sortable: true,
      sortField: "mergedNeedCount",
      filter: { type: "number", shortcuts: [{ label: "> 0", value: { min: 1 } }, { label: "> 10", value: { min: 10 } }, { label: "> 50", value: { min: 50 } }] },
    },
    {
      prop: "actual_calendar_min",
      label: language.t("kanban.user.col.actualCalendar"),
      minWidth: 110,
      align: "left",
      sortable: true,
      sortField: "actualCalendarMin",
      display: (row) => formatDuration(row.actual_calendar_min, language.t),
    },
    {
      prop: "baseline_calendar_min",
      label: language.t("kanban.user.col.baselineCalendar"),
      minWidth: 110,
      align: "left",
      sortable: true,
      sortField: "baselineCalendarMin",
      display: (row) => formatDuration(row.baseline_calendar_min, language.t),
    },
    {
      prop: "calendar_ratio",
      label: language.t("kanban.user.col.calendarEfficiency"),
      minWidth: 110,
      align: "left",
      sortable: true,
      sortField: "calendarRatio",
      render: (row) => <V2Ratio value={row.calendar_ratio} />,
      filter: { type: "number", valueGetter: (row) => (row.calendar_ratio == null ? undefined : row.calendar_ratio * 100), shortcuts: [{ label: "> 0%", value: { min: 0.01 } }, { label: "> 50%", value: { min: 50 } }, { label: "> 100%", value: { min: 100 } }] },
    },
    {
      prop: "work_ratio",
      label: language.t("kanban.user.col.workEfficiency"),
      minWidth: 110,
      align: "left",
      sortable: true,
      sortField: "workRatio",
      render: (row) => <V2Ratio value={row.work_ratio} />,
      filter: { type: "number", valueGetter: (row) => (row.work_ratio == null ? undefined : row.work_ratio * 100), shortcuts: [{ label: "> 0%", value: { min: 0.01 } }, { label: "> 100%", value: { min: 100 } }, { label: "> 300%", value: { min: 300 } }] },
    },
    {
      prop: "commit_count",
      label: language.t("kanban.table.commitCount"),
      minWidth: 90,
      align: "left",
      sortable: true,
      sortField: "commitCount",
      render: (row) => {
        const scope = nextOrg(state.org, row.org_name)
        return (row.commit_count ?? 0) > 0 ? (
          <button type="button" class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer" onClick={() => navigate(`/kanban/commit?${routeQuery(scope)}`)}>
            {row.commit_count}
          </button>
        ) : <span>0</span>
      },
      filter: { type: "number", shortcuts: [{ label: "> 0", value: { min: 1 } }, { label: "> 50", value: { min: 50 } }, { label: "> 100", value: { min: 100 } }] },
    },
    { prop: "commit_diff_lines", label: language.t("kanban.table.commitCodeLines"), minWidth: 110, align: "left", sortable: true, sortField: "commitDiffLines", filter: { type: "number", shortcuts: [{ label: "> 0", value: { min: 1 } }, { label: "> 50", value: { min: 50 } }, { label: "> 200", value: { min: 200 } }] } },
    { prop: "cost", label: language.t("kanban.metric.totalCost"), minWidth: 100, align: "left", sortable: true, sortField: "cost", display: (row) => fmtCost(row.cost), filter: { type: "number", shortcuts: [{ label: "> 0", value: { min: 0.001 } }, { label: "> 0.01", value: { min: 0.01 } }, { label: "> 0.1", value: { min: 0.1 } }] } },
  ])

  const table = useTableFilters<OrgAggregateRow>({
    columns,
    onChange: () => setState("page", 1),
  })

  const [data, { refetch }] = createResource(query, async (input) => {
    try {
      return await queryOrgRows(input)
    } catch (err) {
      showToast({ variant: "error", title: language.t("kanban.toast.loadFailed"), description: err instanceof Error ? err.message : String(err) })
      return { rows: [] }
    }
  })

  const filtered = createMemo(() => applyClientFilters(data.latest?.rows ?? [], columns(), table.filters))
  // 客户端分页：排序作用于全量过滤集，再切片（否则只排当前页）。
  const sorted = createMemo(() => sortRows(filtered(), columns(), state.order))
  const paged = createMemo(() => sorted().slice((state.page - 1) * state.pageSize, state.page * state.pageSize))

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-5 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <div class="flex w-full flex-col gap-5">
        <header class="flex w-full flex-col gap-3">
          <Back />
          <h1 class="m-0 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">{language.t("kanban.view.org")}</h1>
          <p class="m-0 text-sm text-[var(--native-muted)]">{language.t("kanban.org.listSubtitle")}</p>
        </header>

        <FilterBar
          dateRange={state.dateRange}
          orgValue={state.org}
          dateSlot="actions"
          dateLabel={false}
          showOrg
          onDateRangeChange={(value) => {
            setState("dateRange", value ?? defaultWideRange())
            setState("page", 1)
          }}
          onOrgChange={(value) => {
            setState("org", { org1: value.org1, org2: value.org2, org3: value.org3, org4: value.org4 })
            setState("page", 1)
          }}
          actions={
            <div class="flex items-end">
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={data.loading}>
                {data.loading ? language.t("kanban.action.refreshing") : language.t("kanban.action.refresh")}
              </Button>
            </div>
          }
        />

        <FilterTable
          class="min-w-0 rounded-none"
          scrollClass="max-h-[calc(100vh-22rem)] min-h-0 min-w-0 overflow-auto"
          columns={columns()}
          rows={paged()}
          rawRows={data.latest?.rows ?? []}
          controller={table}
          loading={data.loading}
          total={filtered().length}
          page={state.page}
          pageSize={state.pageSize}
          pageSizeOptions={[25, 50, 100, 200]}
          order={state.order}
          onOrderChange={(order) => setState("order", order)}
          emptyText={data.loading ? language.t("kanban.loading.orgList") : language.t("kanban.empty.noOrgData")}
          onPageChange={(page) => setState("page", page)}
          onPageSizeChange={(pageSize) => {
            setState("pageSize", pageSize)
            setState("page", 1)
          }}
        />
      </div>
    </div>
  )
}
