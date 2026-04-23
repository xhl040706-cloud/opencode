import { A, useNavigate, useParams } from "@solidjs/router"
import { createMemo, createResource, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { Modal } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  getProjectDetail,
  updateProjectManual,
  updateProjectV2,
  removeRepoFromProject,
  removeTasksFromProject,
  updateTaskSilicaInProject,
  getGlobalConfig,
} from "../lib/api"
import { formatDuration, formatLocalTime, shortId } from "../lib/formatters"
import type {
  ProjectDetailResult,
  ProjectManualPayload,
  ProjectUserStat,
  GlobalConfig,
} from "../lib/types"

function fmtCost(value?: number | null) {
  if (value == null || value === 0) return "-"
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function toNumberOrNull(value: string) {
  const txt = value.trim()
  if (!txt) return null
  const next = Number(txt)
  return Number.isNaN(next) ? null : next
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

function ManualDialog(props: { project: ProjectDetailResult; onSaved: () => void | Promise<void> }) {
  const dialog = useDialog()
  const [form, setForm] = createStore({
    project_ancient_minutes_manual: props.project.project_ancient_minutes_manual?.toString() || props.project.project_ancient_minutes?.toString() || "",
    project_ancient_minutes_reason_manual: props.project.project_ancient_minutes_reason_manual || "",
    project_real_process_minutes_manual: props.project.project_real_process_minutes_manual?.toString() || props.project.project_real_process_minutes?.toString() || "",
    project_real_process_minutes_reason_manual: props.project.project_real_process_minutes_reason_manual || "",
    project_real_lead_minutes_manual: props.project.project_real_lead_minutes_manual?.toString() || props.project.project_real_lead_minutes?.toString() || "",
    project_real_lead_minutes_reason_manual: props.project.project_real_lead_minutes_reason_manual || "",
    start_time_manual: props.project.start_time_manual || "",
    end_time_manual: props.project.end_time_manual || "",
    saving: false,
  })

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    const projectId = props.project.project_id?.trim()
    if (!projectId) return

    const payload: ProjectManualPayload = {
      project_ancient_minutes_manual: toNumberOrNull(form.project_ancient_minutes_manual),
      project_ancient_minutes_reason_manual: form.project_ancient_minutes_reason_manual.trim(),
      project_real_process_minutes_manual: toNumberOrNull(form.project_real_process_minutes_manual),
      project_real_process_minutes_reason_manual: form.project_real_process_minutes_reason_manual.trim(),
      project_real_lead_minutes_manual: toNumberOrNull(form.project_real_lead_minutes_manual),
      project_real_lead_minutes_reason_manual: form.project_real_lead_minutes_reason_manual.trim(),
      start_time_manual: form.start_time_manual.trim() || null,
      end_time_manual: form.end_time_manual.trim() || null,
    }

    setForm("saving", true)
    try {
      await updateProjectManual(projectId, payload)
      showToast({ variant: "success", title: "人工调整已保存" })
      await props.onSaved()
      dialog.close()
    } catch (err) {
      showToast({ variant: "error", title: "保存失败", description: err instanceof Error ? err.message : String(err) })
    } finally {
      setForm("saving", false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Modal
        title="人工调整"
        maxWidth="680px"
        footer={
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => dialog.close()}>取消</Button>
            <Button size="sm" type="submit" disabled={form.saving}>{form.saving ? "保存中..." : "保存"}</Button>
          </>
        }
      >
        <div class="modal-section">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="modal-field">
              <label class="modal-label">传统开发预估(分钟)</label>
              <input class="modal-input" type="number" step="0.1" min="0" value={form.project_ancient_minutes_manual} onInput={(e) => setForm("project_ancient_minutes_manual", e.currentTarget.value)} />
            </div>
            <div class="modal-field">
              <label class="modal-label">实际处理耗时(分钟)</label>
              <input class="modal-input" type="number" step="0.1" min="0" value={form.project_real_process_minutes_manual} onInput={(e) => setForm("project_real_process_minutes_manual", e.currentTarget.value)} />
            </div>
          </div>
        </div>
        <div class="modal-section">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="modal-field">
              <label class="modal-label">传统开发预估理由</label>
              <textarea class="modal-input" value={form.project_ancient_minutes_reason_manual} onInput={(e) => setForm("project_ancient_minutes_reason_manual", e.currentTarget.value)} />
            </div>
            <div class="modal-field">
              <label class="modal-label">实际处理耗时理由</label>
              <textarea class="modal-input" value={form.project_real_process_minutes_reason_manual} onInput={(e) => setForm("project_real_process_minutes_reason_manual", e.currentTarget.value)} />
            </div>
          </div>
        </div>
        <div class="modal-section">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="modal-field">
              <label class="modal-label">项目周期(分钟)</label>
              <input class="modal-input" type="number" step="0.1" min="0" value={form.project_real_lead_minutes_manual} onInput={(e) => setForm("project_real_lead_minutes_manual", e.currentTarget.value)} />
            </div>
            <div class="modal-field">
              <label class="modal-label">项目周期理由</label>
              <textarea class="modal-input" value={form.project_real_lead_minutes_reason_manual} onInput={(e) => setForm("project_real_lead_minutes_reason_manual", e.currentTarget.value)} />
            </div>
          </div>
        </div>
        <div class="modal-section">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="modal-field">
              <label class="modal-label">开始时间</label>
              <input class="modal-input" type="datetime-local" value={form.start_time_manual ? form.start_time_manual.slice(0, 16) : ""} onInput={(e) => setForm("start_time_manual", e.currentTarget.value)} />
            </div>
            <div class="modal-field">
              <label class="modal-label">结束时间</label>
              <input class="modal-input" type="datetime-local" value={form.end_time_manual ? form.end_time_manual.slice(0, 16) : ""} onInput={(e) => setForm("end_time_manual", e.currentTarget.value)} />
            </div>
          </div>
        </div>
      </Modal>
    </form>
  )
}

function EditProjectDialog(props: { project: ProjectDetailResult; onSaved: () => void | Promise<void> }) {
  const dialog = useDialog()
  const [form, setForm] = createStore({ name: props.project.name || "", description: props.project.description || "", saving: false })

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { showToast({ variant: "error", title: "项目名称不能为空" }); return }
    const projectId = props.project.project_id?.trim()
    if (!projectId) return

    setForm("saving", true)
    try {
      await updateProjectV2(projectId, { name: form.name.trim(), description: form.description.trim() })
      showToast({ variant: "success", title: "编辑已保存" })
      await props.onSaved()
      dialog.close()
    } catch (err) {
      showToast({ variant: "error", title: "保存失败", description: err instanceof Error ? err.message : String(err) })
    } finally {
      setForm("saving", false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Modal title="编辑项目" maxWidth="500px" footer={<><Button variant="outline" size="sm" type="button" onClick={() => dialog.close()}>取消</Button><Button size="sm" type="submit" disabled={form.saving}>{form.saving ? "保存中..." : "保存"}</Button></>}>
        <div class="modal-section">
          <div class="modal-field">
            <label class="modal-label">项目名称</label>
            <input class="modal-input" value={form.name} onInput={(e) => setForm("name", e.currentTarget.value)} />
          </div>
          <div class="modal-field mt-4">
            <label class="modal-label">描述</label>
            <textarea class="modal-input" rows={3} value={form.description} onInput={(e) => setForm("description", e.currentTarget.value)} />
          </div>
        </div>
      </Modal>
    </form>
  )
}

export default function KanbanProjectDetail() {
  const params = useParams()
  const navigate = useNavigate()
  const dialog = useDialog()

  const projectId = createMemo(() => decodeURIComponent(params.projectId ?? "").trim())

  const [data, { refetch }] = createResource(projectId, async (id) => {
    if (!id) return null
    try {
      return await getProjectDetail(id)
    } catch (err) {
      showToast({ variant: "error", title: "项目详情加载失败", description: err instanceof Error ? err.message : String(err) })
      return null
    }
  })

  const [config] = createResource(async () => {
    try { return await getGlobalConfig() } catch { return { traditional_dev_lines_per_day: 100 } as GlobalConfig }
  })

  const project = createMemo(() => data() ?? { repos: [], tasks: [], commits: [], user_count: 0 })
  const tasks = createMemo(() => project().tasks ?? [])
  const commits = createMemo(() => project().commits ?? [])
  const repos = createMemo(() => project().repos ?? [])
  const traditionalDevLinesPerDay = createMemo(() => config()?.traditional_dev_lines_per_day ?? 100)

  const totalTokens = createMemo(() => (project().upstream_tokens ?? 0) + (project().downstream_tokens ?? 0))
  const totalCodeLines = createMemo(() => commits().reduce((sum, c) => sum + (c.diff_lines ?? 0), 0))

  const actualWorkDays = createMemo(() => {
    const m = project().project_real_process_minutes_manual ?? project().project_real_process_minutes
    return m != null && m > 0 ? m / 480 : null
  })
  const ancientWorkDays = createMemo(() => {
    const m = project().project_ancient_minutes_manual ?? project().project_ancient_minutes
    return m != null && m > 0 ? m / 480 : null
  })
  const leadWorkDays = createMemo(() => {
    const m = project().project_real_lead_minutes_manual ?? project().project_real_lead_minutes
    return m != null && m > 0 ? m / 480 : null
  })
  const actualLinesPerDay = createMemo(() => actualWorkDays() && actualWorkDays()! > 0 ? totalCodeLines() / actualWorkDays()! : null)
  const traditionalLinesPerDay = createMemo(() => ancientWorkDays() && ancientWorkDays()! > 0 ? totalCodeLines() / ancientWorkDays()! : null)
  const devEfficiencyRatio = createMemo(() => ancientWorkDays() && actualWorkDays() && actualWorkDays()! > 0 ? ancientWorkDays()! / actualWorkDays()! : null)
  const e2eEfficiencyRatio = createMemo(() => ancientWorkDays() && leadWorkDays() && leadWorkDays()! > 0 ? ancientWorkDays()! / leadWorkDays()! : null)

  const userStats = createMemo<ProjectUserStat[]>(() => {
    const map: Record<string, ProjectUserStat> = {}
    for (const t of tasks()) {
      const name = t.user_name || "未知"
      if (!map[name]) map[name] = { user_name: name, task_count: 0, commit_count: 0, commit_diff_lines: 0, task_ancient_minutes: 0, task_real_minutes: 0, commit_ancient_minutes: 0, commit_real_minutes: 0, cost: 0, task_efficiency_ratio: 0, commit_efficiency_ratio: 0 }
      map[name].task_count++
      map[name].task_ancient_minutes += (t.task_ancient_minutes_manual ?? t.task_ancient_minutes) ?? 0
      map[name].task_real_minutes += (t.task_real_minutes_manual ?? t.task_real_minutes) ?? 0
      map[name].cost += t.cost ?? 0
    }
    for (const c of commits()) {
      const name = c.user_name || "未知"
      if (!map[name]) map[name] = { user_name: name, task_count: 0, commit_count: 0, commit_diff_lines: 0, task_ancient_minutes: 0, task_real_minutes: 0, commit_ancient_minutes: 0, commit_real_minutes: 0, cost: 0, task_efficiency_ratio: 0, commit_efficiency_ratio: 0 }
      map[name].commit_count++
      map[name].commit_diff_lines += c.diff_lines ?? 0
      map[name].commit_ancient_minutes += (c.commit_ancient_minutes_manual ?? c.commit_ancient_minutes) ?? 0
      map[name].commit_real_minutes += (c.commit_real_minutes_manual ?? c.commit_real_minutes) ?? 0
      map[name].cost += c.cost ?? 0
    }
    return Object.values(map).map((u) => ({
      ...u,
      task_efficiency_ratio: u.task_real_minutes > 0 ? (u.task_ancient_minutes / u.task_real_minutes) * 100 : 0,
      commit_efficiency_ratio: u.commit_real_minutes > 0 ? (u.commit_ancient_minutes / u.commit_real_minutes) * 100 : 0,
    }))
  })

  const openManual = () => dialog.show(() => <ManualDialog project={project()} onSaved={() => void refetch()} />)
  const openEdit = () => dialog.show(() => <EditProjectDialog project={project()} onSaved={() => void refetch()} />)

  const handleRemoveRepo = async (index: number) => {
    if (!confirm("确定要删除此 Repo 配置吗？")) return
    const id = projectId()
    if (!id) return
    try {
      await removeRepoFromProject(id, index)
      showToast({ variant: "success", title: "删除成功" })
      await refetch()
    } catch (err) { showToast({ variant: "error", title: "删除失败", description: err instanceof Error ? err.message : String(err) }) }
  }

  const handleRemoveTask = async (taskId: string) => {
    if (!confirm("确定要删除此 Task 吗？")) return
    const id = projectId()
    if (!id) return
    try {
      await removeTasksFromProject(id, [taskId])
      showToast({ variant: "success", title: "删除成功" })
      await refetch()
    } catch (err) { showToast({ variant: "error", title: "删除失败", description: err instanceof Error ? err.message : String(err) }) }
  }

  const handleUpdateSilica = async (taskId: string, silica: number) => {
    const id = projectId()
    if (!id) return
    const val = prompt("请输入 Silica 权重:", String(silica))
    if (val === null) return
    const num = Number(val)
    if (Number.isNaN(num)) { showToast({ variant: "error", title: "请输入有效数字" }); return }
    try {
      await updateTaskSilicaInProject(id, { task_id: taskId, silica: num })
      showToast({ variant: "success", title: "修改成功" })
      await refetch()
    } catch (err) { showToast({ variant: "error", title: "修改失败", description: err instanceof Error ? err.message : String(err) }) }
  }

  return (
    <div class="flex min-h-full min-w-0 flex-col gap-6 overflow-y-auto overflow-x-clip p-[clamp(1rem,2vw,2rem)]">
      <header class="mx-auto flex w-full max-w-[1320px] flex-col gap-3">
        <A href="/kanban/project" class="inline-flex items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)]">
          <span>←</span>
          <span>返回项目列表</span>
        </A>
        <div class="flex flex-col gap-4 rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--native-success)]">Kanban / Project Detail</p>
            <h1 class="mt-2 font-[var(--native-font-display)] text-[1.875rem] leading-[1.02] font-semibold tracking-[-0.05em] text-[var(--native-foreground)]">{project().name || "项目详情"}</h1>
            <Show when={project().description}><p class="mt-1 text-sm text-[var(--native-muted)]">{project().description}</p></Show>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" size="sm" onClick={openManual} disabled={!project().project_id}>人工调整</Button>
            <Button size="sm" onClick={openEdit} disabled={!project().project_id}>编辑</Button>
          </div>
        </div>
      </header>

      <div class="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
        <Show when={!data.loading} fallback={<div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] px-4 py-10 text-sm text-[var(--native-muted)] shadow-[var(--native-shadow-sm)]">加载中...</div>}>
          <Show when={data()} fallback={<div class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] px-4 py-10 text-sm text-[var(--native-muted)] shadow-[var(--native-shadow-sm)]">没有查询到项目详情</div>}>
            {(_) => (
              <>
                {/* 基础信息 */}
                <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
                  <div class="mb-4 text-[1rem] font-semibold text-[var(--native-foreground)]">基础信息</div>
                  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <MetricCard label="项目ID" value={project().project_id || "-"} />
                    <MetricCard label="起始时间" value={formatLocalTime(project().start_time_manual || project().start_time)} />
                    <MetricCard label="结束时间" value={formatLocalTime(project().end_time_manual || project().end_time)} />
                    <MetricCard label="Repo数" value={String(repos().length)} accent="var(--native-primary)" />
                    <MetricCard label="Task数" value={String(tasks().length)} accent="var(--native-success)" />
                    <MetricCard label="Commit数" value={String(commits().length)} accent="var(--native-warning)" />
                    <MetricCard label="参与人数" value={String(project().user_count)} accent="var(--native-info, var(--native-primary))" />
                  </div>
                </section>

                {/* 度量信息 */}
                <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-4 shadow-[var(--native-shadow-sm)]">
                  <div class="mb-4 text-[1rem] font-semibold text-[var(--native-foreground)]">度量信息</div>
                  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <MetricCard label="传统开发预估" value={formatDuration(project().project_ancient_minutes_manual ?? project().project_ancient_minutes)} hint={project().project_ancient_minutes_reason} accent="var(--native-success)" />
                    <MetricCard label="实际处理耗时" value={formatDuration(project().project_real_process_minutes_manual ?? project().project_real_process_minutes)} hint={project().project_real_process_minutes_reason} accent="var(--native-primary)" />
                    <MetricCard label="项目周期" value={formatDuration(project().project_real_lead_minutes_manual ?? project().project_real_lead_minutes)} hint={project().project_real_lead_minutes_reason} accent="var(--native-warning)" />
                    <MetricCard label="总Tokens" value={totalTokens() > 0 ? totalTokens().toLocaleString() : "-"} hint={`上行 ${project().upstream_tokens ?? 0} / 下行 ${project().downstream_tokens ?? 0}`} accent="var(--native-primary)" />
                    <MetricCard label="总费用" value={project().cost != null && project().cost! > 0 ? fmtCost(project().cost) : "-"} accent="var(--native-warning)" />
                    <MetricCard label="生成代码量" value={totalCodeLines() > 0 ? `${totalCodeLines().toLocaleString()} 行` : "-"} accent="var(--native-info, var(--native-primary))" />
                    <MetricCard label="实际人天" value={actualWorkDays() != null ? `${actualWorkDays()!.toFixed(2)} 人天` : "-"} accent="var(--native-primary)" />
                    <MetricCard label="实际人天代码量" value={actualLinesPerDay() != null ? `${Math.round(actualLinesPerDay()!)} 行/人天` : "-"} accent="var(--native-success)" />
                    <MetricCard label="传统开发人天代码量" value={traditionalLinesPerDay() != null ? `${Math.round(traditionalLinesPerDay()!)} 行/人天` : "-"} hint={`企业基准 ${traditionalDevLinesPerDay()} 行/人天`} accent="var(--native-warning)" />
                    <MetricCard label="开发提效比" value={devEfficiencyRatio() != null ? `${Math.round(devEfficiencyRatio()! * 100)}%` : "-"} accent={devEfficiencyRatio() != null && devEfficiencyRatio()! >= 3 ? "var(--native-success)" : "var(--native-primary)"} />
                    <MetricCard label="端到端提效比" value={e2eEfficiencyRatio() != null ? `${Math.round(e2eEfficiencyRatio()! * 100)}%` : "-"} accent={e2eEfficiencyRatio() != null && e2eEfficiencyRatio()! >= 3 ? "var(--native-success)" : "var(--native-primary)"} />
                  </div>
                </section>

                {/* 用户视角 */}
                <Show when={userStats().length > 0}>
                  <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
                    <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                      用户视角 ({userStats().length})
                    </div>
                    <div class="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="min-w-[100px]">用户</TableHead>
                            <TableHead class="min-w-[80px] text-right">Task数</TableHead>
                            <TableHead class="min-w-[80px] text-right">Commit数</TableHead>
                            <TableHead class="min-w-[80px] text-right">代码行数</TableHead>
                            <TableHead class="min-w-[110px] text-right">Task传统预估</TableHead>
                            <TableHead class="min-w-[110px] text-right">Task实际耗时</TableHead>
                            <TableHead class="min-w-[90px] text-center">Task提效比</TableHead>
                            <TableHead class="min-w-[80px] text-right">费用</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={userStats()}>
                            {(row) => (
                              <TableRow>
                                <TableCell>{row.user_name}</TableCell>
                                <TableCell class="text-right tabular-nums">{row.task_count}</TableCell>
                                <TableCell class="text-right tabular-nums">{row.commit_count}</TableCell>
                                <TableCell class="text-right tabular-nums">{row.commit_diff_lines.toLocaleString()}</TableCell>
                                <TableCell class="text-right">{formatDuration(row.task_ancient_minutes)}</TableCell>
                                <TableCell class="text-right">{formatDuration(row.task_real_minutes)}</TableCell>
                                <TableCell class="text-center">{row.task_efficiency_ratio > 0 ? `${row.task_efficiency_ratio.toFixed(1)}%` : "-"}</TableCell>
                                <TableCell class="text-right tabular-nums">{row.cost > 0 ? fmtCost(row.cost) : "-"}</TableCell>
                              </TableRow>
                            )}
                          </For>
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </Show>

                {/* Repos */}
                <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
                  <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                    Repos ({repos().length})
                  </div>
                  <div class="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead class="min-w-[200px]">仓库地址</TableHead>
                          <TableHead class="min-w-[100px]">分支</TableHead>
                          <TableHead class="min-w-[140px]">开始时间</TableHead>
                          <TableHead class="min-w-[140px]">结束时间</TableHead>
                          <TableHead class="min-w-[80px] text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={repos()}>
                          {(row, index) => (
                            <TableRow>
                              <TableCell>
                                <A href={`/kanban/repo/${encodeURIComponent(row.repo_addr ?? "")}${row.repo_branch ? `/${encodeURIComponent(row.repo_branch)}` : ""}`} class="text-[var(--native-primary)] hover:underline">
                                  {row.repo_addr || "-"}
                                </A>
                              </TableCell>
                              <TableCell>{row.repo_branch || "-"}</TableCell>
                              <TableCell>{formatLocalTime(row.start_time)}</TableCell>
                              <TableCell>{formatLocalTime(row.end_time)}</TableCell>
                              <TableCell class="text-right">
                                <button type="button" class="text-sm text-[var(--native-critical,#b24b3b)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => void handleRemoveRepo(index())}>删除</button>
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </div>
                </section>

                {/* Tasks */}
                <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
                  <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                    Tasks ({tasks().length})
                  </div>
                  <div class="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead class="min-w-[100px]">Task ID</TableHead>
                          <TableHead class="min-w-[90px]">用户</TableHead>
                          <TableHead class="min-w-[140px]">开始时间</TableHead>
                          <TableHead class="min-w-[100px] text-right">传统预估</TableHead>
                          <TableHead class="min-w-[100px] text-right">实际耗时</TableHead>
                          <TableHead class="min-w-[80px] text-right">Silica</TableHead>
                          <TableHead class="min-w-[80px] text-right">费用</TableHead>
                          <TableHead class="min-w-[80px] text-center">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <For each={tasks()}>
                          {(row) => (
                            <TableRow>
                              <TableCell>
                                <A href={`/kanban/task/${encodeURIComponent(row.task_id ?? "")}`} class="text-[var(--native-primary)] hover:underline">{shortId(row.task_id)}</A>
                              </TableCell>
                              <TableCell>{row.user_name || "-"}</TableCell>
                              <TableCell>{formatLocalTime(row.start_time)}</TableCell>
                              <TableCell class="text-right">{formatDuration(row.task_ancient_minutes_manual ?? row.task_ancient_minutes)}</TableCell>
                              <TableCell class="text-right">{formatDuration(row.task_real_minutes_manual ?? row.task_real_minutes)}</TableCell>
                              <TableCell class="text-right tabular-nums">{row.silica ?? 1.0}</TableCell>
                              <TableCell class="text-right tabular-nums">{row.cost != null && row.cost > 0 ? fmtCost(row.cost) : "-"}</TableCell>
                              <TableCell class="text-center">
                                <button type="button" class="mr-2 text-sm text-[var(--native-primary)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => void handleUpdateSilica(row.task_id ?? "", row.silica ?? 1.0)}>编辑</button>
                                <button type="button" class="text-sm text-[var(--native-critical,#b24b3b)] transition-colors hover:text-[var(--native-foreground)]" onClick={() => void handleRemoveTask(row.task_id ?? "")}>删除</button>
                              </TableCell>
                            </TableRow>
                          )}
                        </For>
                      </TableBody>
                    </Table>
                  </div>
                </section>

                {/* Commits */}
                <Show when={commits().length > 0}>
                  <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] shadow-[var(--native-shadow-sm)]">
                    <div class="border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3 text-[1rem] font-semibold text-[var(--native-foreground)]">
                      Commits ({commits().length})
                    </div>
                    <div class="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead class="min-w-[100px]">Commit ID</TableHead>
                            <TableHead class="min-w-[90px]">用户</TableHead>
                            <TableHead class="min-w-[140px]">时间</TableHead>
                            <TableHead class="min-w-[180px]">说明</TableHead>
                            <TableHead class="min-w-[80px] text-right">代码行数</TableHead>
                            <TableHead class="min-w-[100px] text-right">传统预估</TableHead>
                            <TableHead class="min-w-[100px] text-right">实际耗时</TableHead>
                            <TableHead class="min-w-[80px] text-center">硅含量</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <For each={commits()}>
                            {(row) => (
                              <TableRow>
                                <TableCell>
                                  <A href={`/kanban/commit/${encodeURIComponent(row.commit_id ?? "")}`} class="text-[var(--native-primary)] hover:underline">{shortId(row.commit_id)}</A>
                                </TableCell>
                                <TableCell>{row.user_name || "-"}</TableCell>
                                <TableCell>{formatLocalTime(row.commit_time)}</TableCell>
                                <TableCell>{row.comment || "-"}</TableCell>
                                <TableCell class="text-right tabular-nums">{row.diff_lines ?? "-"}</TableCell>
                                <TableCell class="text-right">{formatDuration(row.commit_ancient_minutes_manual ?? row.commit_ancient_minutes)}</TableCell>
                                <TableCell class="text-right">{formatDuration(row.commit_real_minutes_manual ?? row.commit_real_minutes)}</TableCell>
                                <TableCell class="text-center">{row.silica != null ? `${row.silica.toFixed(1)}%` : "-"}</TableCell>
                              </TableRow>
                            )}
                          </For>
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                </Show>
              </>
            )}
          </Show>
        </Show>
      </div>
    </div>
  )
}
