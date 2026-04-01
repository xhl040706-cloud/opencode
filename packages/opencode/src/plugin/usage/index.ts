import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { Config } from "@/config/config"
import { MessageV2 } from "@/session/message-v2"
import { MessageID, SessionID } from "@/session/schema"
import { repo } from "./git/repo"
import { enqueue, flush, FLUSH_INTERVAL, BATCH_SIZE } from "./queue/flush"
import { read } from "./queue/jsonl"
import { scan } from "./queue/scan"

let timer: Timer | undefined
let exit: (() => void) | undefined

function day(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

async function enabled() {
  const cfg = await Config.get()
  return cfg.usage?.report !== false
}

async function ingest(msg: MessageV2.WithParts, dir: string) {
  if (msg.info.role !== "assistant") return
  if (!msg.info.time.completed) return
  const url = await repo(dir)
  if (!url) return
  const ok = await enqueue({
    session_id: msg.info.sessionID,
    request_id: msg.info.requestID ?? "",
    message_id: msg.info.id,
    date: day(msg.info.time.created),
    updated: day(msg.info.time.completed),
    model_id: msg.info.modelID,
    provider_id: msg.info.providerID,
    input_tokens: msg.info.tokens.input,
    output_tokens: msg.info.tokens.output,
    reasoning_tokens: msg.info.tokens.reasoning,
    cache_read_tokens: msg.info.tokens.cache.read,
    cache_write_tokens: msg.info.tokens.cache.write,
    cost: msg.info.cost,
    rounds: 1,
    git_repo_url: url,
    git_worktree: "",
    queued_at: Date.now(),
    retry_count: 0,
  })
  if (!ok) return
  const list = await read()
  if (list.length >= BATCH_SIZE) await flush()
}

export async function UsagePlugin(input: PluginInput): Promise<Hooks> {
  if (!(await enabled())) return {}
  if (timer) clearInterval(timer)
  if (exit) process.off("beforeExit", exit)
  timer = setInterval(() => void flush(), FLUSH_INTERVAL)
  exit = () => {
    if (timer) clearInterval(timer)
    void flush()
  }
  process.on("beforeExit", exit)
  await scan()
  return {
    event: async (evt) => {
      if (!(await enabled())) return
      if (evt.event.type !== MessageV2.Event.Updated.type) return
      if (evt.event.properties.info.role !== "assistant") return
      const msg = await MessageV2.get({
        sessionID: SessionID.make(evt.event.properties.info.sessionID),
        messageID: MessageID.make(evt.event.properties.info.id),
      })
      await ingest(msg, input.worktree)
    },
  }
}
