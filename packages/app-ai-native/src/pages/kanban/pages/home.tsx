import { A } from "@solidjs/router"
import { createEffect, createMemo, createResource, Show } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createStore } from "solid-js/store"
import { showToast } from "@opencode-ai/ui/toast"
import { Button } from "@/components/ui/button"
import { TextField, TextFieldInput, TextFieldLabel } from "@/components/ui/text-field"
import { cn } from "@/lib/utils"
import { CollapsedTagBar } from "../components/filters/collapsed-tag-bar"
import { DimensionSelect } from "../components/filters/dimension-select"
import { FilterBar } from "../components/filters/filter-bar"
import { CorrectionDialog } from "../components/dialogs/correction-dialog"
import { FilterTable } from "../components/table/filter-table"
import { useTableFilters } from "../hooks/use-table-filters"
import { queryEfficiencyRows } from "../lib/api"
import { applyClientFilters } from "../lib/filter-utils"
import type { DateRangeValue, EfficiencyDimension, EfficiencyRow, EfficiencySummary, KanbanColumn, OrgCascadeValue } from "../lib/types"

function pad(v: number) {
  return String(v).padStart(2, "0")
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function fmtDays(ms?: number) {
  if (!ms) return "-"
  const days = ms / 28800000
  return days < 0.1 ? days.toFixed(2) : days.toFixed(1)
}

function msToDays(ms?: number) {
  if (!ms) return 0
  return Number(fmtDays(ms))
}

function fmtDate(v?: string) {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString()
}

function Field(props: { label: string; children: any }) {
  return (
    <TextField class="gap-2">
      <TextFieldLabel class="text-[0.8125rem] text-[var(--native-muted)]">{props.label}</TextFieldLabel>
      {props.children}
    </TextField>
  )
}

function SummaryCard(props: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <article
      class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_26%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_88%,var(--native-bg-subtle))] p-4 shadow-[var(--native-shadow-sm)]"
      style={{ "--card-tone": props.tone ?? "var(--native-primary)" }}
    >
      <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:color-mix(in_oklab,var(--card-tone)_72%,var(--native-dim))]">{props.label}</p>
      <p class="mt-2 text-[1.4rem] leading-none font-semibold tracking-[-0.04em] text-[var(--native-foreground)]">{props.value}</p>
      <Show when={props.hint}>
        <p class="mt-2 text-[0.8125rem] text-[var(--native-muted)]">{props.hint}</p>
      </Show>
    </article>
  )
}

export default function KanbanHome() {
  type UserRow = EfficiencyRow & {
    lead_days: number
    process_days: number
  }

  const dialog = useDialog()
  const [state, setState] = createStore({
    dateRange: [daysAgo(30), today()] as [string, string],
    orgValue: {} as OrgCascadeValue,
    tableQuery: {
      dimension: "work_dir" as EfficiencyDimension,
      dimensionId: "",
    },
    page: 1,
    pageSize: 25,
    refresh: 0,
    selectedRow: null as UserRow | null,
    correctionTarget: null as { dimension: EfficiencyDimension; dimensionId: string } | null,
    collapsedPanels: {
      filters: false,
      summary: false,
      table: false,
    },
  })

  const canQuery = createMemo(() => !!state.tableQuery.dimensionId.trim() && !!state.dateRange?.[0] && !!state.dateRange?.[1])

  const [rows, { refetch }] = createResource(
    () => ({
      ready: canQuery(),
      dimension: state.tableQuery.dimension,
      dimensionId: state.tableQuery.dimensionId.trim(),
      dateRange: state.dateRange as [string, string],
      refresh: state.refresh,
    }),
    async (input) => {
      if (!input.ready) return null
      try {
        return await queryEfficiencyRows({
          dimension: input.dimension,
          dimensionId: input.dimensionId,
          dateRange: input.dateRange,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        showToast({ variant: "error", title: "Kanban request failed", description: message })
        return {
          rows: [],
          total: 0,
        }
      }
    },
  )

  const summary = createMemo<EfficiencySummary | undefined>(() => rows()?.summary)
  const rawRows = createMemo<UserRow[]>(() =>
    (rows()?.rows ?? []).map((row) => ({
      ...row,
      lead_days: msToDays(row.lead_time_ms),
      process_days: msToDays(row.process_time_ms),
    })),
  )

  const columns = createMemo<KanbanColumn<UserRow>[]>(() => [
    {
      prop: "user_name",
      label: "用户",
      minWidth: 160,
      filter: { type: "search-select", placeholder: "选择或输入用户" },
    },
    {
      prop: "lead_days",
      label: "Lead 天数",
      minWidth: 110,
      align: "right",
      filter: { type: "number" },
    },
    {
      prop: "process_days",
      label: "Process 天数",
      minWidth: 120,
      align: "right",
      filter: { type: "number" },
    },
    {
      prop: "start_time",
      label: "开始时间",
      minWidth: 190,
      display: (row) => fmtDate(row.start_time),
      filter: { type: "date" },
    },
    {
      prop: "end_time",
      label: "结束时间",
      minWidth: 190,
      display: (row) => fmtDate(row.end_time),
      filter: { type: "date" },
    },
  ])

  const controller = useTableFilters<UserRow>({
    columns,
    onChange: () => setState("page", 1),
  })

  const filteredRows = createMemo(() => applyClientFilters(rawRows(), columns(), controller.filters))
  const total = createMemo(() => filteredRows().length)
  const pagedRows = createMemo(() => {
    const start = (state.page - 1) * state.pageSize
    return filteredRows().slice(start, start + state.pageSize)
  })

  createEffect(() => {
    if (state.page <= Math.max(1, Math.ceil(total() / state.pageSize))) return
    setState("page", 1)
  })

  const collapsedTags = createMemo(() =>
    Object.entries(state.collapsedPanels)
      .filter(([, hidden]) => hidden)
      .map(([key]) => ({
        key,
        label: key === "filters" ? "筛选" : key === "summary" ? "概览" : "表格",
      })),
  )

  const empty = createMemo(() => {
    if (rows.loading) return "Loading efficiency data..."
    if (!canQuery()) return "Fill dimension and id to load efficiency data."
    return "No user activity found for this range."
  })

  const load = async () => {
    if (!canQuery()) {
      showToast({ variant: "error", title: "Dimension id required", description: "Enter a work_dir or repo id first." })
      return
    }
    await refetch()
  }

  const openCorrection = () => {
    const current = summary()
    const dimensionId = state.tableQuery.dimensionId.trim()
    if (!current || !dimensionId) return

    setState("correctionTarget", { dimension: state.tableQuery.dimension, dimensionId })
    dialog.show(() => (
      <CorrectionDialog
        dimension={state.tableQuery.dimension}
        dimensionId={dimensionId}
        rawDays={current.ai_estimated.raw_days}
        correctedDays={current.ai_estimated.corrected_days ?? null}
        startDate={state.dateRange[0]}
        endDate={state.dateRange[1]}
        onCorrected={async () => {
          setState("correctionTarget", null)
          await refetch()
        }}
      />
    ), () => setState("correctionTarget", null))
  }

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-6 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <CollapsedTagBar tags={collapsedTags()} onExpand={(key) => setState("collapsedPanels", key as "filters" | "summary" | "table", false)} />
      <header class="mx-auto flex w-full max-w-[1160px] flex-col gap-3">
        <div>
          <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--native-success)]">Kanban</p>
          <h1 class="mt-2 max-w-[16ch] font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">效率看板</h1>
          <p class="mt-3 max-w-[66ch] text-[0.9375rem] leading-[1.7] text-[var(--native-muted)]">
            这一页已经切到计划中的 feature-local 结构：顶部 FilterBar 管控日期和组织，右侧 DimensionSelect 负责维度值选择，表格筛选和纠偏弹窗都在 kanban 目录内完成闭环。
          </p>
        </div>
      </header>

      <div class="mx-auto flex w-full max-w-[1160px] flex-col gap-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="m-0 text-[1rem] font-semibold tracking-[-0.03em] text-[var(--native-foreground)]">工作区</h2>
            <p class="mt-1 text-[0.8125rem] text-[var(--native-muted)]">按计划文档拆分后的 kanban 首页，页面层负责查询、弹窗状态、客户端过滤和折叠区块。</p>
          </div>
          <A href="/kanban/repo">
            <Button variant="outline" size="sm">打开仓库视图</Button>
          </A>
        </div>

        <section class="flex flex-col gap-5">
          <div class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
            <div class="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3">
              <div>
                <h2 class="m-0 text-[1rem] font-semibold tracking-[-0.03em] text-[var(--native-foreground)]">筛选栏</h2>
                <p class="mt-1 text-[0.8125rem] text-[var(--native-muted)]">日期和组织筛选由页面层持有，DimensionSelect 与纠偏入口通过 actions 区域挂入。</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setState("collapsedPanels", "filters", (value) => !value)}>
                {state.collapsedPanels.filters ? "展开" : "折叠"}
              </Button>
            </div>
            <Show when={!state.collapsedPanels.filters}>
              <div class="p-4">
                <FilterBar
                  dateRange={state.dateRange as DateRangeValue}
                  orgValue={state.orgValue}
                  showOrg
                  onDateRangeChange={(value) => {
                    if (!value) return
                    setState("dateRange", value as [string, string])
                  }}
                  onOrgChange={(value) => setState("orgValue", value)}
                  actions={
                    <>
                      <Field label="Dimension">
                        <select
                          class="flex h-10 min-w-[8rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={state.tableQuery.dimension}
                          onChange={(e) => setState("tableQuery", "dimension", e.currentTarget.value as EfficiencyDimension)}
                        >
                          <option value="work_dir">work_dir</option>
                          <option value="repo">repo</option>
                        </select>
                      </Field>
                      <Field label="Dimension Id">
                        <DimensionSelect
                          value={state.tableQuery.dimensionId}
                          dimension={state.tableQuery.dimension}
                          startDate={state.dateRange[0]}
                          endDate={state.dateRange[1]}
                          onChange={(value) => setState("tableQuery", "dimensionId", value)}
                          allowCreate
                          placeholder={state.tableQuery.dimension === "work_dir" ? "选择或输入 work_dir" : "选择或输入 repo"}
                        />
                      </Field>
                      <div class="flex items-end gap-2">
                        <Button variant="outline" onClick={() => { setState("page", 1); void load() }} disabled={!canQuery() || rows.loading}>
                          {rows.loading ? "刷新中..." : "刷新"}
                        </Button>
                        <Button onClick={openCorrection} disabled={!summary()}>纠偏</Button>
                      </div>
                    </>
                  }
                />
              </div>
            </Show>
          </div>

          <div class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
            <div class="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3">
              <div>
                <h2 class="m-0 text-[1rem] font-semibold tracking-[-0.03em] text-[var(--native-foreground)]">概览</h2>
                <p class="mt-1 text-[0.8125rem] text-[var(--native-muted)]">summary 来源于 kanban API 包装层，提交纠偏后会在这里重新拉取。</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setState("collapsedPanels", "summary", (value) => !value)}>
                {state.collapsedPanels.summary ? "展开" : "折叠"}
              </Button>
            </div>

            <Show when={!state.collapsedPanels.summary}>
              <div class="grid gap-5 p-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="AI days" value={summary() ? String(summary()!.ai_estimated.corrected_days ?? summary()!.ai_estimated.raw_days ?? 0) : "-"} hint="Raw or corrected estimate" tone="var(--native-primary)" />
                  <SummaryCard label="Lead ratio" value={summary() ? `${summary()!.efficiency.ratio_lead.toFixed(1)}%` : "-"} hint="AI days vs total lead time" tone="var(--native-success)" />
                  <SummaryCard label="Process ratio" value={summary() ? `${summary()!.efficiency.ratio_process.toFixed(1)}%` : "-"} hint="AI days vs process time" tone="var(--native-warning)" />
                  <SummaryCard label="Users" value={summary() ? String(summary()!.actual_time.user_count) : "-"} hint={summary()?.analysis_date ? `Analysis date ${summary()!.analysis_date}` : "Waiting for query"} tone="var(--native-info, var(--native-primary))" />
                </div>

                <aside class="grid gap-4">
                  <div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_90%,var(--native-bg-subtle))] p-4 shadow-[var(--native-shadow-sm)]">
                    <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--native-dim)]">Reasoning</p>
                    <p class={cn("mt-3 text-[0.875rem] leading-6 text-[var(--native-muted)]", !summary()?.efficiency.reason && "italic")}>
                      {summary()?.efficiency.reason || "No AI reasoning returned for this query."}
                    </p>
                  </div>

                  <div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--native-surface)_82%,var(--native-panel))] p-4 shadow-[var(--native-shadow-sm)]">
                    <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--native-dim)]">Selected row</p>
                    <Show when={state.selectedRow} fallback={<p class="mt-3 text-[0.875rem] text-[var(--native-muted)]">点击表格中的一行可在这里查看当前选中用户。</p>}>
                      {(row) => (
                        <div class="mt-3 grid gap-2 text-[0.875rem] text-[var(--native-muted)]">
                          <div>用户: <span class="text-[var(--native-foreground)]">{row().user_name || row().user_id || "-"}</span></div>
                          <div>Lead: <span class="text-[var(--native-foreground)]">{row().lead_days}</span></div>
                          <div>Process: <span class="text-[var(--native-foreground)]">{row().process_days}</span></div>
                        </div>
                      )}
                    </Show>
                  </div>
                </aside>
              </div>
            </Show>
          </div>

          <div class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
            <div class="flex items-center justify-between border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3">
              <div>
                <h2 class="m-0 text-[1rem] font-semibold tracking-[-0.03em] text-[var(--native-foreground)]">明细表格</h2>
                <p class="mt-1 text-[0.8125rem] text-[var(--native-muted)]">列头 filter 走 Popover，active tags 可回填编辑，分页在表格壳中处理。</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setState("collapsedPanels", "table", (value) => !value)}>
                {state.collapsedPanels.table ? "展开" : "折叠"}
              </Button>
            </div>

            <Show when={!state.collapsedPanels.table}>
              <FilterTable
                columns={columns()}
                rows={pagedRows()}
                rawRows={rawRows()}
                controller={controller}
                loading={rows.loading}
                total={total()}
                page={state.page}
                pageSize={state.pageSize}
                dateRange={state.dateRange as DateRangeValue}
                emptyText={empty()}
                actions={<span class="text-[0.8125rem] text-[var(--native-muted)]">当前维度: {state.tableQuery.dimension} / {state.tableQuery.dimensionId || "未选择"}</span>}
                onPageChange={(page) => setState("page", page)}
                onPageSizeChange={(size) => {
                  setState("pageSize", size)
                  setState("page", 1)
                }}
                onRowClick={(row) => setState("selectedRow", row)}
              />
            </Show>
          </div>
        </section>
      </div>
    </div>
  )
}