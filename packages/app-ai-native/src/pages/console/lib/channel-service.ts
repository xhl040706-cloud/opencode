import { channelApi, type ChannelConfig } from "@/pages/store/lib/api"

export interface WeComAppConfig {
  userId: string
  [key: string]: string
}

export interface WeComAppChannel extends ChannelConfig {
  config: WeComAppConfig
}

export const channelService = {
  async listWeComApps() {
    const channels = await channelApi.list()
    return channels.filter((ch) => ch.channelType === "wecom") as WeComAppChannel[]
  },

  async getWeComApp(id: string) {
    const res = await channelApi.get(id)
    return {
      ...res.channel,
      config: res.channel.config as WeComAppConfig,
    } as WeComAppChannel
  },

  async createWeComApp(data: { name: string; config: WeComAppConfig }) {
    const res = await channelApi.create({
      channelType: "wecom",
      name: data.name,
      config: data.config,
    })
    return res.channel
  },

  async updateWeComApp(id: string, data: { name?: string; config?: Partial<WeComAppConfig>; enabled?: boolean }) {
    const res = await channelApi.update(id, {
      name: data.name,
      config: data.config ? { userId: data.config.userId! } : undefined,
      enabled: data.enabled,
    })
    return res.channel as WeComAppChannel
  },

  async removeWeComApp(id: string) {
    await channelApi.remove(id)
  },

  async testWeComApp(id: string) {
    await channelApi.test(id)
  },

  async getAvailableTypes() {
    return channelApi.available()
  },
}
