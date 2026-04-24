import { useNavigate, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, createSignal, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { Modal } from "@/components/modal"
import { Button } from "@/components/ui/button"
import Back from "../components/back"
import { ChartCard } from "../components/charts/chart-card"
import { DateRangePicker } from "../components/filters/date-range-picker"
import { FilterTable } from "../components/table/filter-table"
import { useTableFilters } from "../hooks/use-table-filters"
import { createProjectOptionV2, deleteProject, getProjects } from "../lib/api"
import { applyClientFilters } from "../lib/filter-utils"
import { formatDuration, formatLocalTime, formatPercent } from "../lib/formatters"
import type { KanbanColumn, ProjectRow } from "../lib/types"

function fmtCost(value?: number | null) {
  if (value == null || value === 0) return "-"
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

type EnrichedProjectRow = ProjectRow & {
  _ongoing: boolean
  _end_time_fmt: string
}

function enrichData(list: ProjectRow[]): EnrichedProjectRow[] {
  return list.map((item) => {
    const endTime = item.end_time_manual ?? item.end_time
    const ongoing = !endTime
    return {
      ...item,
      _ongoing: ongoing,
      _end_time_fmt: ongoing ? "" : formatLocalTime(endTime),
    }
  })
}

function makeBarOption(title: string, categories: string[], seriesList: { name: string; data: (number | null)[] }[]) {
  return {
    title: { text: title, left: "center" as const, top: 10, textStyle: { fontSize: 13, fontWeight: "bold" as const } },
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    legend: { data: seriesList.map((s) => s.name), top: 42, type: "scroll" as const },
    grid: { left: "5%", right: "5%", top: 92, bottom: 56, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: categories,
      axisLabel: { rotate: 0, margin: 12, fontSize: 11, overflow: "truncate" as const, width: 96, hideOverlap: true },
    },
    yAxis: { type: "value" as const },
    series: seriesList.map((s) => ({
      name: s.name,
      type: "bar" as const,
      data: s.data,
    })),
  }
}

function makeBarOptionPct(title: string, categories: string[], seriesList: { name: string; data: (number | null)[] }[]) {
  return {
    ...makeBarOption(title, categories, seriesList),
    tooltip: {
      trigger: "axis" as const,
      axisPointer: { type: "shadow" as const },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter(params: any) {
        const items = Array.isArray(params) ? params : [params]
        let str = (items[0]?.axisValue ?? "") + "<br/>"
        for (const p of items) {
          str += (p.marker ?? "") + (p.seriesName ?? "") + ": " + formatPercent(p.value ?? 0) + "<br/>"
        }
        return str
      },
    },
    yAxis: { type: "value" as const, axisLabel: { formatter: "{value}%" } },
  }
}

function toDay(m: number | null | undefined) {
  return m != null ? Math.round((m / 480) * 10) / 10 : null
}

function CreateProjectDialog(props: { onCreated: () => void }) {
  const dialog = useDialog()
  const [form, setForm] = createStore({ name: "", description: "" })
  const [busy, setBusy] = createSignal(false)

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast({ variant: "error", title: "请输入项目名称" })
      return
    }
    setBusy(true)
    try {
      await createProjectOptionV2({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      })
      showToast({ variant: "success", title: "创建成功" })
      dialog.close()
      props.onCreated()
    } catch (e) {
      showToast({ variant: "error", title: "创建失败", description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="创建项目"
      maxWidth="560px"
      footer={
        <>
          <Button variant="outline" size="sm" type="button" onClick={() => dialog.close()}>取消</Button>
          <Button size="sm" type="button" onClick={() => void handleCreate()} disabled={busy()}>{busy() ? "创建中..." : "创建"}</Button>
        </>
      }
    >
      <div class="modal-section">
        <div class="flex flex-col gap-3">
          <div>
            <label class="mb-1 block text-sm text-[var(--native-muted)]">项目名称</label>
            <input
              type="text"
              class="w-full rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_36%,transparent)] bg-[var(--native-panel)] px-3 py-2 text-sm text-[var(--native-foreground)] outline-none transition-colors focus:border-[var(--native-primary)]"
              placeholder="输入项目名称"
              value={form.name}
              onInput={(e) => setForm("name", e.currentTarget.value)}
              autofocus
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-[var(--native-muted)]">描述</label>
            <textarea
              class="w-full rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_36%,transparent)] bg-[var(--native-panel)] px-3 py-2 text-sm text-[var(--native-foreground)] outline-none transition-colors focus:border-[var(--native-primary)]"
              rows={3}
              placeholder="输入项目描述（可选）"
              value={form.description}
              onInput={(e) => setForm("description", e.currentTarget.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function KanbanProjectList() {
  const navigate = useNavigate()
  const dialog = useDialog()
  const [search, setSearch] = useSearchParams<{
    name?: string
    ongoing?: string
    dateFrom?: string
    dateTo?: string
    startFrom?: string
    startTo?: string
  }>()

  const [state, setState] = createStore({
    filterName: "",
    filterRange: null as [string, string] | null,
    filterOngoing: false,
  })

  function parseDateStr(s?: string | null) {
    if (!s || s.length < 8) return ""
    return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8)
  }

  function syncUrlToControls() {
    setState({
      filterName: search.name ? String(search.name).trim() : "",
      filterOngoing: search.ongoing === "1",
      filterRange: search.dateFrom && search.dateTo
        ? [parseDateStr(search.dateFrom), parseDateStr(search.dateTo)] as [string, string]
        : search.startFrom && search.startTo
          ? [parseDateStr(search.startFrom), parseDateStr(search.startTo)] as [string, string]
        : null,
    })
  }

  function updateUrl() {
    const query: Record<string, string> = {}
    if (state.filterName) query.name = state.filterName
    if (state.filterOngoing) query.ongoing = "1"
    if (state.filterRange) {
      query.dateFrom = state.filterRange[0].replace(/-/g, "")
      query.dateTo = state.filterRange[1].replace(/-/g, "")
    }
    setSearch(query, { replace: true })
  }

  const columns = createMemo<KanbanColumn<EnrichedProjectRow>[]>(() => [
    { prop: "name", label: "项目名称", minWidth: 200, filter: { type: "text" }, render: (row) => <button type="button" class="text-left font-semibold text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={(e) => { e.stopPropagation(); if (row.project_id) navigate(`/kanban/project/${encodeURIComponent(row.project_id)}`) }}>{row.name || "-"}</button> },
    {
      prop: "start_time",
      label: "开始时间",
      minWidth: 150,
      display: (row) => formatLocalTime(row.start_time_manual ?? row.start_time),
    },
    {
      prop: "end_time_display",
      label: "结束时间",
      minWidth: 150,
      render: (row) =>
        row._ongoing
          ? <span class="font-medium text-[var(--native-success)]">尚未结束</span>
          : <span>{row._end_time_fmt}</span>,
    },
    { prop: "user_count", label: "人数", minWidth: 80, align: "right", filter: { type: "number" } },
    { prop: "repo_count", label: "Repo数", minWidth: 90, align: "right", filter: { type: "number" } },
    { prop: "task_count", label: "Task数", minWidth: 90, align: "right", filter: { type: "number" } },
    {
      prop: "total_code_lines",
      label: "生成代码量",
      minWidth: 110,
      align: "right",
      display: (row) => row.total_code_lines && row.total_code_lines > 0 ? row.total_code_lines.toLocaleString() + " 行" : "-",
    },
    {
      prop: "actual_lines_per_day",
      label: "实际人天代码量",
      minWidth: 130,
      align: "right",
      display: (row) => row.actual_lines_per_day != null ? Math.round(row.actual_lines_per_day).toLocaleString() + " 行/人天" : "-",
    },
    {
      prop: "cost",
      label: "费用",
      minWidth: 100,
      align: "right",
      display: (row) => fmtCost(row.cost),
    },
    {
      prop: "project_real_lead_minutes",
      label: "项目周期",
      minWidth: 120,
      align: "right",
      display: (row) => formatDuration(row.project_real_lead_minutes_manual ?? row.project_real_lead_minutes),
    },
    {
      prop: "project_ancient_minutes",
      label: "传统开发预估",
      minWidth: 130,
      align: "right",
      display: (row) => formatDuration(row.project_ancient_minutes_manual ?? row.project_ancient_minutes),
    },
    {
      prop: "project_real_process_minutes",
      label: "实际耗时",
      minWidth: 120,
      align: "right",
      display: (row) => formatDuration(row.project_real_process_minutes_manual ?? row.project_real_process_minutes),
    },
    {
      prop: "efficiency_ratio",
      label: "提效比",
      minWidth: 110,
      align: "center",
      render: (row) =>
        row.efficiency_ratio != null
          ? (
            <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              row.efficiency_ratio >= 300
                ? "bg-[color:color-mix(in_oklab,var(--native-success)_16%,transparent)] text-[var(--native-success)]"
                : row.efficiency_ratio >= 150
                  ? "bg-[color:color-mix(in_oklab,var(--native-primary)_16%,transparent)] text-[var(--native-primary)]"
                  : "bg-[color:color-mix(in_oklab,var(--native-dim)_16%,transparent)] text-[var(--native-muted)]"
            }`}>
              {formatPercent(row.efficiency_ratio)}
            </span>
          )
          : <span class="text-[var(--native-muted)]">-</span>,
    },
    {
      prop: "_actions",
      label: "操作",
      width: 80,
      align: "center",
      render: (row) => (
        <button
          type="button"
          class="text-sm text-[var(--native-critical,#b24b3b)] transition-colors hover:text-[var(--native-foreground)]"
          onClick={(e) => {
            e.stopPropagation()
            void handleDelete(row)
          }}
        >
          删除
        </button>
      ),
    },
  ])

  const table = useTableFilters<EnrichedProjectRow>({
    columns,
    onChange: () => {},
  })

  const [data, { refetch }] = createResource(async () => {
    try {
      const result = await getProjects()
      return enrichData(result)
    } catch {
      return [] as EnrichedProjectRow[]
    }
  })

  const filteredData = createMemo(() => {
    let rows = data() ?? []

    const name = state.filterName.trim().toLowerCase()
    if (name) rows = rows.filter((r) => (r.name || "").toLowerCase().includes(name))

    if (state.filterOngoing) rows = rows.filter((r) => r._ongoing)

    if (state.filterRange) {
      const [from, to] = state.filterRange
      rows = rows.filter((r) => {
        const st = r.start_time_manual ?? r.start_time
        if (!st) return false
        const et = r.end_time_manual ?? r.end_time
        const start = st.slice(0, 10)
        const end = et ? et.slice(0, 10) : "9999-12-31"
        return start <= to && end >= from
      })
    }

    return applyClientFilters(rows, columns(), table.filters)
  })

  const chartEffOption = createMemo(() => {
    const d = filteredData()
    if (!d.length) return undefined
    return makeBarOptionPct("提效比（按项目）", d.map((r) => r.name || "-"), [
      { name: "提效比", data: d.map((r) => r.efficiency_ratio ?? null) },
    ])
  })

  const chartCodeOption = createMemo(() => {
    const d = filteredData()
    if (!d.length) return undefined
    return makeBarOption("代码量（按项目）", d.map((r) => r.name || "-"), [
      { name: "生成代码量（行）", data: d.map((r) => r.total_code_lines || 0) },
      { name: "实际人天代码量（行/人天）", data: d.map((r) => r.actual_lines_per_day != null ? Math.round(r.actual_lines_per_day) : null) },
    ])
  })

  const chartTimeOption = createMemo(() => {
    const d = filteredData()
    if (!d.length) return undefined
    const names = d.map((r) => r.name || "-")
    return {
      ...makeBarOption("时间对比（人天，按项目）", names, [
        { name: "传统开发预估", data: d.map((r) => toDay(r.project_ancient_minutes_manual ?? r.project_ancient_minutes)) },
        { name: "实际耗时", data: d.map((r) => toDay(r.project_real_process_minutes_manual ?? r.project_real_process_minutes)) },
        { name: "项目周期", data: d.map((r) => toDay(r.project_real_lead_minutes_manual ?? r.project_real_lead_minutes)) },
      ]),
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        formatter(params: any) {
          const items = Array.isArray(params) ? params : [params]
          let str = (items[0]?.axisValue ?? "") + "<br/>"
          for (const p of items) {
            str += (p.marker ?? "") + (p.seriesName ?? "") + ": " + (p.value ?? "-") + " 人天<br/>"
          }
          return str
        },
      },
    }
  })

  const chartPeopleOption = createMemo(() => {
    const d = filteredData()
    if (!d.length) return undefined
    return makeBarOption("人员与规模（按项目）", d.map((r) => r.name || "-"), [
      { name: "人数", data: d.map((r) => r.user_count || 0) },
      { name: "Task数", data: d.map((r) => r.task_count || 0) },
      { name: "Repo数", data: d.map((r) => r.repo_count || 0) },
    ])
  })

  const chartCostOption = createMemo(() => {
    const d = filteredData()
    if (!d.length) return undefined
    return {
      ...makeBarOption("费用（按项目）", d.map((r) => r.name || "-"), [
        { name: "费用（元）", data: d.map((r) => r.cost || 0) },
      ]),
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        formatter(params: any) {
          const items = Array.isArray(params) ? params : [params]
          let str = (items[0]?.axisValue ?? "") + "<br/>"
          for (const p of items) {
            str += (p.marker ?? "") + (p.seriesName ?? "") + ": " + Number(p.value || 0).toFixed(2) + " 元<br/>"
          }
          return str
        },
      },
    }
  })

  async function handleDelete(row: EnrichedProjectRow) {
    if (!row.project_id) return
    if (!confirm(`确定要删除项目「${row.name}」吗？`)) return
    try {
      await deleteProject(row.project_id)
      showToast({ variant: "success", title: "删除成功" })
      await refetch()
    } catch (e) {
      showToast({ variant: "error", title: "删除失败", description: e instanceof Error ? e.message : String(e) })
    }
  }

  createEffect(() => {
    syncUrlToControls()
  })

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <div class="flex w-full flex-col gap-5">
        <header class="flex w-full flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div class="flex flex-col gap-3">
            <Back href="/kanban" label="返回首页" />
            <div>
              <h1 class="m-0 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">项目视图</h1>
            </div>
          </div>

          <div class="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <input
              type="text"
              class="h-10 min-w-[12rem] rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_36%,transparent)] bg-[var(--native-panel)] px-3 py-2 text-sm text-[var(--native-foreground)] outline-none transition-colors focus:border-[var(--native-primary)]"
              placeholder="项目名称"
              value={state.filterName}
              onInput={(e) => {
                setState("filterName", e.currentTarget.value)
                updateUrl()
              }}
            />

            <DateRangePicker
              value={state.filterRange}
              placeholder="项目时间范围"
              clearable
              size="sm"
              fullWidth={false}
              onChange={(value) => {
                setState("filterRange", value ?? null)
                updateUrl()
              }}
            />

            <label class="flex h-10 items-center gap-2 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_90%,var(--native-bg-subtle))] px-3 text-sm text-[var(--native-muted)]">
              <input
                type="checkbox"
                class="h-4 w-4 accent-[var(--native-primary)]"
                checked={state.filterOngoing}
                onChange={(e) => {
                  setState("filterOngoing", e.currentTarget.checked)
                  updateUrl()
                }}
              />
              仅显示尚未结束
            </label>
          </div>
        </header>

        <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
          <div class="mb-3 flex items-center justify-between gap-3">
            <span class="text-sm font-semibold text-[var(--native-foreground)]">项目列表</span>
            <Button size="sm" onClick={() => dialog.show(() => <CreateProjectDialog onCreated={() => void refetch()} />)}>+ 创建项目</Button>
          </div>
          <FilterTable
            columns={columns()}
            rows={filteredData()}
            rawRows={data() ?? []}
            controller={table}
            loading={data.loading}
            total={filteredData().length}
            page={1}
            pageSize={filteredData().length || 1}
            pageSizeOptions={[250, 500, 1000]}
            emptyText={data.loading ? "项目加载中..." : "暂无项目数据"}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
          />
        </section>

        <Show when={filteredData().length > 0}>
          <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
            <div class="mb-4 text-sm font-semibold text-[var(--native-foreground)]">图表</div>
            <div class="grid gap-3 lg:grid-cols-2">
              <ChartCard option={chartEffOption()} />
              <ChartCard option={chartCodeOption()} />
              <ChartCard option={chartTimeOption()} />
              <ChartCard option={chartPeopleOption()} />
              <ChartCard option={chartCostOption()} />
            </div>
          </section>
        </Show>
      </div>
    </div>
  )
}
