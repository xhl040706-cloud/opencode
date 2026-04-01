import { Filesystem } from "@/util/filesystem"
import { homedir } from "node:os"
import path from "node:path"

export const file = path.join(homedir(), ".costrict", "usage-queue.jsonl")

export type Report = {
  session_id: string
  request_id: string
  message_id: string
  date: string
  updated: string
  model_id: string
  provider_id: string
  input_tokens: number
  output_tokens: number
  reasoning_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cost: number
  rounds: number
  git_repo_url: string
  git_worktree: string
  queued_at: number
  retry_count: number
}

export function key(item: Pick<Report, "message_id" | "request_id">) {
  return item.message_id || item.request_id
}

export async function read() {
  if (!(await Filesystem.exists(file))) return [] as Report[]
  return (await Filesystem.readText(file))
    .split(/\r?\n/)
    .flatMap((line) => {
      if (!line.trim()) return []
      try {
        return [JSON.parse(line) as Report]
      } catch {
        return []
      }
    })
}

export async function write(items: Report[]) {
  const text = items.map((item) => JSON.stringify(item)).join("\n")
  await Filesystem.write(file, text ? text + "\n" : "")
}

export async function append(item: Report) {
  const list = await read()
  const id = key(item)
  if (!id) return false
  if (list.some((x) => key(x) === id)) return false
  list.push(item)
  await write(list)
  return true
}
