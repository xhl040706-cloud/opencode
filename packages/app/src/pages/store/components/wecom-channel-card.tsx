import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Switch } from "@opencode-ai/ui/switch"
import { createSignal, Show } from "solid-js"
import { type WecomChannel } from "@/context/settings"

type WecomChannelCardProps = {
  channel: WecomChannel
  onEdit: (channel: WecomChannel) => void
  onUpdate: (id: string, patch: Partial<WecomChannel>) => Promise<void> | void
  onRemove: (id: string) => Promise<void> | void
  onTest: (id: string) => Promise<void> | void
}

export function WecomChannelCard(props: WecomChannelCardProps) {
  const [testing, setTesting] = createSignal(false)

  const handleTest = async () => {
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
          <p class="break-all text-sm text-text-strong">{props.channel.webhook || "—"}</p>
        </div>
      </div>

      <div class="flex flex-col gap-2 px-4 py-2">
        <span class="text-xs font-medium text-text-weak">通知事件</span>
        <div class="flex flex-wrap gap-2">
          <Show when={props.channel.events.agent}>
            <span class="rounded-full bg-surface-info-base/20 px-2.5 py-0.5 text-xs text-text-strong">Agent</span>
          </Show>
          <Show when={props.channel.events.permissions}>
            <span class="rounded-full bg-surface-info-base/20 px-2.5 py-0.5 text-xs text-text-strong">权限请求</span>
          </Show>
          <Show when={props.channel.events.errors}>
            <span class="rounded-full bg-surface-info-base/20 px-2.5 py-0.5 text-xs text-text-strong">错误通知</span>
          </Show>
          <Show when={!props.channel.events.agent && !props.channel.events.permissions && !props.channel.events.errors}>
            <span class="text-xs text-text-weak">无</span>
          </Show>
        </div>
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
          <Button size="small" variant="ghost" class="border border-border-weak-base" onClick={() => props.onEdit(props.channel)}>
            编辑
          </Button>

          <Button
            size="small"
            variant="ghost"
            class="border border-border-weak-base"
            disabled={!props.channel.enabled || testing()}
            onClick={handleTest}
          >
            {testing() ? "测试中..." : "测试"}
          </Button>
        </div>
      </div>
    </div>
  )
}
