import { promises as fs } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { loadCoStrictCredentials, generateMachineId } from "../provider/credentials"
import { Flag } from "../../flag/flag"
import { Installation } from "../../installation"
import { Log } from "../../util/log"

const log = Log.create({ service: "device-client" })

export interface DeviceInfo {
  device_id: string
  device_token: string
  registered_at: string
  base_url: string
}

export function getDevicePath(): string {
  return join(homedir(), ".costrict", "share", "device.json")
}

export async function loadDevice(): Promise<DeviceInfo | null> {
  try {
    const content = await fs.readFile(getDevicePath(), "utf-8")
    return JSON.parse(content) as DeviceInfo
  } catch (e: any) {
    if (e.code === "ENOENT") return null
    throw e
  }
}

async function saveDevice(info: DeviceInfo): Promise<void> {
  const dir = join(homedir(), ".costrict", "share")
  await fs.mkdir(dir, { recursive: true, mode: 0o755 })
  await fs.writeFile(getDevicePath(), JSON.stringify(info, null, 2), { encoding: "utf-8", mode: 0o600 })
}

function getCloudBaseUrl(credBaseUrl?: string): string {
  return Flag.COSTRICT_CLOUD_BASE_URL || credBaseUrl || Flag.COSTRICT_BASE_URL || "https://zgsm.sangfor.com"
}

export async function register(): Promise<DeviceInfo> {
  const existing = await loadDevice()
  if (existing) {
    log.info("device already registered, reusing", { device_id: existing.device_id })
    return existing
  }

  const creds = await loadCoStrictCredentials()
  if (!creds?.access_token) throw new Error("Not logged in. Please run `cs auth login` first.")

  const baseUrl = getCloudBaseUrl(creds.base_url)
  const deviceId = generateMachineId()

  const res = await fetch(`${baseUrl}/api/devices/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.access_token}`,
    },
    body: JSON.stringify({
      deviceId,
      displayName: require("node:os").hostname(),
      platform: process.platform,
      version: Installation.VERSION,
    }),
  })

  if (res.status === 409) {
    const retry = await loadDevice()
    if (retry) {
      log.info("device already registered on server, reusing local", { device_id: retry.device_id })
      return retry
    }
    throw new Error("Device already registered on server but local device.json is missing. Please contact support.")
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Device registration failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { device: { deviceId: string }; token: string }
  const info: DeviceInfo = {
    device_id: data.device.deviceId,
    device_token: data.token,
    registered_at: new Date().toISOString(),
    base_url: baseUrl,
  }

  await saveDevice(info)
  log.info("device registered", { device_id: info.device_id })
  return info
}

export async function rotateToken(): Promise<string> {
  const device = await loadDevice()
  if (!device) throw new Error("Device not registered. Run `cs device start` first.")

  const res = await fetch(`${device.base_url}/api/devices/${device.device_id}/token/rotate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${device.device_token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Token rotation failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { token: string }
  device.device_token = data.token
  await saveDevice(device)
  log.info("device token rotated", { device_id: device.device_id })
  return data.token
}
