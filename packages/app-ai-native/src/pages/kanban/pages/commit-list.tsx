import { A, useNavigate, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { showToast } from "@opencode-ai/ui/toast"
import { Button } from "@/components/ui/button"
import { FilterBar } from "../components/filters/filter-bar"
import { FilterTable } from "../components/table/filter-table"
import { useTableFilters } from "../hooks/use-table-filters"
import { queryCommitRows } from "../lib/api"
import { defaultWideRange } from "../lib/date-range"
import { applyClientFilters } from "../lib/filter-utils"
import { formatDuration, formatLocalTime, shortId } from "../lib/formatters"
import type { CommitRow, KanbanColumn, OrgCascadeValue } from "../lib/types"

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

export default function KanbanCommitList() {
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string; userName?: string; org1?: string; org2?: string; org3?: string; org4?: string; mock?: string }>()
  const [state, setState] = createStore({
    page: 1,
    pageSize: 250,
    dateRange: parseQueryRange(search.startDate, search.endDate),
    org: parseOrg(search),
  })

  createEffect(() => {
    const next = parseQueryRange(search.startDate, search.endDate)
    if (state.dateRange[0] !== next[0] || state.dateRange[1] !== next[1]) setState("dateRange", next)
    const org = parseOrg(search)
    if (!sameOrg(state.org, org)) setState("org", org)
  })

  createEffect(() => {
    const query = new URLSearchParams()
    const next = rangeQuery(state.dateRange)
    query.set("startDate", next.startDate)
    query.set("endDate", next.endDate)
    if (search.userName?.trim()) query.set("userName", search.userName.trim())
    if (state.org.org1) query.set("org1", state.org.org1)
    if (state.org.org2) query.set("org2", state.org.org2)
    if (state.org.org3) query.set("org3", state.org.org3)
    if (state.org.org4) query.set("org4", state.org.org4)
    if (search.mock?.trim()) query.set("mock", search.mock.trim())

    const current = new URLSearchParams(search as Record<string, string>)
    if (query.toString() !== current.toString()) setSearch(Object.fromEntries(query.entries()))
  })

  const columns = createMemo<KanbanColumn<CommitRow>[]>(() => [
    {
      prop: "commit_id",
      label: "Commit ID",
      minWidth: 110,
      render: (row) => {
        const id = row.commit_id?.trim()
        return id ? <button type="button" class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => navigate(`/kanban/commit/${encodeURIComponent(id)}?${new URLSearchParams(search as Record<string, string>).toString()}`)}>{shortId(id, 8)}</button> : <span>-</span>
      },
    },
    { prop: "commit_time", label: "时间", minWidth: 170, display: (row) => formatLocalTime(row.commit_time), filter: { type: "date" } },
    {
      prop: "org_display",
      label: "组织",
      minWidth: 180,
      render: (row) => row.org_display?.trim()
        ? <button type="button" class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => {
            const path = [row.org1, row.org2, row.org3, row.org4].filter(Boolean).join("/")
            if (!path) return
            navigate(`/kanban/org/${encodeURIComponent(path)}?${new URLSearchParams(search as Record<string, string>).toString()}`)
          }}>{row.org_display}</button>
        : <span>-</span>,
    },
    {
      prop: "user_name",
      label: "用户",
      minWidth: 110,
      render: (row) => <button type="button" class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => {
        const txt = row.user_id?.trim()
        if (!txt) return
        navigate(`/kanban/user/${encodeURIComponent(txt)}?${new URLSearchParams(search as Record<string, string>).toString()}`)
      }}>{row.user_name || row.user_id || "-"}</button>,
      filter: { type: "multi-select" },
    },
    { prop: "comment", label: "说明", minWidth: 220, filter: { type: "text" } },
    { prop: "repo_addr", label: "仓库", minWidth: 240, render: (row) => <div dir="rtl" class="truncate text-left">{row.repo_addr ? `${row.repo_addr}/${row.repo_branch || "-"}` : "-"}</div>, filter: { type: "multi-select" } },
    { prop: "diff_lines", label: "代码量", minWidth: 90, align: "right", filter: { type: "number" } },
    { prop: "commit_real_minutes", label: "实际耗时", minWidth: 110, align: "right", display: (row) => formatDuration(row.commit_real_minutes_manual ?? row.commit_real_minutes), filter: { type: "number", valueGetter: (row) => row.commit_real_minutes_manual ?? row.commit_real_minutes } },
    { prop: "commit_ancient_minutes", label: "传统开发时长预估", minWidth: 160, align: "right", display: (row) => formatDuration(row.commit_ancient_minutes_manual ?? row.commit_ancient_minutes), filter: { type: "number", valueGetter: (row) => row.commit_ancient_minutes_manual ?? row.commit_ancient_minutes } },
    { prop: "efficiency_ratio", label: "提效比", minWidth: 100, align: "right", display: (row) => row.efficiency_ratio == null ? "-" : `${row.efficiency_ratio.toFixed(1)}%`, filter: { type: "number" } },
    { prop: "_tokens", label: "Tokens消耗", minWidth: 120, align: "right", display: (row) => ((row.upstream_tokens ?? 0) + (row.downstream_tokens ?? 0)) > 0 ? ((row.upstream_tokens ?? 0) + (row.downstream_tokens ?? 0)).toLocaleString() : "-", filter: { type: "number", valueGetter: (row) => (row.upstream_tokens ?? 0) + (row.downstream_tokens ?? 0) } },
    { prop: "cost", label: "费用", minWidth: 100, align: "right", display: (row) => fmtCost(row.cost), filter: { type: "number" } },
  ])

  const table = useTableFilters<CommitRow>({
    columns,
    onChange: () => setState("page", 1),
  })

  createEffect(() => {
    table.setFilter("user_name", search.userName?.trim() || undefined)
  })

  const [data, { refetch }] = createResource(
    () => ({ dateRange: state.dateRange, org: state.org, page: state.page, pageSize: state.pageSize }),
    async (input) => {
      try {
        return await queryCommitRows(input)
      } catch (err) {
        showToast({ variant: "error", title: "提交列表加载失败", description: err instanceof Error ? err.message : String(err) })
        return { rows: [], total: 0, page: input.page, pageSize: input.pageSize }
      }
    },
  )

  const rows = createMemo(() => applyClientFilters(data()?.rows ?? [], columns(), table.filters))

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <A href="/kanban/user" class="inline-flex items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)]"><span>←</span><span>返回用户视图</span></A>
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
          actions={<Button variant="outline" size="sm" onClick={() => void refetch()} disabled={data.loading}>{data.loading ? "刷新中..." : "刷新"}</Button>}
        />

        <FilterTable
          columns={columns()}
          rows={rows()}
          rawRows={data()?.rows ?? []}
          controller={table}
          loading={data.loading}
          total={data()?.total ?? 0}
          page={state.page}
          pageSize={state.pageSize}
          pageSizeOptions={[100, 250, 500]}
          emptyText={data.loading ? "提交加载中..." : "当前时间范围内没有提交数据"}
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