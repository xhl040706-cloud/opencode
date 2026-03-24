import type { WecomChannel } from "@/context/settings"
import { env } from "@/lib/env"
import { notificationChannelApi, type WecomChannelPayload } from "./api"

export const NOTIFICATION_CHANNEL_USE_MOCK = true

const nowId = () => `wecom-${Date.now()}`
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const MOCK_WECOM_CHANNELS: WecomChannel[] = [
  {
    id: "mock-wecom-1",
    name: "企微机器人",
    webhook: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=mock-key",
    webhookKey: "mock-key",
    enabled: true,
    events: {
      agent: true,
      permissions: true,
      errors: false,
    },
  },
]

function toPayload(channel: Omit<WecomChannel, "id">): WecomChannelPayload {
  return {
    name: channel.name,
    webhook: channel.webhook,
    webhookKey: channel.webhookKey,
    enabled: channel.enabled,
    events: channel.events,
  }
}

let mockChannels = [...MOCK_WECOM_CHANNELS]

const mockNotificationChannelService = {
  async listWecom() {
    await wait(300)
    return [...mockChannels]
  },

  async createWecom(data: Omit<WecomChannel, "id">) {
    await wait(300)
    const channel: WecomChannel = {
      ...data,
      id: nowId(),
    }
    mockChannels = [channel, ...mockChannels]
    return channel
  },

  async updateWecom(channelId: string, patch: Partial<WecomChannel>) {
    await wait(300)
    const current = mockChannels.find((item) => item.id === channelId)
    if (!current) throw new Error("通知渠道不存在")
    const updated: WecomChannel = {
      ...current,
      ...patch,
      events: {
        ...current.events,
        ...(patch.events ?? {}),
      },
    }
    mockChannels = mockChannels.map((item) => (item.id === channelId ? updated : item))
    return updated
  },

  async removeWecom(channelId: string) {
    await wait(300)
    mockChannels = mockChannels.filter((item) => item.id !== channelId)
  },

  async testWecom(channelId: string) {
    await wait(300)
    const current = mockChannels.find((item) => item.id === channelId)
    if (!current) throw new Error("通知渠道不存在")
    return { message: "测试消息已发送" }
  },
}

const realNotificationChannelService = {
  async listWecom() {
    const res = await notificationChannelApi.listWecom()
    return res.channels
  },

  async createWecom(data: Omit<WecomChannel, "id">) {
    const res = await notificationChannelApi.createWecom(toPayload(data))
    return res.channel
  },

  async updateWecom(channelId: string, patch: Partial<WecomChannel>) {
    const res = await notificationChannelApi.updateWecom(channelId, {
      name: patch.name,
      webhook: patch.webhook,
      webhookKey: patch.webhookKey,
      enabled: patch.enabled,
      events: patch.events,
    })
    return res.channel
  },

  async removeWecom(channelId: string) {
    await notificationChannelApi.removeWecom(channelId)
  },

  async testWecom(channelId: string) {
    return notificationChannelApi.testWecom(channelId)
  },
}

export const notificationChannelService = NOTIFICATION_CHANNEL_USE_MOCK
  ? mockNotificationChannelService
  : realNotificationChannelService

export const notificationChannelServiceMeta = {
  useMock: NOTIFICATION_CHANNEL_USE_MOCK,
  apiBase: env.API_URL || env.API_PREFIX || "/",
}
