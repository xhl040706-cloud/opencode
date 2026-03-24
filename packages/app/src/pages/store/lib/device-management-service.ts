import { createMemo } from "solid-js"
import { env } from "@/lib/env"
import type { Device, UpdateDeviceRequest } from "@/pages/workspace/types"
import { deviceApi } from "../lib/api"

export const DEVICE_MANAGEMENT_USE_MOCK = true

const now = () => new Date().toISOString()

const MOCK_DEVICES: Device[] = [
  {
    id: "dev-001",
    deviceId: "mac-abc123",
    displayName: "My Mac",
    platform: "macOS",
    version: "1.2.0",
    userId: "user-001",
    status: "online",
    description: "Personal development machine",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "dev-002",
    deviceId: "win-def456",
    displayName: "Office PC",
    platform: "Windows",
    version: "1.1.0",
    userId: "user-001",
    status: "offline",
    description: "Work computer in office",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "dev-003",
    deviceId: "linux-ghi789",
    displayName: "Server",
    platform: "Linux",
    version: "1.2.0",
    userId: "user-001",
    status: "online",
    description: "Production server for deployment",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "dev-004",
    deviceId: "mac-jkl012",
    displayName: "MacBook Pro",
    platform: "macOS",
    version: "1.2.0",
    userId: "user-001",
    status: "online",
    createdAt: now(),
    updatedAt: now(),
  },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const realDeviceService = {
  async list() {
    const res = await deviceApi.list()
    return res.devices ?? []
  },

  async update(deviceId: string, data: UpdateDeviceRequest) {
    const res = await deviceApi.update(deviceId, data)
    return res.device
  },
}

let mockDevices = [...MOCK_DEVICES]

const mockDeviceService = {
  async list() {
    await wait(300)
    return [...mockDevices]
  },

  async update(deviceId: string, data: UpdateDeviceRequest) {
    await wait(300)
    const current = mockDevices.find((item) => item.id === deviceId)
    if (!current) {
      throw new Error("设备不存在")
    }
    const updated: Device = {
      ...current,
      displayName: data.displayName ?? current.displayName,
      workspaceId: data.workspaceId ?? current.workspaceId,
      updatedAt: now(),
    }
    mockDevices = mockDevices.map((item) => (item.id === deviceId ? updated : item))
    return updated
  },
}

export const deviceManagementService = DEVICE_MANAGEMENT_USE_MOCK ? mockDeviceService : realDeviceService

export function useDeviceManagementMode() {
  return createMemo(() => ({
    useMock: DEVICE_MANAGEMENT_USE_MOCK,
    apiBase: env.API_URL || env.API_PREFIX || "/",
  }))
}
