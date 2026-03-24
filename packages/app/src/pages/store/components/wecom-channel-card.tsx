import { Button } from "@opencode-ai/ui/button"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { TextField } from "@opencode-ai/ui/text-field"
import { showToast } from "@opencode-ai/ui/toast"
import { createSignal, Show } from "solid-js"
import { type WecomChannel } from "@/context/settings"

type WecomChannelCardProps = {
  channel: WecomChannel
  onUpdate: (id: string, patch: Partial<WecomChannel>) => Promise<void> | void
  onRemove: (id: string) => Promise<void> | void
  onTest: (id: string) => Promise<void> | void
}

export function WecomChannelCard(props: WecomChannelCardProps) {
  const [editing, setEditing] = createSignal(false)
  const [draft, setDraft] = createSignal(props.channel.webhook)
  const [draftKey, setDraftKey] = createSignal(props.channel.webhookKey)
  const [saving, setSaving] = createSignal(false)
  const [testing, setTesting] = createSignal(false)

  const effectiveWebhook = () => {
    const key = draftKey().trim()
    if (!key) return draft()
    return `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`
  }

  const handleEdit = () => {
    setDraft(props.channel.webhook)
    setDraftKey(props.channel.webhookKey)
    setEditing(true)
  }

  const handleCancel = () => {
    setDraft(props.channel.webhook)
    setDraftKey(props.channel.webhookKey)
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await props.onUpdate(props.channel.id, {
        webhook: draft().trim(),
        webhookKey: draftKey().trim(),
      })
      setEditing(false)
      showToast({ variant: "success", icon: "circle-check", title: "保存成功" })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    void effectiveWebhook()
    setTesting(true)
    try {
      await props.onTest(props.channel.id)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div class="overflow-hidden rounded-xl border border-border-weak-base bg-surface-raised-base">
      <div class="flex items-center justify-between border-b border-border-weak-base px-4 py-3">
        <span class="text-sm font-medium text-text-strong">{props.channel.name}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-text-weak">启用</span>
          <Switch
            checked={props.channel.enabled}
            onChange={(checked) => props.onUpdate(props.channel.id, { enabled: checked })}
          />
        </div>
      </div>

      <div class="flex flex-col gap-3 px-4 pt-3 pb-2">
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-text-weak">Webhook URL</span>
          <Show when={editing()} fallback={<p class="break-all text-sm text-text-strong">{props.channel.webhook || "—"}</p>}>
            <TextField
              value={draft()}
              onChange={(val) => setDraft(val)}
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
              disabled={!props.channel.enabled}
            />
          </Show>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-text-weak">Webhook Key</span>
          <Show
            when={editing()}
            fallback={
              <p class="font-mono text-sm text-text-strong">
                {props.channel.webhookKey ? `${props.channel.webhookKey.slice(0, 8)}••••••••` : "—"}
              </p>
            }
          >
            <TextField
              value={draftKey()}
              onChange={(val) => setDraftKey(val)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!props.channel.enabled}
            />
          </Show>
        </div>
      </div>

      <div class="flex flex-col gap-2 px-4 py-2">
        <span class="text-xs font-medium text-text-weak">通知事件</span>
        <Checkbox
          checked={props.channel.events.agent}
          disabled={!props.channel.enabled}
          onChange={(checked) =>
            void props.onUpdate(props.channel.id, {
              events: { ...props.channel.events, agent: checked },
            })
          }
        >
          Agent（完成 / 需要关注）
        </Checkbox>
        <Checkbox
          checked={props.channel.events.permissions}
          disabled={!props.channel.enabled}
          onChange={(checked) =>
            void props.onUpdate(props.channel.id, {
              events: { ...props.channel.events, permissions: checked },
            })
          }
        >
          权限请求
        </Checkbox>
        <Checkbox
          checked={props.channel.events.errors}
          disabled={!props.channel.enabled}
          onChange={(checked) =>
            void props.onUpdate(props.channel.id, {
              events: { ...props.channel.events, errors: checked },
            })
          }
        >
          错误通知
        </Checkbox>
      </div>

      <div class="flex items-center justify-between gap-3 border-t border-border-weak-base px-4 py-3">
        <button
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-weak transition-colors hover:text-text-danger"
          onClick={() => {
            if (window.confirm(`确定删除渠道「${props.channel.name}」吗？`)) {
              void props.onRemove(props.channel.id)
            }
          }}
          title="删除"
        >
          <Icon name="trash" size="small" />
        </button>

        <div class="flex items-center justify-end gap-2">
          <Show
            when={!editing()}
            fallback={
              <Button size="small" variant="ghost" class="border border-border-weak-base" onClick={handleCancel}>
                取消
              </Button>
            }
          >
            <Button size="small" variant="ghost" class="border border-border-weak-base" onClick={handleEdit}>
              编辑
            </Button>
          </Show>

          <Button
            size="small"
            variant="ghost"
            class="border border-border-weak-base"
            disabled={!props.channel.enabled || testing()}
            onClick={handleTest}
          >
            {testing() ? "测试中..." : "测试"}
          </Button>

          <Show when={editing()}>
            <Button
              size="small"
              variant="primary"
              disabled={saving()}
              onClick={handleSave}
            >
              {saving() ? "保存中..." : "保存"}
            </Button>
          </Show>
        </div>
      </div>
    </div>
  )
}
