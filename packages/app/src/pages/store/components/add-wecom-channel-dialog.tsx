import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { createStore } from "solid-js/store"
import { type WecomChannel } from "@/context/settings"

const inputClass =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none focus:border-border-strong"

type AddWecomChannelDialogProps = {
  onCreated: (ch: WecomChannel) => void
}

export function AddWecomChannelDialog(props: AddWecomChannelDialogProps) {
  const dialog = useDialog()
  const [form, setForm] = createStore({
    name: "",
    webhook: "",
    webhookKey: "",
    error: "",
  })

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setForm("error", "请填写渠道名称")
      return
    }
    if (!form.webhook.trim()) {
      setForm("error", "请填写 Webhook URL")
      return
    }
    if (!form.webhookKey.trim()) {
      setForm("error", "请填写 WECOM_WEBHOOK_KEY")
      return
    }
    props.onCreated({
      id: `wecom-${Date.now()}`,
      name: form.name.trim(),
      webhook: form.webhook.trim(),
      webhookKey: form.webhookKey.trim(),
      enabled: true,
      events: { agent: true, permissions: true, errors: false },
    })
    dialog.close()
  }

  return (
    <Dialog title="添加企微通知渠道" class="w-full max-w-md mx-auto">
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
            <label class="mb-1.5 block text-xs font-medium text-text-strong">
              WECOM_WEBHOOK_KEY <span class="text-icon-info-base">*</span>
            </label>
            <input
              value={form.webhookKey}
              onInput={(e) => setForm("webhookKey", e.currentTarget.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              class={inputClass}
            />
          </div>
          {form.error && <p class="text-xs text-icon-critical-base">{form.error}</p>}
        </div>
        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-border-weak-base bg-surface-base px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => dialog.close()}>
            取消
          </Button>
          <Button type="submit">确认添加</Button>
        </div>
      </form>
    </Dialog>
  )
}
