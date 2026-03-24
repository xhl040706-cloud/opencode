import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import { For, Show } from "solid-js"
import { useSettings } from "@/context/settings"
import { AddWecomChannelDialog } from "./add-wecom-channel-dialog"
import { WecomChannelCard } from "./wecom-channel-card"

export function NotificationChannelsSection() {
  const settings = useSettings()
  const dialog = useDialog()

  const openAddDialog = () => {
    dialog.show(() => <AddWecomChannelDialog onCreated={(ch) => settings.channels.addWecom(ch)} />)
  }

  return (
    <section class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-5">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-text-strong">通知渠道</h2>
          <p class="mt-1 text-sm text-text-weak">配置企业微信机器人，接收 Agent 事件推送</p>
        </div>
        <Button size="small" variant="ghost" class="border border-border-weak-base" onClick={openAddDialog}>
          <Icon name="plus" class="size-4" />
          添加渠道
        </Button>
      </div>

      <Show
        when={settings.channels.wecom().length > 0}
        fallback={
          <div class="rounded-xl border border-dashed border-border-weak-base px-8 py-10 text-center text-sm text-text-weak">
            暂无通知渠道，点击「添加渠道」创建企微机器人通知
          </div>
        }
      >
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <For each={settings.channels.wecom()}>
            {(channel) => (
              <WecomChannelCard
                channel={channel}
                onUpdate={(id, patch) => settings.channels.updateWecom(id, patch)}
                onRemove={(id) => settings.channels.removeWecom(id)}
              />
            )}
          </For>
        </div>
      </Show>
    </section>
  )
}
