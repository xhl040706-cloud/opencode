import { type DeviceInfo } from "./client"
import { Log } from "../../util/log"

const log = Log.create({ service: "device-gateway" })

let _cachedGatewayURL: string | null = null

export function clearGatewayCache() {
  _cachedGatewayURL = null
}

export async function assignGateway(device: DeviceInfo): Promise<string> {
  if (_cachedGatewayURL) return _cachedGatewayURL

  const res = await fetch(`${device.base_url}/cloud/device/gateway-assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceID: device.device_id }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`gateway-assign failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { gatewayURL: string }
  _cachedGatewayURL = data.gatewayURL
  log.info("gateway assigned", { gatewayURL: _cachedGatewayURL })
  return _cachedGatewayURL
}
