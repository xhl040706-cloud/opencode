import { useNavigate, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, on } from "solid-js"
import { createStore } from "solid-js/store"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { Button } from "@/components/ui/button"
import Back from "../components/back"
import { DateRangePicker } from "../components/filters/date-range-picker"
import { FilterTable } from "../components/table/filter-table"
import { useTableFilters } from "../hooks/use-table-filters"
import { queryNeedRows } from "../lib/api"
import { defaultWideRange, normalizeDateRange, parseQueryRange, rangeQuery, searchQuery, sameRange } from "../lib/date-range"
import { applyClientFilters } from "../lib/filter-utils"
import { formatBoundarySource, formatDuration, formatV2Ratio } from "../lib/formatters"
import type { KanbanColumn, NeedRow } from "../lib/types"

function shortNeedId(value?: string | null) {
  if (!value) return "-"
  const txt = String(value)
  return txt.length > 22 ? `${txt.slice(0, 22)}…` : txt
}

function confidenceTone(level?: string) {
  if (level === "high") return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  if (level === "medium") return "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300"
  if (level === "low") return "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300"
  if (level === "very_low") return "border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300"
  return "border-border bg-muted/40 text-muted-foreground"
}

function statusTone(status?: string) {
  if (status === "merged") return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
  if (status === "active") return "border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300"
  return "border-border bg-muted/40 text-muted-foreground"
}

function Tag(props: { text: string; tone: string }) {
  return (
    <span class={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${props.tone}`}>
      {props.text}
    </span>
  )
}

function V2Ratio(props: { value?: number | null }) {
  return (
    <span class="inline-flex min-w-[4rem] items-center justify-center rounded-full border border-border bg-muted/40 px-2 py-1 text-xs font-medium tabular-nums text-[var(--native-foreground)]">
      {formatV2Ratio(props.value)}
    </span>
  )
}

export default function KanbanNeedList() {
  const language = useLanguage()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string; order?: string }>()
  const [state, setState] = createStore({
    page: 1,
    pageSize: 20,
    serverRange: parseQueryRange(search.startDate, search.endDate),
    order: search.order?.trim() || undefined,
    // 服务端筛选开关（后端 /api/v2/needs 支持的 query：includeAll / outlierOnly）
    includeAll: false,
    outlierOnly: false,
  })

  const routeQuery = createMemo(() => {
    const next = rangeQuery(state.serverRange)
    return searchQuery([
      ["startDate", next.startDate],
      ["endDate", next.endDate],
    ]).toString()
  })

  const detailHref = (row: NeedRow) => {
    const id = row.need_id?.trim()
    if (!id) return ""
    const tail = routeQuery()
    return tail
      ? `/kanban/need/${encodeURIComponent(id)}?${tail}`
      : `/kanban/need/${encodeURIComponent(id)}`
  }

  const columns = createMemo<KanbanColumn<NeedRow>[]>(() => [
    {
      prop: "need_id",
      label: language.t("kanban.need.col.needId"),
      minWidth: 240,
      render: (row) => {
        const href = detailHref(row)
        if (!href) return <span>-</span>
        return (
          <button
            type="button"
            class="block max-w-[20rem] truncate text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer"
            title={row.need_id ?? undefined}
            onClick={() => navigate(href)}
          >
            {shortNeedId(row.need_id)}
          </button>
        )
      },
      filter: { type: "text" },
    },
    {
      prop: "efficiency_ratio",
      label: language.t("kanban.need.col.calendarEfficiency"),
      minWidth: 120,
      align: "left",
      sortable: true,
      sortField: "efficiencyRatio",
      render: (row) => <V2Ratio value={row.efficiency_ratio} />,
      filter: {
        type: "number",
        valueGetter: (row) => (row.efficiency_ratio == null ? undefined : row.efficiency_ratio * 100),
        shortcuts: [
          { label: "> 0%", value: { min: 0.01 } },
          { label: "> 50%", value: { min: 50 } },
          { label: "> 100%", value: { min: 100 } },
        ],
      },
    },
    {
      prop: "work_efficiency_ratio",
      label: language.t("kanban.need.col.workEfficiency"),
      minWidth: 120,
      align: "left",
      sortable: true,
      sortField: "workEfficiencyRatio",
      render: (row) => <V2Ratio value={row.work_efficiency_ratio} />,
      filter: {
        type: "number",
        valueGetter: (row) => (row.work_efficiency_ratio == null ? undefined : row.work_efficiency_ratio * 100),
        shortcuts: [
          { label: "> 0%", value: { min: 0.01 } },
          { label: "> 100%", value: { min: 100 } },
          { label: "> 300%", value: { min: 300 } },
        ],
      },
    },
    {
      prop: "status",
      label: language.t("kanban.need.col.status"),
      minWidth: 100,
      render: (row) => (row.status ? <Tag text={row.status} tone={statusTone(row.status)} /> : <span>-</span>),
      filter: { type: "multi-select" },
    },
    {
      prop: "boundary_source",
      label: language.t("kanban.need.col.boundarySource"),
      minWidth: 130,
      showOverflowTooltip: true,
      display: (row) => formatBoundarySource(row.boundary_source, language.t),
      filter: { type: "multi-select" },
    },
    {
      prop: "boundary_confidence",
      label: language.t("kanban.need.col.boundaryConfidence"),
      minWidth: 110,
      render: (row) =>
        row.boundary_confidence ? <Tag text={row.boundary_confidence} tone={confidenceTone(row.boundary_confidence)} /> : <span>-</span>,
      filter: { type: "multi-select" },
    },
    {
      prop: "repo_addr",
      label: language.t("kanban.need.col.repo"),
      minWidth: 220,
      showOverflowTooltip: true,
      filter: { type: "text" },
    },
    {
      prop: "repo_branch",
      label: language.t("kanban.need.col.branch"),
      minWidth: 140,
      showOverflowTooltip: true,
      filter: { type: "multi-select" },
    },
    {
      prop: "total_calendar_min",
      label: language.t("kanban.need.col.actualCalendar"),
      minWidth: 120,
      align: "left",
      sortable: true,
      sortField: "totalCalendarMin",
      display: (row) => formatDuration(row.total_calendar_min, language.t),
    },
    {
      prop: "baseline_calendar_min",
      label: language.t("kanban.need.col.baselineCalendar"),
      minWidth: 120,
      align: "left",
      sortable: true,
      sortField: "baselineCalendarMin",
      display: (row) => formatDuration(row.baseline_calendar_min, language.t),
    },
    {
      prop: "total_think_min",
      label: language.t("kanban.need.col.think"),
      minWidth: 90,
      align: "left",
      display: (row) => formatDuration(row.total_think_min, language.t),
    },
    {
      prop: "total_exec_min",
      label: language.t("kanban.need.col.exec"),
      minWidth: 90,
      align: "left",
      display: (row) => formatDuration(row.total_exec_min, language.t),
    },
    {
      prop: "total_verify_min",
      label: language.t("kanban.need.col.verify"),
      minWidth: 90,
      align: "left",
      display: (row) => formatDuration(row.total_verify_min, language.t),
    },
    {
      prop: "coverage_eligible",
      label: language.t("kanban.need.col.coverage"),
      minWidth: 110,
      render: (row) => {
        if (row.outlier_flag) {
          return <Tag text={language.t("kanban.need.tag.outlier")} tone="border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300" />
        }
        if (row.coverage_eligible) {
          return <Tag text={language.t("kanban.need.tag.eligible")} tone="border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" />
        }
        return <Tag text={language.t("kanban.need.tag.ineligible")} tone="border-border bg-muted/40 text-muted-foreground" />
      },
    },
  ])

  const controller = useTableFilters<NeedRow>({
    columns,
    onChange: () => setState("page", 1),
  })

  createEffect(on(
    () => [search.startDate, search.endDate, search.order],
    () => {
      const next = parseQueryRange(search.startDate, search.endDate)
      if (!sameRange(state.serverRange, next)) setState("serverRange", next)
      const order = search.order?.trim() || undefined
      if (state.order !== order) setState("order", order)
    },
  ))

  createEffect(() => {
    const query = rangeQuery(state.serverRange)
    const mirror = searchQuery([
      ["startDate", query.startDate],
      ["endDate", query.endDate],
      ["order", state.order],
    ])
    const current = searchQuery([
      ["startDate", search.startDate],
      ["endDate", search.endDate],
      ["order", search.order],
    ])
    if (mirror.toString() !== current.toString()) setSearch(Object.fromEntries(mirror.entries()), { replace: true })
  })

  const [needRows, { refetch }] = createResource(
    () => ({
      start: state.serverRange[0],
      end: state.serverRange[1],
      page: state.page,
      pageSize: state.pageSize,
      includeAll: state.includeAll,
      outlierOnly: state.outlierOnly,
    }),
    async (input) => {
      try {
        return await queryNeedRows({
          dateRange: [input.start, input.end],
          page: input.page,
          pageSize: input.pageSize,
          includeAll: input.includeAll,
          outlierOnly: input.outlierOnly,
        })
      } catch (err) {
        showToast({
          variant: "error",
          title: language.t("kanban.need.loadFailed"),
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

  const filteredRows = createMemo(() => applyClientFilters(needRows.latest?.rows ?? [], columns(), controller.filters))

  return (
    <div class="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden p-[clamp(1rem,2vw,2rem)]">
      <header class="flex w-full flex-col gap-3">
        <Back />
        <h1 class="m-0 font-(--native-font-display) text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-(--native-foreground)">{language.t("kanban.need.listTitle")}</h1>
        <p class="m-0 text-sm text-[var(--native-muted)]">{language.t("kanban.need.listSubtitle")}</p>
      </header>

      <div class="flex min-h-0 w-full flex-1 flex-col gap-5">
        <FilterTable
          class="flex min-h-0 min-w-0 flex-1 flex-col rounded-none"
          scrollClass="min-h-0 min-w-0 flex-1 overflow-auto"
          columns={columns()}
          rows={filteredRows()}
          rawRows={needRows.latest?.rows ?? []}
          controller={controller}
          loading={needRows.loading}
          total={needRows.latest?.total ?? 0}
          page={state.page}
          pageSize={state.pageSize}
          pageSizeOptions={[20, 50, 100, 200]}
          order={state.order}
          onOrderChange={(order) => setState("order", order)}
          dateRange={state.serverRange}
          emptyText={needRows.loading ? language.t("kanban.need.loading") : language.t("kanban.need.empty")}
          actions={
            <div class="flex flex-wrap items-center gap-2">
              <DateRangePicker
                value={state.serverRange}
                placeholder={language.t("kanban.form.dateRange")}
                size="sm"
                fullWidth={false}
                onChange={(value) => {
                  setState("serverRange", normalizeDateRange(value) ?? defaultWideRange())
                  setState("page", 1)
                }}
              />
              <label
                class="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[var(--native-muted)]"
                title={language.t("kanban.need.filter.includeAllHint")}
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-[var(--native-primary)]"
                  checked={state.includeAll}
                  onChange={(e) => {
                    setState("includeAll", e.currentTarget.checked)
                    setState("page", 1)
                  }}
                />
                {language.t("kanban.need.filter.includeAll")}
              </label>
              <label class="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[var(--native-muted)]">
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-[var(--native-primary)]"
                  checked={state.outlierOnly}
                  onChange={(e) => {
                    setState("outlierOnly", e.currentTarget.checked)
                    setState("page", 1)
                  }}
                />
                {language.t("kanban.need.filter.outlierOnly")}
              </label>
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={needRows.loading}>
                {needRows.loading ? language.t("kanban.need.refreshing") : language.t("kanban.need.refresh")}
              </Button>
            </div>
          }
          onPageChange={(page) => setState("page", page)}
          onPageSizeChange={(size) => {
            setState("pageSize", size)
            setState("page", 1)
          }}
        />
      </div>
    </div>
  )
}
