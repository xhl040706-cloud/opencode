import { env } from "@/lib/env"

const DEMO_DEVICE_IDS = new Set(["demo-device", "preview-device"])

export function getProxyUrl(deviceId: string) {
    // Demo/Preview 设备：使用相对路径，请求打到当前 dev server
    // 由 vite.js 的 localDeviceMockPlugin 返回 mock 数据
    if (import.meta.env.DEV && DEMO_DEVICE_IDS.has(deviceId)) {
      return `/cloud/device/${deviceId}/proxy`
    }
    const appUrl = env.APP_URL
    return `${appUrl}/cloud/device/${deviceId}/proxy`
}
