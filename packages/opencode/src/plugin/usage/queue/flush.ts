import { Log } from "@/util/log"
import { append, key, read, write, type Report } from "./jsonl"
import { push } from "../report/push"

const log = Log.create({ service: "usage.flush" })

export const BATCH_SIZE = 50
export const MAX_RETRIES = 3
export const FLUSH_INTERVAL = 300_000

let busy = false
const sent = new Set<string>()

export function has(id: string) {
  return sent.has(id)
}

export async function enqueue(item: Report) {
  const id = key(item)
  if (!id || sent.has(id)) return false
  const ok = await append(item)
  if (ok) sent.add(id)
  return ok
}

export async function flush() {
  if (busy) return
  busy = true
  const list = await read()
  const batch = list.filter((item) => item.retry_count < MAX_RETRIES).slice(0, BATCH_SIZE)
  if (batch.length === 0) {
    busy = false
    return
  }
  try {
    await push(batch)
    const done = new Set(batch.map((item) => key(item)).filter(Boolean))
    await write(list.filter((item) => !done.has(key(item))))
  } catch (err) {
    log.warn("usage flush failed", { err })
    const next = list.map((item) =>
      batch.some((entry) => key(entry) === key(item)) ? { ...item, retry_count: item.retry_count + 1 } : item,
    )
    await write(next)
  }
  busy = false
}
