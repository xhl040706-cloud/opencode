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
  onUpdate: (id: string, patch: Partial<WecomChannel>) => void
  onRemove: (id: string) => void
}

export function WecomChannelCard(props: WecomChannelCardProps) {
  const [editing, setEditing] = createSignal(false)
  const [draft, setDraft] = createSignal(props.channel.webhook)
  const [draftKey, setDraftKey] = createSignal(props.channel.webhookKey)
  const [saving, setSaving] = createSignal(false)

  const effectiveWebhook = () => {
    const key = draftKey().trim()
    if (!key) return draft()
    return `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`
  }

  const handleEdit = () => {
    // 进入编辑时同步最新值
    setDraft(props.channel.webhook)
    setDraftKey(props.channel.webhookKey)
    setEditing(true)
  }

  const handleCancel = () => {
    setDraft(props.channel.webhook)
    setDraftKey(props.channel.webhookKey)
    setEditing(false)
  }

  const handleSave = () => {
    setSaving(true)
    // TODO: 对接后台保存接口
    props.onUpdate(props.channel.id, {
      webhook: draft().trim(),
      webhookKey: draftKey().trim(),
    })
    setSaving(false)
    setEditing(false)
    showToast({ variant: "success", icon: "circle-check", title: "保存成功" })
  }

  const handleTest = () => {
    // TODO: 对接后台测试接口（使用 effectiveWebhook()）
    void effectiveWebhook()
    showToast({
      variant: "success",
      icon: "circle-check",
      title: "测试消息已发送",
      description: "请查看企微机器人群是否收到消息",
    })
  }

  return (
    <div class="rounded-xl border border-border-weak-base bg-surface-raised-base overflow-hidden">
      {/* 卡片头部 */}
      <div class="flex items-center justify-between px-4 py-3 border-b border-border-weak-base">
        <span class="text-sm font-medium text-text-strong">{props.channel.name}</span>
        <div class="flex items-center gap-3">
          <Switch
            checked={props.channel.enabled}
            onChange={(checked) => props.onUpdate(props.channel.id, { enabled: checked })}
          />
          <Show
            when={!editing()}
            fallback={
              <button
                class="text-text-weak hover:text-text-base transition-colors"
                onClick={handleCancel}
                title="取消编辑"
              >
                <Icon name="close" size="small" />
              </button>
            }
          >
            <button
              class="text-text-weak hover:text-text-base transition-colors"
              onClick={handleEdit}
              title="编辑渠道"
            >
              <Icon name="edit" size="small" />
            </button>
          </Show>
          <button
            class="text-text-weak hover:text-text-danger transition-colors"
            onClick={() => {
              if (window.confirm(`确定删除渠道「${props.channel.name}」吗？`)) {
                props.onRemove(props.channel.id)
              }
            }}
            title="删除渠道"
          >
            <Icon name="trash" size="small" />
          </button>
        </div>
      </div>

      {/* Webhook URL + Key */}
      <div class="px-4 pt-3 pb-2 flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-text-weak">Webhook URL</span>
          <Show
            when={editing()}
            fallback={<p class="text-sm text-text-strong break-all">{props.channel.webhook || "—"}</p>}
          >
            <TextField
              value={draft()}
              onChange={(val) => setDraft(val)}
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
              disabled={!props.channel.enabled}
            />
          </Show>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-text-weak">WECOM_WEBHOOK_KEY</span>
          <Show
            when={editing()}
            fallback={
              <p class="text-sm text-text-strong font-mono">
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

      {/* 通知事件 */}
      <div class="px-4 py-2 flex flex-col gap-2">
        <span class="text-xs font-medium text-text-weak">通知事件</span>
        <Checkbox
          checked={props.channel.events.agent}
          disabled={!props.channel.enabled}
          onChange={(checked) =>
            props.onUpdate(props.channel.id, {
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
            props.onUpdate(props.channel.id, {
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
            props.onUpdate(props.channel.id, {
              events: { ...props.channel.events, errors: checked },
            })
          }
        >
          错误通知
        </Checkbox>
      </div>

      {/* 操作按钮 */}
      <div class="flex justify-end gap-2 px-4 py-3 border-t border-border-weak-base">
        <Button
          size="small"
          variant="ghost"
          class="border border-border-weak-base"
          disabled={!props.channel.enabled}
          onClick={handleTest}
        >
          测试
        </Button>
        <Show when={editing()}>
          <Button
            size="small"
            variant="ghost"
            class="border border-border-weak-base"
            disabled={saving() || !props.channel.enabled}
            onClick={handleSave}
          >
            {saving() ? "保存中..." : "保存"}
          </Button>
        </Show>
      </div>
    </div>
  )
}
