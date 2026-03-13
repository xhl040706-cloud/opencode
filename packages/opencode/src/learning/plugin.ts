import type { Plugin, Hooks } from "@opencode-ai/plugin"
import { Log } from "@/util/log"
import { LearningDetector } from "./detector"
import { LearningPromoter } from "./promoter"
import { ConversationHooks, SessionEndHooks } from "./hooks"

const log = Log.create({ service: "learning.plugin" })

/**
 * Learning system plugin
 * Integrates with the plugin system to enable learning detection
 */
export const LearningPlugin: Plugin = (input) => {
  log.info("initializing learning plugin", { directory: input.directory })

  const hooks: Hooks = {}

  // Register conversation hooks
  const conversationHooks = ConversationHooks.register()
  Object.assign(hooks, conversationHooks)

  // Register session end hooks
  const sessionEndHooks = SessionEndHooks.register()
  Object.assign(hooks, sessionEndHooks)

  // Subscribe detector to bus events
  const unsubDetector = LearningDetector.subscribe()

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

      // Unsubscribe detector
      unsubDetector()

      log.info("learning plugin disposed")
    },
  }
}
