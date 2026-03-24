import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { createMemo, createResource, For, Show } from "solid-js"
import type { WecomChannel } from "@/context/settings"
import { AddWecomChannelDialog } from "./add-wecom-channel-dialog"
import { WecomChannelCard } from "./wecom-channel-card"
import { notificationChannelService } from "../lib/notification-channel-service"

export function NotificationChannelsSection() {
  const dialog = useDialog()
  const [channels, { mutate, refetch }] = createResource(async () => notificationChannelService.listWecom())

  const wecomChannels = createMemo(() => channels() ?? [])

  const openAddDialog = () => {
    dialog.show(() => (
      <AddWecomChannelDialog
        onCreated={async (payload) => {
          const created = await notificationChannelService.createWecom(payload)
          mutate((list) => [created, ...(list ?? [])])
          showToast({ variant: "success", icon: "circle-check", title: "通知渠道已创建" })
        }}
      />
    ))
  }

  const handleUpdate = async (id: string, patch: Partial<WecomChannel>) => {
    const current = wecomChannels()
    const target = current.find((item) => item.id === id)
    if (!target) return
    const optimistic: WecomChannel = {
      ...target,
      ...patch,
      events: {
        ...target.events,
        ...(patch.events ?? {}),
      },
    }
    mutate((list) => (list ?? []).map((item) => (item.id === id ? optimistic : item)))
    try {
      const updated = await notificationChannelService.updateWecom(id, patch)
      mutate((list) => (list ?? []).map((item) => (item.id === id ? updated : item)))
    } catch (error) {
      mutate(current)
      showToast({
        variant: "error",
        icon: "circle-x",
        title: "通知渠道更新失败",
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleRemove = async (id: string) => {
    const current = wecomChannels()
    mutate((list) => (list ?? []).filter((item) => item.id !== id))
    try {
      await notificationChannelService.removeWecom(id)
      showToast({ variant: "success", icon: "circle-check", title: "通知渠道已删除" })
    } catch (error) {
      mutate(current)
      showToast({
        variant: "error",
        icon: "circle-x",
        title: "通知渠道删除失败",
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleTest = async (id: string) => {
    try {
      const res = await notificationChannelService.testWecom(id)
      showToast({
        variant: "success",
        icon: "circle-check",
        title: "测试消息已发送",
        description: res.message || "请查看企微机器人群是否收到消息",
      })
    } catch (error) {
      showToast({
        variant: "error",
        icon: "circle-x",
        title: "测试发送失败",
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <section class="rounded-2xl border border-border-weak-base bg-surface-raised-base p-5">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-text-strong">通知渠道</h2>
          <p class="mt-1 text-sm text-text-weak">配置企业微信机器人，接收 Agent 事件推送</p>
        </div>
        <Button size="small" variant="ghost" class="border border-border-weak-base" onClick={openAddDialog}>
          添加渠道
        </Button>
      </div>

      <Show when={!channels.loading} fallback={<div class="text-sm text-text-weak">加载通知渠道中...</div>}>
        <Show
          when={wecomChannels().length > 0}
          fallback={
            <div class="rounded-xl border border-dashed border-border-weak-base px-8 py-10 text-center text-sm text-text-weak">
              暂无通知渠道，点击「添加渠道」创建企微机器人通知
            </div>
          }
        >
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <For each={wecomChannels()}>
              {(channel) => (
                <WecomChannelCard
                  channel={channel}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  onTest={handleTest}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </section>
  )
}
