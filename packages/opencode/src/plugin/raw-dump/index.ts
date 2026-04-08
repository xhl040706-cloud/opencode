import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { Config } from "@/config/config"
import { Flag } from "@/flag/flag"
import { MessageV2 } from "@/session/message-v2"
import { spawnRawDumpWorker } from "./spawn"

async function enabled() {
  if (Flag.COSTRICT_DISABLE_RAW_DUMP || Flag.OPENCODE_DISABLE_RAW_DUMP) return false
  const cfg = await Config.get()
  return cfg.raw_dump?.enabled !== false
}

export async function RawDumpPlugin(_input: PluginInput): Promise<Hooks> {
  if (!(await enabled())) return {}

  return {
    event: async (evt) => {
      if (!(await enabled())) return
      if (evt.event.type !== MessageV2.Event.Updated.type) return

      const info = evt.event.properties.info
      if (info.role !== "assistant") return
      if (!info.time.completed) return

      spawnRawDumpWorker({
        sessionID: info.sessionID,
        messageID: info.id,
      })
    },
  }
}
