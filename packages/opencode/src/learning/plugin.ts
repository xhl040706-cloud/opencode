import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import { Log } from "@/util/log"
import { LearningPromoter } from "./promoter"
import { ConversationHooks, SessionEndHooks } from "./hooks"

const log = Log.create({ service: "learning.plugin" })

/**
 * Learning system plugin
 * Integrates with the plugin system to enable learning detection
 */
export const LearningPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  log.info("initializing learning plugin", { directory: input.directory })

  // Subscribe to bus events via hooks
  const hooks: Hooks = {}

  // Register conversation hooks
  const conversationHooks = ConversationHooks.register()
  Object.assign(hooks, conversationHooks)

  // Register session end hooks
  const sessionEndHooks = SessionEndHooks.register()
  Object.assign(hooks, sessionEndHooks)

  // Run periodic check on init
  LearningPromoter.runPeriodicCheck("project").catch((err) => {
    log.warn("failed to run periodic check on init", { err })
  })

  return {
    name: "learning",
    ...hooks,
    async dispose() {
      // Run final promotion check
      await LearningPromoter.runPeriodicCheck("project")

      log.info("learning plugin disposed")
    },
  }
}
