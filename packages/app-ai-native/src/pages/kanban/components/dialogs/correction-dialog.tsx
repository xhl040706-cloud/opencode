import { createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { Modal } from "@/components/modal"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { submitCorrection, loadCorrectionHistory } from "../../lib/api"
import { formatDay } from "../../lib/date-range"
import type { CorrectionPayload, EfficiencyDimension } from "../../lib/types"

type Props = {
  dimension: EfficiencyDimension
  dimensionId: string
  rawDays?: number | null
  correctedDays?: number | null
  startDate: string
  endDate: string
  onCorrected?: () => void | Promise<void>
}

function fmtDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function CorrectionDialog(props: Props) {
  const dialog = useDialog()
  const [form, setForm] = createStore({
    value: props.correctedDays ?? props.rawDays ?? 0,
    reason: "",
    operator: "",
    saving: false,
  })

  const [history, { refetch }] = createResource(
    () => ({ dimension: props.dimension, dimensionId: props.dimensionId }),
    async (input) => loadCorrectionHistory(input),
  )

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    const payload: CorrectionPayload = {
      dimension: props.dimension,
      dimensionId: props.dimensionId,
      startDate: props.startDate,
      endDate: props.endDate,
      value: Number(form.value),
      reason: form.reason,
      operator: form.operator,
    }

    if (!payload.reason.trim()) {
      showToast({ variant: "error", title: "请填写纠正原因" })
      return
    }
    if (!payload.operator.trim()) {
      showToast({ variant: "error", title: "请填写操作人" })
      return
    }

    setForm("saving", true)
    try {
      await submitCorrection(payload)
      await refetch()
      await props.onCorrected?.()
      showToast({ variant: "success", title: "纠错提交成功" })
      dialog.close()
    } catch (err) {
      showToast({
        variant: "error",
        title: "纠错失败",
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setForm("saving", false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Modal
        title="AI 预估人天纠错"
        maxWidth="720px"
        maxHeight="calc(100vh - 80px)"
        footer={
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => dialog.close()}>
              取消
            </Button>
            <Button size="sm" type="submit" disabled={form.saving}>
              {form.saving ? "提交中..." : "确认提交"}
            </Button>
          </>
        }
      >
        <div class="modal-section">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="modal-field">
              <label class="modal-label">维度</label>
              <input class="modal-input" value={props.dimension} disabled />
            </div>
            <div class="modal-field">
              <label class="modal-label">维度 ID</label>
              <input class="modal-input" value={props.dimensionId} disabled />
            </div>
            <div class="modal-field">
              <label class="modal-label">原始值</label>
              <input class="modal-input" value={props.rawDays == null ? "-" : String(props.rawDays)} disabled />
            </div>
            <div class="modal-field">
              <label class="modal-label">日期范围</label>
              <input class="modal-input" value={`${formatDay(props.startDate)}  To  ${formatDay(props.endDate)}`} disabled />
            </div>
          </div>
        </div>

        <div class="modal-section">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="modal-field">
              <label class="modal-label">纠正值</label>
              <input
                class="modal-input"
                type="number"
                min="0"
                step="0.1"
                value={form.value}
                onInput={(e) => setForm("value", Number(e.currentTarget.value))}
              />
            </div>
            <div class="modal-field">
              <label class="modal-label">操作人</label>
              <input class="modal-input" value={form.operator} onInput={(e) => setForm("operator", e.currentTarget.value)} placeholder="请输入操作人" />
            </div>
          </div>

          <div class="modal-field">
            <label class="modal-label">纠正原因</label>
            <textarea class="modal-input" value={form.reason} onInput={(e) => setForm("reason", e.currentTarget.value)} placeholder="请输入纠正原因" />
          </div>
        </div>

        <div class="modal-section">
          <div class="modal-section-title">纠错历史</div>
          <div class="modal-section-desc">打开弹窗后会自动加载当前维度的纠错历史。</div>
          {history.loading ? (
            <div class="text-sm text-[var(--native-muted)]">加载中...</div>
          ) : history()?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>字段</TableHead>
                  <TableHead>旧值</TableHead>
                  <TableHead>新值</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>操作人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history()!.map((item) => (
                  <TableRow>
                    <TableCell>{fmtDate(item.corrected_at)}</TableCell>
                    <TableCell>{item.field_name || "-"}</TableCell>
                    <TableCell>{item.old_value || "-"}</TableCell>
                    <TableCell>{item.new_value || "-"}</TableCell>
                    <TableCell>{item.reason || "-"}</TableCell>
                    <TableCell>{item.corrected_by || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div class="text-sm text-[var(--native-muted)]">暂无纠错记录</div>
          )}
        </div>
      </Modal>
    </form>
  )
}

export default CorrectionDialog