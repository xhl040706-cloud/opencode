import { promises as fs } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { loadCoStrictCredentials } from "../provider/credentials"
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

const CLOUD_API_PREFIX = "cloud-api"

export function getCloudBaseUrl(credBaseUrl?: string): string {
  const raw = (Flag.COSTRICT_CLOUD_BASE_URL || credBaseUrl || Flag.COSTRICT_BASE_URL || "https://zgsm.sangfor.com").replace(/\/$/, "")
  if (raw.endsWith(`/${CLOUD_API_PREFIX}`)) return raw
  if (Flag.COSTRICT_CLOUD_BASE_URL) return raw
  const base = raw
  return `${base}/${CLOUD_API_PREFIX}`
}

export function getCloudApiUrl(path: string, baseUrl?: string) {
  const base = getCloudBaseUrl(baseUrl)
  const next = path.startsWith("/") ? path : `/${path}`
  return `${base}${next}`
}

export async function register(): Promise<DeviceInfo> {
  const existing = await loadDevice()
  if (existing) {
    log.info("device already registered, reusing", { device_id: existing.device_id })
    const resolved = getCloudBaseUrl()
    if (resolved !== existing.base_url) {
      existing.base_url = resolved
      log.info("base_url overridden by env", { base_url: resolved })
    }
    return existing
  }

  const creds = await loadCoStrictCredentials()
  if (!creds?.access_token) throw new Error("Not logged in. Please run `cs auth login` first.")

  const baseUrl = getCloudBaseUrl(creds.base_url)
  const deviceId = creds.machine_id

  log.info("registering device", { device_id: deviceId })

  const res = await fetch(getCloudApiUrl("/api/devices/register", baseUrl), {
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
    const body = (await res.json().catch(() => ({}))) as {
      device?: { deviceId: string }
      token?: string
      error?: string
    }

    if (body.token && body.device?.deviceId) {
      const info: DeviceInfo = {
        device_id: body.device.deviceId,
        device_token: body.token,
        registered_at: new Date().toISOString(),
        base_url: baseUrl,
      }
      await saveDevice(info)
      log.info("device already registered by same user, recovered", { device_id: info.device_id })
      return info
    }

    throw new Error(body.error || "Device already registered by another user.")
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

  const res = await fetch(getCloudApiUrl(`/api/devices/${device.device_id}/token/rotate`, device.base_url), {
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
