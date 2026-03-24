import { Button } from "@opencode-ai/ui/button"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { createStore } from "solid-js/store"
import { type WecomChannel } from "@/context/settings"

const inputClass =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none focus:border-border-strong"

type EditWecomChannelDialogProps = {
  channel: WecomChannel
  onSaved: (id: string, patch: Partial<WecomChannel>) => Promise<void> | void
}

export function EditWecomChannelDialog(props: EditWecomChannelDialogProps) {
  const dialog = useDialog()
  const [form, setForm] = createStore({
    name: props.channel.name,
    webhook: props.channel.webhook,
    events: {
      agent: props.channel.events.agent,
      permissions: props.channel.events.permissions,
      errors: props.channel.events.errors,
    },
    error: "",
    saving: false,
  })

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setForm("error", "请填写渠道名称")
      return
    }
    if (!form.webhook.trim()) {
      setForm("error", "请填写 Webhook URL")
      return
    }
    setForm("error", "")
    setForm("saving", true)
    try {
      const patch: Partial<WecomChannel> = {}
      if (form.name.trim() !== props.channel.name) {
        patch.name = form.name.trim()
      }
      if (form.webhook.trim() !== props.channel.webhook) {
        patch.webhook = form.webhook.trim()
      }
      if (
        form.events.agent !== props.channel.events.agent ||
        form.events.permissions !== props.channel.events.permissions ||
        form.events.errors !== props.channel.events.errors
      ) {
        patch.events = {
          agent: form.events.agent,
          permissions: form.events.permissions,
          errors: form.events.errors,
        }
      }
      await props.onSaved(props.channel.id, patch)
      dialog.close()
    } finally {
      setForm("saving", false)
    }
  }

  return (
    <Dialog title="编辑企微通知渠道" class="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} class="flex flex-col">
        <div class="flex flex-col gap-4 px-6 py-4">
          <div>
            <label class="mb-1.5 block text-xs font-medium text-text-strong">
              渠道名称 <span class="text-icon-info-base">*</span>
            </label>
            <input
              autofocus
              value={form.name}
              onInput={(e) => setForm("name", e.currentTarget.value)}
              placeholder="例：研发报警群机器人"
              class={inputClass}
            />
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-medium text-text-strong">
              Webhook URL <span class="text-icon-info-base">*</span>
            </label>
            <input
              value={form.webhook}
              onInput={(e) => setForm("webhook", e.currentTarget.value)}
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
              class={inputClass}
            />
          </div>
          <div>
            <label class="mb-2 block text-xs font-medium text-text-strong">通知事件</label>
            <div class="flex flex-col gap-2 text-sm text-text-strong">
              <Checkbox
                checked={form.events.agent}
                onChange={(checked) => setForm("events", "agent", checked)}
              >
                Agent（完成 / 需要关注）
              </Checkbox>
              <Checkbox
                checked={form.events.permissions}
                onChange={(checked) => setForm("events", "permissions", checked)}
              >
                权限请求
              </Checkbox>
              <Checkbox
                checked={form.events.errors}
                onChange={(checked) => setForm("events", "errors", checked)}
              >
                错误通知
              </Checkbox>
            </div>
          </div>
          {form.error && <p class="text-xs text-icon-critical-base">{form.error}</p>}
        </div>
        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-border-weak-base bg-surface-base px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => dialog.close()}>
            取消
          </Button>
          <Button type="submit" disabled={form.saving}>
            {form.saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
