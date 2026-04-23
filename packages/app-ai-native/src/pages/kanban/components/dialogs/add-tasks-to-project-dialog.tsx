import { createResource, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { Modal } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { addTasksToProject, createProjectOption, loadProjectOptions } from "../../lib/api"
import { formatDuration, formatLocalTime, shortId } from "../../lib/formatters"
import type { TaskRow } from "../../lib/types"

type Props = {
  tasks: TaskRow[]
  onAdded?: () => void | Promise<void>
}

function num(value: string) {
  const txt = value.trim()
  if (!txt) return null
  const next = Number(txt)
  if (Number.isNaN(next)) return null
  return Math.max(0, Math.min(1, next))
}

export function AddTasksToProjectDialog(props: Props) {
  const dialog = useDialog()
  const [state, setState] = createStore({
    selectedProjectId: "",
    newProjectName: "",
    newProjectDesc: "",
    silica: "1",
    saving: false,
  })

  const [projects] = createResource(async () => {
    try {
      return await loadProjectOptions()
    } catch (err) {
      showToast({
        variant: "error",
        title: "加载 Project 列表失败",
        description: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  })

  const createProjectIfNeeded = async () => {
    if (state.selectedProjectId !== "__new__") return state.selectedProjectId
    const name = state.newProjectName.trim()
    if (!name) {
      showToast({ variant: "error", title: "请输入 Project 名称" })
      return ""
    }
    const item = await createProjectOption({
      name,
      description: state.newProjectDesc.trim(),
    })
    return item.project_id
  }

  const submit = async () => {
    const picked = state.selectedProjectId.trim()
    if (!picked) {
      showToast({ variant: "error", title: "请选择目标 Project" })
      return
    }

    const ids = props.tasks.map((item) => item.task_id?.trim() ?? "").filter(Boolean)
    if (!ids.length) {
      showToast({ variant: "error", title: "没有可添加的 Task" })
      return
    }

    const weight = num(state.silica)
    if (weight == null) {
      showToast({ variant: "error", title: "Silica 权重必须是 0 到 1 之间的数字" })
      return
    }

    setState("saving", true)
    try {
      const projectId = await createProjectIfNeeded()
      if (!projectId) return

      await addTasksToProject(projectId, {
        task_ids: ids,
        task_ids_silica: ids.map(() => weight),
      })

      showToast({ variant: "success", title: "已添加到 Project" })
      await props.onAdded?.()
      dialog.close()
    } catch (err) {
      showToast({
        variant: "error",
        title: "添加到 Project 失败",
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setState("saving", false)
    }
  }

  return (
    <Modal
      title="添加到 Project"
      maxWidth="860px"
      maxHeight="calc(100vh - 56px)"
      footer={
        <>
          <Button variant="outline" size="sm" type="button" onClick={() => dialog.close()}>
            取消
          </Button>
          <Button size="sm" type="button" disabled={state.saving} onClick={() => void submit()}>
            {state.saving ? "提交中..." : "确认"}
          </Button>
        </>
      }
    >
      <div class="modal-section">
        <div class="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          <div class="modal-field">
            <label class="modal-label">目标 Project</label>
            <select class="modal-input" value={state.selectedProjectId} onChange={(e) => setState("selectedProjectId", e.currentTarget.value)}>
              <option value="">请选择</option>
              <option value="__new__">+ 新建 Project</option>
              <For each={projects.latest ?? []}>
                {(item) => <option value={item.project_id}>{item.name}</option>}
              </For>
            </select>
          </div>

          <div class="modal-field">
            <label class="modal-label">Silica 权重</label>
            <input class="modal-input" value={state.silica} onInput={(e) => setState("silica", e.currentTarget.value)} placeholder="0 ~ 1" />
          </div>
        </div>

        <Show when={state.selectedProjectId === "__new__"}>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="modal-field">
              <label class="modal-label">名称</label>
              <input class="modal-input" value={state.newProjectName} onInput={(e) => setState("newProjectName", e.currentTarget.value)} placeholder="Project 名称" />
            </div>
            <div class="modal-field">
              <label class="modal-label">描述</label>
              <input class="modal-input" value={state.newProjectDesc} onInput={(e) => setState("newProjectDesc", e.currentTarget.value)} placeholder="Project 描述（可选）" />
            </div>
          </div>
        </Show>
      </div>

      <div class="modal-section">
        <div class="modal-section-title">已选 Tasks</div>
        <div class="modal-section-desc">将按统一的 silica 权重写入 kanban 自己的 project 体系，不会接到主产品 projects 模块。</div>
        <div class="max-h-[360px] overflow-auto rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-24">Task ID</TableHead>
                <TableHead>说明</TableHead>
                <TableHead class="w-28">用户</TableHead>
                <TableHead class="w-40">时间</TableHead>
                <TableHead class="w-28 text-right">实际耗时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <For each={props.tasks}>
                {(item) => (
                  <TableRow>
                    <TableCell>{shortId(item.task_id, 6)}</TableCell>
                    <TableCell>{item.title || "-"}</TableCell>
                    <TableCell>{item.user_name || item.user_id || "-"}</TableCell>
                    <TableCell>{formatLocalTime(item.start_time)}</TableCell>
                    <TableCell class="text-right">{formatDuration(item.task_real_minutes_manual ?? item.task_real_minutes)}</TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </div>
      </div>
    </Modal>
  )
}

export default AddTasksToProjectDialog