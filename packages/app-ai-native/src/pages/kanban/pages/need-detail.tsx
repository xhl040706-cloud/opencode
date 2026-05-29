import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { createMemo, createResource, createSignal, For, Show, type JSX } from "solid-js"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import Back from "../components/back"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getNeedDetail } from "../lib/api"
import { parseQueryRange, rangeQuery, searchQuery } from "../lib/date-range"
import { formatBoundarySource, formatDuration, formatLocalTime, formatV2Ratio, shortId } from "../lib/formatters"
import type { NeedBaselineComponents, NeedDetailNeed } from "../lib/types"

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

function fmtInt(value?: number | null) {
  if (value == null) return "-"
  const num = Math.round(Number(value))
  if (!Number.isFinite(num)) return "-"
  return new Intl.NumberFormat("zh-CN").format(num)
}

function fmtPct(value?: number | null) {
  if (value == null || value === 0) return "-"
  return formatV2Ratio(value)
}

// 基线组成为分钟口径；null 优雅显示 "-"，0 仍显示 "0"。
function fmtMin(value?: number | null) {
  if (value == null) return "-"
  const num = Number(value)
  if (!Number.isFinite(num)) return "-"
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(num)
}

function MetricCard(props: { label: string; value: JSX.Element | string; accent?: string; hint?: string; title?: string; clip?: boolean }) {
  return (
    <article
      class="min-w-0 rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_88%,var(--native-bg-subtle))] p-4 shadow-[var(--native-shadow-sm)]"
      style={{ "--metric-accent": props.accent ?? "var(--native-primary)" }}
    >
      <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:color-mix(in_oklab,var(--metric-accent)_72%,var(--native-dim))]">
        {props.label}
      </p>
      <p
        class={
          props.clip
            ? "mt-2 truncate text-[1.4rem] leading-none font-semibold tracking-[-0.04em] text-[var(--native-foreground)]"
            : "mt-2 text-[1.4rem] leading-none font-semibold tracking-[-0.04em] text-[var(--native-foreground)]"
        }
        title={props.title}
      >
        {props.value}
      </p>
      <Show when={props.hint}>
        <p class="mt-2 line-clamp-2 text-[0.8125rem] text-[var(--native-muted)]" title={props.hint}>{props.hint}</p>
      </Show>
    </article>
  )
}

function KvItem(props: { label: string; value: JSX.Element | string; mono?: boolean; wide?: boolean }) {
  return (
    <div class={props.wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--native-dim)]">{props.label}</p>
      <p class={`mt-1 break-all text-sm text-[var(--native-foreground)] ${props.mono ? "font-mono" : ""}`}>{props.value}</p>
    </div>
  )
}

export default function KanbanNeedDetail() {
  const language = useLanguage()
  const params = useParams()
  const navigate = useNavigate()
  const [search] = useSearchParams<{ startDate?: string; endDate?: string }>()

  const needId = createMemo(() => decodeURIComponent(params.needId ?? "").trim())
  const dateRange = createMemo(() => parseQueryRange(search.startDate, search.endDate))

  const [detail] = createResource(
    () => needId(),
    async (id) => {
      if (!id) return null
      try {
        return await getNeedDetail(id)
      } catch (err) {
        showToast({
          variant: "error",
          title: language.t("kanban.need.loadDetailFailed"),
          description: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    },
  )

  const view = createMemo(() => detail.latest ?? detail() ?? null)
  const need = createMemo<NeedDetailNeed>(() => view()?.need ?? ({} as NeedDetailNeed))
  const sessions = createMemo(() => view()?.sessions ?? [])
  const commits = createMemo(() => view()?.commits ?? [])
  const baseline = createMemo<NeedBaselineComponents>(() => view()?.baselineComponents ?? ({} as NeedBaselineComponents))

  // 基线组成表：算法 / kNN 锚点 / LLM / 融合 / 离散，各列均可为 null（优雅显示 "-"）。
  const baselineRows = createMemo(() => {
    const b = baseline()
    return [
      { key: "algo", think: b.algo_think_min, exec: b.algo_exec_min, verify: b.algo_verify_min, total: b.algo_total_min, reason: "" },
      { key: "knn", think: null, exec: null, verify: null, total: b.anchor_knn_min, reason: b.anchor_knn_reason || "" },
      { key: "llm", think: b.llm_think_min, exec: b.llm_exec_min, verify: b.llm_verify_min, total: b.llm_total_min, reason: b.llm_reason || b.llm_confidence || "" },
      { key: "fused", think: null, exec: null, verify: null, total: b.fused_work_min, reason: "" },
      { key: "spread", think: null, exec: null, verify: null, total: b.spread_work_min, reason: "" },
      { key: "calendar", think: null, exec: null, verify: null, total: b.calendar_min, reason: "" },
    ]
  })
  const hasBaseline = createMemo(() => baselineRows().some((r) => r.total != null))

  // 关联 commit 的文件列表展开状态（key = commit_id）。
  const [expandedFiles, setExpandedFiles] = createSignal<Record<string, boolean>>({})
  const toggleFiles = (id: string) => setExpandedFiles((prev) => ({ ...prev, [id]: !prev[id] }))

  const userDetailHref = (userId: string) => {
    const next = rangeQuery(dateRange())
    const q = searchQuery([
      ["startDate", next.startDate],
      ["endDate", next.endDate],
    ]).toString()
    return `/kanban/user/${encodeURIComponent(userId)}${q ? `?${q}` : ""}`
  }

  const contributorCount = createMemo(() => {
    const ids = need().contributor_user_ids
    return Array.isArray(ids) ? ids.length : "-"
  })

  const band = createMemo(() => {
    const n = need()
    if (n.efficiency_band_low == null && n.efficiency_band_high == null) return undefined
    return `${language.t("kanban.need.detail.band")} ${formatV2Ratio(n.efficiency_band_low)} ~ ${formatV2Ratio(n.efficiency_band_high)}`
  })

  const commitDetailHref = (commitId: string) => {
    const next = rangeQuery(dateRange())
    const q = searchQuery([
      ["startDate", next.startDate],
      ["endDate", next.endDate],
    ]).toString()
    return `/kanban/commit/${encodeURIComponent(commitId)}${q ? `?${q}` : ""}`
  }

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-4 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <header class="flex w-full flex-col gap-3">
        <Back />
        <h1 class="font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">
          {language.t("kanban.need.detailTitle")}
        </h1>
        <p class="m-0 break-all font-mono text-sm text-[var(--native-muted)]">{needId() || "-"}</p>
        <div class="flex flex-wrap items-center gap-2">
          <Show when={need().status}>
            <Tag text={need().status!} tone={statusTone(need().status)} />
          </Show>
          <Show when={need().confidence_level}>
            <Tag text={`${language.t("kanban.need.col.confidence")} ${need().confidence_level}`} tone={confidenceTone(need().confidence_level)} />
          </Show>
          <Show
            when={need().outlier_flag}
            fallback={
              <Tag
                text={need().coverage_eligible ? language.t("kanban.need.tag.eligible") : language.t("kanban.need.tag.ineligible")}
                tone={need().coverage_eligible ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted/40 text-muted-foreground"}
              />
            }
          >
            <Tag text={language.t("kanban.need.tag.outlier")} tone="border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300" />
          </Show>
        </div>
      </header>

      <Show
        when={!detail.loading || view()}
        fallback={
          <div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] px-4 py-10 text-sm text-[var(--native-muted)] shadow-[var(--native-shadow-sm)]">
            {language.t("kanban.need.loadingDetail")}
          </div>
        }
      >
        <Show
          when={view()}
          fallback={
            <div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] px-4 py-10 text-sm text-[var(--native-muted)] shadow-[var(--native-shadow-sm)]">
              {language.t("kanban.need.noDetail")}
            </div>
          }
        >
          <div class="flex w-full flex-col gap-5">
            {/* 指标卡 */}
            <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label={language.t("kanban.need.col.calendarEfficiency")}
                value={formatV2Ratio(need().efficiency_ratio)}
                accent="var(--native-success)"
                hint={band()}
              />
              <MetricCard
                label={language.t("kanban.need.col.workEfficiency")}
                value={formatV2Ratio(need().work_efficiency_ratio)}
                accent="var(--native-info, var(--native-primary))"
              />
              <MetricCard
                label={language.t("kanban.need.col.actualCalendar")}
                value={formatDuration(need().total_calendar_min, language.t)}
                accent="var(--native-primary)"
              />
              <MetricCard
                label={language.t("kanban.need.col.baselineCalendar")}
                value={formatDuration(need().baseline_calendar_min, language.t)}
                accent="var(--native-primary)"
              />
              <MetricCard
                label={language.t("kanban.need.detail.actualWork")}
                value={formatDuration(need().total_active_work_corrected_min, language.t)}
                accent="var(--native-warning)"
              />
              <MetricCard
                label={language.t("kanban.need.detail.baselineWork")}
                value={formatDuration(need().baseline_fused_work_min, language.t)}
                accent="var(--native-warning)"
              />
            </section>

            {/* 阶段耗时 */}
            <section class="grid gap-4 md:grid-cols-3">
              <MetricCard
                label={language.t("kanban.need.col.think")}
                value={formatDuration(need().total_think_min, language.t)}
                accent="var(--native-info, var(--native-primary))"
              />
              <MetricCard
                label={language.t("kanban.need.col.exec")}
                value={formatDuration(need().total_exec_min, language.t)}
                accent="var(--native-info, var(--native-primary))"
              />
              <MetricCard
                label={language.t("kanban.need.col.verify")}
                value={formatDuration(need().total_verify_min, language.t)}
                accent="var(--native-info, var(--native-primary))"
              />
            </section>

            {/* 基线组成：解释提效基线怎么算出来（算法 / kNN 锚点 / LLM / 融合 / 离散 / 日历） */}
            <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3">
                <span class="text-[1rem] font-semibold text-[var(--native-foreground)]">{language.t("kanban.need.detail.baselineTitle")}</span>
                <Show when={baseline().team_work_density != null}>
                  <span class="text-xs text-[var(--native-muted)]">
                    {language.t("kanban.need.detail.teamWorkDensity")}: {fmtPct(baseline().team_work_density)}
                  </span>
                </Show>
              </div>
              <div class="overflow-auto">
                <Show
                  when={hasBaseline()}
                  fallback={<div class="px-4 py-8 text-center text-sm text-[var(--native-muted)]">{language.t("kanban.need.detail.noBaseline")}</div>}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead class="min-w-[140px]">{language.t("kanban.need.detail.baselineSource")}</TableHead>
                        <TableHead class="min-w-[80px] text-left">{language.t("kanban.need.col.think")}</TableHead>
                        <TableHead class="min-w-[80px] text-left">{language.t("kanban.need.col.exec")}</TableHead>
                        <TableHead class="min-w-[80px] text-left">{language.t("kanban.need.col.verify")}</TableHead>
                        <TableHead class="min-w-[90px] text-left">{language.t("kanban.need.detail.baselineTotal")}</TableHead>
                        <TableHead class="min-w-[200px]">{language.t("kanban.need.detail.reason")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <For each={baselineRows()}>
                        {(r) => (
                          <TableRow>
                            <TableCell class="font-medium text-[var(--native-foreground)]">{language.t(`kanban.need.detail.baseline.${r.key}`)}</TableCell>
                            <TableCell class="text-left tabular-nums">{fmtMin(r.think)}</TableCell>
                            <TableCell class="text-left tabular-nums">{fmtMin(r.exec)}</TableCell>
                            <TableCell class="text-left tabular-nums">{fmtMin(r.verify)}</TableCell>
                            <TableCell class="text-left tabular-nums">{fmtMin(r.total)}</TableCell>
                            <TableCell>
                              <span class="block max-w-[28rem] whitespace-pre-wrap break-words text-[var(--native-muted)]">{r.reason || "-"}</span>
                            </TableCell>
                          </TableRow>
                        )}
                      </For>
                    </TableBody>
                  </Table>
                </Show>
              </div>
              <p class="px-4 py-3 text-xs text-[var(--native-muted)]">{language.t("kanban.need.detail.baselineHint")}</p>
            </section>

            {/* 基础信息 */}
            <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
              <div class="mb-4 text-[1rem] font-semibold text-[var(--native-foreground)]">{language.t("kanban.need.detail.basicInfo")}</div>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <KvItem label={language.t("kanban.need.col.boundarySource")} value={formatBoundarySource(need().boundary_source, language.t)} />
                <KvItem
                  label={language.t("kanban.need.col.boundaryConfidence")}
                  value={need().boundary_confidence ? <Tag text={need().boundary_confidence!} tone={confidenceTone(need().boundary_confidence)} /> : "-"}
                />
                <KvItem label={language.t("kanban.need.detail.contributors")} value={String(contributorCount())} />
                <KvItem label={language.t("kanban.need.col.repo")} value={need().repo_addr || "-"} mono wide />
                <KvItem label={language.t("kanban.need.col.branch")} value={need().repo_branch || "-"} mono />
                <KvItem
                  label={language.t("kanban.need.detail.primaryUser")}
                  value={
                    need().primary_user_id ? (
                      <button
                        type="button"
                        class="text-left font-mono text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer"
                        onClick={() => navigate(userDetailHref(need().primary_user_id!.trim()))}
                      >
                        {need().primary_user_id}
                      </button>
                    ) : (
                      "-"
                    )
                  }
                />
                <KvItem label={language.t("kanban.need.detail.devStart")} value={formatLocalTime(need().dev_start_ts)} />
                <KvItem label={language.t("kanban.need.detail.devEnd")} value={formatLocalTime(need().dev_end_ts)} />
                <KvItem label={language.t("kanban.need.detail.mergeTime")} value={formatLocalTime(need().merge_ts ?? undefined)} />
                <KvItem label={language.t("kanban.need.detail.devDuration")} value={formatDuration(need().dev_duration_min, language.t)} />
                <Show when={need().team_profile_used?.trim() && need().team_profile_used !== "balanced"}>
                  <KvItem label={language.t("kanban.need.detail.teamProfile")} value={need().team_profile_used!} />
                </Show>
                <KvItem label={language.t("kanban.need.detail.reason")} value={need().reason?.trim() || "-"} wide />
              </div>
            </section>

            {/* 代码与质量信号 */}
            <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
              <div class="mb-4 text-[1rem] font-semibold text-[var(--native-foreground)]">{language.t("kanban.need.detail.qualityTitle")}</div>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KvItem label={language.t("kanban.need.detail.locNet")} value={fmtInt(need().total_loc_net)} />
                <KvItem label={language.t("kanban.need.detail.filesTouched")} value={fmtInt(need().total_files_touched)} />
                <KvItem label={language.t("kanban.need.detail.commitCount")} value={fmtInt(need().commit_count)} />
                <KvItem label={language.t("kanban.need.detail.aiCodeRatio")} value={fmtPct(need().ai_code_ratio)} />
                <KvItem label={language.t("kanban.need.detail.aiCoveredLoc")} value={fmtInt(need().ai_covered_loc)} />
                <KvItem label={language.t("kanban.need.detail.uncoveredLoc")} value={fmtInt(need().uncovered_loc)} />
                <KvItem label={language.t("kanban.need.detail.uncoveredWorkRatio")} value={fmtPct(need().uncovered_work_ratio)} />
                <KvItem label={language.t("kanban.table.silica")} value={fmtPct(need().silica)} />
              </div>
            </section>

            {/* 关联 Sessions */}
            <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
              <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                {language.t("kanban.need.detail.sessions")} ({sessions().length})
              </div>
              <div class="overflow-auto">
                <Show when={sessions().length > 0} fallback={<div class="px-4 py-8 text-center text-sm text-[var(--native-muted)]">{language.t("kanban.need.detail.noSessions")}</div>}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead class="min-w-[110px]">{language.t("kanban.need.detail.session")}</TableHead>
                        <TableHead class="min-w-[160px]">{language.t("kanban.table.user")}</TableHead>
                        <TableHead class="min-w-[150px]">{language.t("kanban.need.detail.start")}</TableHead>
                        <TableHead class="min-w-[150px]">{language.t("kanban.need.detail.end")}</TableHead>
                        <TableHead class="min-w-[100px] text-left">{language.t("kanban.need.detail.activeWork")}</TableHead>
                        <TableHead class="min-w-[80px] text-left">{language.t("kanban.need.col.think")}</TableHead>
                        <TableHead class="min-w-[80px] text-left">{language.t("kanban.need.col.exec")}</TableHead>
                        <TableHead class="min-w-[80px] text-left">{language.t("kanban.need.col.verify")}</TableHead>
                        <TableHead class="min-w-[100px]">{language.t("kanban.need.detail.stageConfidence")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <For each={sessions()}>
                        {(s) => (
                          <TableRow>
                            <TableCell class="font-mono">{shortId(s.session_id)}</TableCell>
                            <TableCell>
                              <span class="block max-w-[16rem] truncate" title={s.user_id ?? undefined}>{s.user_id || "-"}</span>
                            </TableCell>
                            <TableCell>{formatLocalTime(s.session_start_ts)}</TableCell>
                            <TableCell>{formatLocalTime(s.session_end_ts)}</TableCell>
                            <TableCell class="text-left">{formatDuration(s.total_active_min, language.t)}</TableCell>
                            <TableCell class="text-left">{formatDuration(s.think_active_min, language.t)}</TableCell>
                            <TableCell class="text-left">{formatDuration(s.exec_active_min, language.t)}</TableCell>
                            <TableCell class="text-left">{formatDuration(s.verify_active_min, language.t)}</TableCell>
                            <TableCell>{s.stage_confidence ? <Tag text={s.stage_confidence} tone={confidenceTone(s.stage_confidence)} /> : "-"}</TableCell>
                          </TableRow>
                        )}
                      </For>
                    </TableBody>
                  </Table>
                </Show>
              </div>
            </section>

            {/* 关联 Commits */}
            <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
              <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                {language.t("kanban.need.detail.commits")} ({commits().length})
              </div>
              <div class="overflow-auto">
                <Show when={commits().length > 0} fallback={<div class="px-4 py-8 text-center text-sm text-[var(--native-muted)]">{language.t("kanban.need.detail.noCommits")}</div>}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead class="min-w-[110px]">{language.t("kanban.table.commitId")}</TableHead>
                        <TableHead class="min-w-[150px]">{language.t("kanban.table.time")}</TableHead>
                        <TableHead class="min-w-[140px]">{language.t("kanban.table.user")}</TableHead>
                        <TableHead class="min-w-[90px] text-left">{language.t("kanban.metric.codeLines")}</TableHead>
                        <TableHead class="min-w-[90px] text-left">{language.t("kanban.table.silica")}</TableHead>
                        <TableHead class="min-w-[110px] text-left">{language.t("kanban.need.detail.files")}</TableHead>
                        <TableHead class="min-w-[280px]">{language.t("kanban.table.description")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <For each={commits()}>
                        {(c) => {
                          const fileCount = () => (Array.isArray(c.touched_files) ? c.touched_files.length : 0)
                          const rowKey = () => c.commit_id?.trim() || ""
                          const open = () => !!expandedFiles()[rowKey()]
                          return (
                            <>
                              <TableRow>
                                <TableCell>
                                  <Show when={c.commit_id?.trim()} fallback={<span>-</span>}>
                                    <button
                                      type="button"
                                      class="text-left text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer"
                                      onClick={() => navigate(commitDetailHref(c.commit_id!.trim()))}
                                    >
                                      {shortId(c.commit_id, 10)}
                                    </button>
                                  </Show>
                                </TableCell>
                                <TableCell>{formatLocalTime(c.commit_time)}</TableCell>
                                <TableCell>
                                  <span class="block max-w-[14rem] truncate" title={c.user_name ?? undefined}>{c.user_name || "-"}</span>
                                </TableCell>
                                <TableCell class="text-left tabular-nums">{c.diff_lines ?? "-"}</TableCell>
                                <TableCell class="text-left tabular-nums">{fmtPct(c.silica)}</TableCell>
                                <TableCell class="text-left">
                                  <Show when={fileCount() > 0} fallback={<span class="text-[var(--native-muted)]">-</span>}>
                                    <button
                                      type="button"
                                      class="inline-flex items-center gap-1 text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer"
                                      aria-expanded={open()}
                                      onClick={() => toggleFiles(rowKey())}
                                    >
                                      <span>{language.t("kanban.need.detail.fileCount", { count: fileCount() })}</span>
                                      <span class="text-xs">{open() ? "▾" : "▸"}</span>
                                    </button>
                                  </Show>
                                </TableCell>
                                <TableCell>
                                  <span class="block max-w-[36rem] whitespace-pre-wrap break-words">{c.comment || "-"}</span>
                                </TableCell>
                              </TableRow>
                              <Show when={open() && fileCount() > 0}>
                                <TableRow>
                                  <TableCell colspan={7} class="bg-[color:color-mix(in_oklab,var(--native-bg-subtle)_60%,transparent)]">
                                    <ul class="m-0 flex flex-col gap-1 py-1 pl-1">
                                      <For each={c.touched_files}>
                                        {(file) => (
                                          <li class="break-all font-mono text-xs text-[var(--native-muted)]">{file}</li>
                                        )}
                                      </For>
                                    </ul>
                                  </TableCell>
                                </TableRow>
                              </Show>
                            </>
                          )
                        }}
                      </For>
                    </TableBody>
                  </Table>
                </Show>
              </div>
            </section>
          </div>
        </Show>
      </Show>
    </div>
  )
}
