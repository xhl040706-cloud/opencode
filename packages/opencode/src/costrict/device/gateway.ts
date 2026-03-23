import { type DeviceInfo } from "./client"
import { Log } from "../../util/log"

const log = Log.create({ service: "device-gateway" })

let _cachedGatewayURL: string | null = null

export function clearGatewayCache() {
  _cachedGatewayURL = null
}

const GATEWAY_TIMEOUT_MS = 10_000

export async function assignGateway(device: DeviceInfo): Promise<string> {
  if (_cachedGatewayURL) return _cachedGatewayURL

  const base = process.env["COSTRICT_CLOUD_BASE_URL"] || process.env["COSTRICT_BASE_URL"] || device.base_url
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS)
  const res = await fetch(`${base}/cloud/device/gateway-assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${device.device_token}`,
    },
    body: JSON.stringify({ deviceID: device.device_id }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`gateway-assign failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { gatewayURL: string }
  _cachedGatewayURL = data.gatewayURL
  log.info("gateway assigned", { gatewayURL: _cachedGatewayURL })
  return _cachedGatewayURL
}
