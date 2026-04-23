import { A, useParams, useSearchParams } from "@solidjs/router"
import { createMemo, createResource, For, Show } from "solid-js"
import { showToast } from "@opencode-ai/ui/toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getWorkDirDetail } from "../lib/api"
import { formatDuration, formatLocalTime, shortId } from "../lib/formatters"
import type {
  WorkDirParticipant,
  WorkDirSilicaEntry,
} from "../lib/types"

function silicaColor(silica: number) {
  const pct = silica * 100
  if (pct >= 80) return "var(--native-success)"
  if (pct >= 50) return "var(--native-primary)"
  return "var(--native-warning)"
}

function silicaBgClass(silica: number) {
  const pct = silica * 100
  if (pct >= 80) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  if (pct >= 50) return "bg-sky-500/15 text-sky-700 dark:text-sky-300"
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
}

function MetricCard(props: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <article
      class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_88%,var(--native-bg-subtle))] p-4 shadow-[var(--native-shadow-sm)]"
      style={{ "--metric-accent": props.accent ?? "var(--native-primary)" }}
    >
      <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:color-mix(in_oklab,var(--metric-accent)_72%,var(--native-dim))]">{props.label}</p>
      <p class="mt-2 text-[1.4rem] leading-none font-semibold tracking-[-0.04em] text-[var(--native-foreground)]">{props.value}</p>
      <Show when={props.hint}>
        <p class="mt-2 text-[0.8125rem] text-[var(--native-muted)]">{props.hint}</p>
      </Show>
    </article>
  )
}

function SilicaBar(props: { value: number }) {
  const pct = () => Math.round(props.value * 100)
  return (
    <span class={`inline-flex min-w-[4.5rem] items-center gap-2 rounded-full border border-border px-2 py-1 text-xs font-medium ${silicaBgClass(props.value)}`}>
      <span
        class="inline-block h-2 rounded-full"
        style={{
          width: `${pct()}%`,
          "max-width": "60px",
          "background-color": silicaColor(props.value),
          "min-width": "4px",
        }}
      />
      {pct()}%
    </span>
  )
}

export default function KanbanWorkDirDetail() {
  const params = useParams()
  const [searchParams] = useSearchParams<{ fromTaskId?: string }>()

  const backHref = createMemo(() => {
    const taskId = searchParams.fromTaskId?.trim()
    return taskId ? `/kanban/task/${encodeURIComponent(taskId)}` : "/kanban"
  })
  const backLabel = createMemo(() => searchParams.fromTaskId?.trim() ? "返回 Task 详情" : "返回看板")

  const workDirId = createMemo(() => decodeURIComponent(params.workDirId ?? "").trim())

  const [detail] = createResource(
    () => workDirId(),
    async (id) => {
      if (!id) return null
      try {
        return await getWorkDirDetail(id)
      } catch (err) {
        showToast({
          variant: "error",
          title: "工作目录详情加载失败",
          description: err instanceof Error ? err.message : String(err),
        })
        return null
      }
    },
  )

  const commits = createMemo(() => detail()?.commits ?? [])
  const tasks = createMemo(() => detail()?.tasks ?? [])
  const silicaEntries = createMemo(() => detail()?.silica_entries ?? [])
  const summary = createMemo(() => detail()?.summary ?? {})

  const participants = createMemo<WorkDirParticipant[]>(() => {
    const d = detail()
    if (!d?.tasks) return []
    const map: Record<string, WorkDirParticipant> = {}
    for (const t of d.tasks) {
      const uid = t.user_id || "unknown"
      if (!map[uid]) map[uid] = { user_id: uid, user_name: t.user_name || uid, task_count: 0, commit_count: 0 }
      map[uid].task_count++
    }
    if (d.commits) {
      const nameToUid: Record<string, string> = {}
      for (const t of d.tasks) {
        if (t.user_name) nameToUid[t.user_name] = t.user_id || "unknown"
      }
      for (const c of d.commits) {
        const uid = nameToUid[c.git_user_name ?? ""]
        if (uid && map[uid]) map[uid].commit_count++
      }
    }
    return Object.values(map)
  })

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-6 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <header class="mx-auto flex w-full max-w-[1320px] flex-col gap-3">
        <A href={backHref()} class="inline-flex items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)]">
          <span>←</span>
          <span>{backLabel()}</span>
        </A>
        <div>
          <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--native-success)]">Kanban / WorkDir Detail</p>
          <h1 class="mt-2 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">
            工作目录详情: {detail()?.repo_addr || detail()?.repo_id || "-"}
          </h1>
        </div>
      </header>

      <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <Show when={!detail.loading} fallback={<div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] px-4 py-10 text-sm text-[var(--native-muted)] shadow-[var(--native-shadow-sm)]">加载中...</div>}>
          <Show when={detail()} fallback={<div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] px-4 py-10 text-sm text-[var(--native-muted)] shadow-[var(--native-shadow-sm)]">没有查询到工作目录详情</div>}>
            {(_) => (
              <>
                {/* 基础信息 */}
                <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
                  <div class="mb-4 text-[1rem] font-semibold text-[var(--native-foreground)]">基础信息</div>
                  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <MetricCard label="仓库地址" value={detail()?.repo_addr || "-"} hint="当前查看的工作目录" />
                    <MetricCard label="分支" value={detail()?.repo_branch || "-"} accent="var(--native-info, var(--native-primary))" />
                    <MetricCard label="用户数" value={String(summary().user_count ?? "-")} accent="var(--native-success)" />
                    <MetricCard label="关联Task数" value={String(summary().task_count ?? "-")} accent="var(--native-primary)" />
                    <MetricCard label="关联Commit数" value={String(summary().commit_count ?? "-")} accent="var(--native-warning)" />
                    <MetricCard label="总费用" value={summary().total_cost != null ? `${summary().total_cost!.toFixed(2)} 元` : "-"} accent="var(--native-warning)" />
                    <MetricCard
                      label="传统开发时长预估"
                      value={formatDuration(summary().task_ancient_minutes)}
                      accent="var(--native-success)"
                    />
                  </div>
                </section>

                {/* Commit 列表 */}
                <Show when={commits().length > 0}>
                  <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
                    <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                      Commits ({commits().length})
                    </div>
                    <div class="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="min-w-[120px]">Commit ID</TableHead>
                            <TableHead class="min-w-[150px]">提交者</TableHead>
                            <TableHead class="min-w-[160px]">提交时间</TableHead>
                            <TableHead class="min-w-[80px] text-right">Diff行数</TableHead>
                            <TableHead class="min-w-[110px] text-center">硅含量</TableHead>
                            <TableHead class="min-w-[90px] text-right">关联Task数</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={commits()}>
                            {(row) => (
                              <>
                                <TableRow>
                                  <TableCell>{shortId(row.commit_id)}</TableCell>
                                  <TableCell>{row.git_user_name || "-"}</TableCell>
                                  <TableCell>{formatLocalTime(row.commit_time)}</TableCell>
                                  <TableCell class="text-right tabular-nums">{row.diff_lines ?? "-"}</TableCell>
                                  <TableCell class="text-center">
                                    <Show when={row.silica != null} fallback={"-"}>
                                      <SilicaBar value={row.silica!} />
                                    </Show>
                                  </TableCell>
                                  <TableCell class="text-right tabular-nums">
                                    {row.matched_tasks?.length ?? 0}
                                  </TableCell>
                                </TableRow>
                                <Show when={(row.matched_tasks && row.matched_tasks.length > 0) || row.silica_reason}>
                                  <tr>
                                    <td colSpan={6} class="border-t-0 bg-[color:color-mix(in_oklab,var(--native-panel)_88%,var(--native-bg-subtle))] px-6 py-3">
                                      <Show when={row.silica_reason}>
                                        <div class="mb-2 text-sm">
                                          <span class="font-medium text-[var(--native-foreground)]">硅含量分析理由：</span>
                                          <span class="text-[var(--native-muted)]">{row.silica_reason}</span>
                                        </div>
                                      </Show>
                                      <Show when={row.matched_tasks && row.matched_tasks.length > 0}>
                                        <div>
                                          <span class="text-sm font-medium text-[var(--native-foreground)]">关联 Tasks：</span>
                                          <div class="mt-2 overflow-auto">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead class="min-w-[160px]">Task ID</TableHead>
                                                  <TableHead class="min-w-[100px]">用户</TableHead>
                                                  <TableHead class="min-w-[100px] text-center">硅比例</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                <For each={row.matched_tasks!}>
                                                  {(task) => (
                                                    <TableRow>
                                                      <TableCell>
                                                        <A href={`/kanban/task/${task.task_id}`} class="text-[var(--native-primary)] hover:underline">
                                                          {shortId(task.task_id)}
                                                        </A>
                                                      </TableCell>
                                                      <TableCell>{task.user_name || "-"}</TableCell>
                                                      <TableCell class="text-center">
                                                        <Show when={task.silica != null} fallback={"-"}>
                                                          <SilicaBar value={task.silica!} />
                                                        </Show>
                                                      </TableCell>
                                                    </TableRow>
                                                  )}
                                                </For>
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>
                                      </Show>
                                      <Show when={!row.matched_tasks || row.matched_tasks.length === 0}>
                                        <span class="text-sm text-[var(--native-muted)]">暂无关联 Task</span>
                                      </Show>
                                    </td>
                                  </tr>
                                </Show>
                              </>
                            )}
                          </For>
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </Show>

                {/* 参与者列表 */}
                <Show when={participants().length > 0}>
                  <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
                    <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                      参与者列表 ({participants().length})
                    </div>
                    <div class="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="min-w-[150px]">用户名</TableHead>
                            <TableHead class="min-w-[80px] text-right">Task数</TableHead>
                            <TableHead class="min-w-[80px] text-right">Commit数</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={participants()}>
                            {(row) => (
                              <TableRow>
                                <TableCell>
                                  <A href={`/kanban/user/${row.user_id}`} class="text-[var(--native-primary)] hover:underline">
                                    {row.user_name || row.user_id}
                                  </A>
                                </TableCell>
                                <TableCell class="text-right tabular-nums">{row.task_count}</TableCell>
                                <TableCell class="text-right tabular-nums">{row.commit_count}</TableCell>
                              </TableRow>
                            )}
                          </For>
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </Show>

                {/* 硅比例图表区域 */}
                <Show when={silicaEntries().length > 0}>
                  <SilicaChartSection entries={silicaEntries()} />
                </Show>
              </>
            )}
          </Show>
        </Show>
      </div>
    </div>
  )
}

function SilicaChartSection(props: { entries: WorkDirSilicaEntry[] }) {
  const sorted = createMemo(() =>
    [...props.entries]
      .filter((e) => e.silica != null)
      .sort((a, b) => (a.silica ?? 0) - (b.silica ?? 0)),
  )
  const maxSilica = createMemo(() => Math.max(...sorted().map((e) => e.silica ?? 0), 1))

  return (
    <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
      <div class="mb-4 text-[1rem] font-semibold text-[var(--native-foreground)]">硅比例（按Task）</div>
      <div class="flex flex-col gap-2">
        <For each={sorted()}>
          {(entry) => {
            const pct = () => ((entry.silica ?? 0) / maxSilica()) * 100
            return (
              <div class="flex items-center gap-3">
                <span class="w-[140px] shrink-0 truncate text-xs text-[var(--native-muted)]" title={entry.task_id}>
                  {shortId(entry.task_id)}
                </span>
                <div class="relative flex-1">
                  <div
                    class="h-5 rounded-sm"
                    style={{
                      width: `${pct()}%`,
                      "min-width": "4px",
                      "background-color": silicaColor(entry.silica ?? 0),
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span class="w-[50px] shrink-0 text-right text-xs tabular-nums text-[var(--native-foreground)]">
                  {((entry.silica ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            )
          }}
        </For>
      </div>
    </section>
  )
}
