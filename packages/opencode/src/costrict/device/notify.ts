import { Log } from "../../util/log"

const log = Log.create({ service: "device-notify" })

export interface InterventionPayload {
  type: "permission" | "question" | "idle"
  sessionID: string
  data: any
}

let _baseUrl: string | null = null
let _deviceToken: string | null = null
let _deviceId: string | null = null
let _path: string | null = null

export function initCloudNotifier(baseUrl: string, deviceToken: string, deviceId: string, path: string) {
  _baseUrl = baseUrl
  _deviceToken = deviceToken
  _deviceId = deviceId
  _path = path
  log.info("cloud notifier initialized", { deviceId, path: path })
}

export async function notifyCloud(payload: InterventionPayload): Promise<void> {
  if (!_baseUrl || !_deviceToken || !_deviceId) return

  const url = `${_baseUrl}/cloud/device/notify`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_deviceToken}`,
      },
      body: JSON.stringify({
        deviceID: _deviceId,
        path: _path,
        type: payload.type,
        sessionID: payload.sessionID,
        data: payload.data,
      }),
    })
    if (!res.ok) {
      log.warn("cloud notify failed", { status: res.status })
    }
  } catch (e: any) {
    log.warn("cloud notify error", { error: e.message })
  }
}
