import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Back from "../components/back"
import { FilterBar } from "../components/filters/filter-bar"
import { MetricCard } from "../components/metric-card"
import { defaultWideRange, parseQueryRange, rangeQuery, searchQuery } from "../lib/date-range"
import { formatDuration, formatV2Ratio } from "../lib/formatters"
import { getOrgDetail } from "../lib/api"
import type { OrgCascadeValue } from "../lib/types"

function parsePath(path: string) {
  const txt = decodeURIComponent(path).trim()
  if (!txt || txt === "all") return {} as OrgCascadeValue
  const parts = txt.split("/").filter(Boolean)
  return {
    org1: parts[0],
    org2: parts[1],
    org3: parts[2],
    org4: parts[3],
  } satisfies OrgCascadeValue
}

function orgPath(value: OrgCascadeValue) {
  const parts = [value.org1, value.org2, value.org3, value.org4].filter(Boolean)
  return parts.length ? parts.join("/") : "all"
}

function fmtCost(value?: number | null) {
  if (value == null || value === 0) return "-"
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function queryOf(range: [string, string], org?: OrgCascadeValue) {
  const next = rangeQuery(range)
  return searchQuery([
    ["startDate", next.startDate],
    ["endDate", next.endDate],
    ["org1", org?.org1],
    ["org2", org?.org2],
    ["org3", org?.org3],
    ["org4", org?.org4],
  ])
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

export default function KanbanOrgDetail() {
  const language = useLanguage()
  const params = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams<{ startDate?: string; endDate?: string }>()

  const org = createMemo(() => parsePath(params.orgPath ?? ""))
  const orgKey = createMemo(() => orgPath(org()))
  const dateRange = createMemo(() => parseQueryRange(search.startDate, search.endDate))

  const [data, { refetch }] = createResource(
    () => ({ org: org(), dateRange: dateRange() }),
    async (input) => {
      try {
        return await getOrgDetail(input)
      } catch (err) {
        showToast({ variant: "error", title: language.t("kanban.toast.loadFailed"), description: err instanceof Error ? err.message : String(err) })
        return null
      }
    },
  )

  const [cachedDetail, setCachedDetail] = createSignal<{ key: string; data: NonNullable<Awaited<ReturnType<typeof getOrgDetail>>> } | null>(null)

  createEffect(() => {
    const detail = data()
    if (!detail) return
    setCachedDetail({ key: orgKey(), data: detail })
  })

  const view = createMemo(() => {
    const detail = data()
    if (detail) return detail
    const cached = cachedDetail()
    if (cached?.key === orgKey()) return cached.data
    return null
  })

  const summary = createMemo(() => view()?.summary ?? {})
  const members = createMemo(() => view()?.members ?? [])
  const orgName = createMemo(() => org().org4 || org().org3 || org().org2 || org().org1 || language.t("kanban.org.allOrgs"))

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-5 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <div class="flex w-full flex-col gap-5">
        <header class="flex w-full flex-col gap-3">
          <Back />
          <h1 class="m-0 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">{language.t("kanban.detail.org")}</h1>
          <p class="m-0 text-sm text-[var(--native-muted)]">{orgName()}</p>
        </header>

        <FilterBar
          dateRange={dateRange()}
          orgValue={org()}
          dateSlot="actions"
          dateLabel={false}
          showOrg
          onDateRangeChange={(value) => {
            const next = value ?? defaultWideRange()
            setSearch(Object.fromEntries(queryOf(next, org()).entries()), { replace: true })
          }}
          onOrgChange={(value) => {
            navigate(`/kanban/org/${encodeURIComponent(orgPath(value))}?${queryOf(dateRange(), value).toString()}`)
          }}
          actions={
            <div class="flex items-end">
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={data.loading}>{data.loading ? language.t("kanban.action.refreshing") : language.t("kanban.action.refresh")}</Button>
            </div>
          }
        />

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard label={language.t("kanban.metric.memberCount")} value={String(summary().user_count ?? 0)} accent="var(--native-success)" />
          <MetricCard label={language.t("kanban.user.col.mergedNeeds")} value={String(summary().merged_need_count ?? 0)} accent="var(--native-primary)" />
          <MetricCard label={language.t("kanban.user.col.calendarEfficiency")} value={formatV2Ratio(summary().calendar_ratio)} accent="var(--native-success)" />
          <MetricCard label={language.t("kanban.user.col.workEfficiency")} value={formatV2Ratio(summary().work_ratio)} accent="var(--native-info)" />
          <MetricCard label={language.t("kanban.user.col.actualCalendar")} value={formatDuration(summary().actual_calendar_min, language.t)} accent="var(--native-warning)" />
          <MetricCard label={language.t("kanban.user.metric.commitAndLines")} value={`${summary().commit_count ?? 0} / ${summary().commit_diff_lines ?? 0}`} accent="#8a4cf6" />
        </section>

        <section class="overflow-hidden rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
          <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">{language.t("kanban.section.userList")}</div>
          <div class="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="min-w-[150px]">{language.t("kanban.table.userName")}</TableHead>
                  <TableHead class="min-w-[90px] text-left">{language.t("kanban.user.col.mergedNeeds")}</TableHead>
                  <TableHead class="min-w-[110px] text-left">{language.t("kanban.user.col.actualCalendar")}</TableHead>
                  <TableHead class="min-w-[110px] text-left">{language.t("kanban.user.col.calendarEfficiency")}</TableHead>
                  <TableHead class="min-w-[110px] text-left">{language.t("kanban.user.col.workEfficiency")}</TableHead>
                  <TableHead class="min-w-[90px] text-left">{language.t("kanban.table.commitCount")}</TableHead>
                  <TableHead class="min-w-[110px] text-left">{language.t("kanban.table.commitCodeLines")}</TableHead>
                  <TableHead class="min-w-[100px] text-left">{language.t("kanban.table.cost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Show when={members().length > 0} fallback={<TableRow><TableCell colSpan={8} class="py-8 text-left text-sm text-[var(--native-muted)]">{language.t("kanban.empty.noUserData")}</TableCell></TableRow>}>
                  <For each={members()}>
                    {(row) => (
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer"
                            onClick={() => {
                              const txt = row.user_id?.trim()
                              if (!txt) return
                              navigate(`/kanban/user/${encodeURIComponent(txt)}?${queryOf(dateRange(), org()).toString()}`)
                            }}
                          >
                            {row.user_name || row.user_id || "-"}
                          </button>
                        </TableCell>
                        <TableCell class="text-left tabular-nums">{row.merged_need_count ?? 0}</TableCell>
                        <TableCell class="text-left">{formatDuration(row.actual_calendar_min, language.t)}</TableCell>
                        <TableCell class="text-left"><V2Ratio value={row.calendar_ratio} /></TableCell>
                        <TableCell class="text-left"><V2Ratio value={row.work_ratio} /></TableCell>
                        <TableCell class="text-left tabular-nums">{row.commit_count ?? 0}</TableCell>
                        <TableCell class="text-left tabular-nums">{row.commit_diff_lines ?? 0}</TableCell>
                        <TableCell class="text-left tabular-nums">{fmtCost(row.cost)}</TableCell>
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
