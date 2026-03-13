import { Bus } from "@/bus"
import { Log } from "@/util/log"
import { LearningDetector } from "../detector"
import { LearningEvent } from "../events"
import type { Hooks } from "@opencode-ai/plugin"

const log = Log.create({ service: "learning.hooks.conversation" })

/**
 * Conversation hooks for learning detection
 * Integrates with the plugin hook system
 */
export namespace ConversationHooks {
  /**
   * Register conversation-related hooks
   */
  export function register(): Partial<Hooks> {
    return {
      // Hook into message events
      event: async (input: { event: any }) => {
        const event = input.event

        // Handle message-related events
        if (event.type?.startsWith("session.") || event.type?.startsWith("message.")) {
          await handleMessageEvent(event)
        }

        // Handle tool output events
        if (event.type?.includes("tool") || event.type?.includes("bash")) {
          await handleToolEvent(event)
        }
      },
    }
  }

  /**
   * Handle message events for learning detection
   */
  async function handleMessageEvent(event: any): Promise<void> {
    try {
      // Detect user corrections and feature requests
      if (event.type === "message.user" || event.properties?.role === "user") {
        const content = extractMessageContent(event)
        if (content) {
          const sessionId = event.properties?.sessionId || event.properties?.sessionID
          const relatedFiles = extractRelatedFiles(event)

          await LearningDetector.processUserMessage(content, sessionId, relatedFiles)
        }
      }
    } catch (err) {
      log.error("failed to process message event", { err })
    }
  }

  /**
   * Handle tool events for error detection
   */
  async function handleToolEvent(event: any): Promise<void> {
    try {
      const output = extractToolOutput(event)
      if (output) {
        const toolName = event.properties?.toolName || event.type
        const sessionId = event.properties?.sessionId || event.properties?.sessionID
        const relatedFiles = extractRelatedFiles(event)

        await LearningDetector.processToolOutput(toolName, output, sessionId, relatedFiles)
      }
    } catch (err) {
      log.error("failed to process tool event", { err })
    }
  }

  /**
   * Extract message content from an event
   */
  function extractMessageContent(event: any): string | undefined {
    if (typeof event.properties?.content === "string") {
      return event.properties.content
    }
    if (typeof event.properties?.message === "string") {
      return event.properties.message
    }
    if (Array.isArray(event.properties?.parts)) {
      return event.properties.parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n")
    }
    return undefined
  }

  /**
   * Extract tool output from an event
   */
  function extractToolOutput(event: any): string | undefined {
    if (typeof event.properties?.output === "string") {
      return event.properties.output
    }
    if (typeof event.properties?.result === "string") {
      return event.properties.result
    }
    if (event.properties?.output?.content) {
      return String(event.properties.output.content)
    }
    return undefined
  }

  /**
   * Extract related files from an event
   */
  function extractRelatedFiles(event: any): string[] | undefined {
    const files: string[] = []

    if (event.properties?.file) {
      files.push(event.properties.file)
    }
    if (event.properties?.filePath) {
      files.push(event.properties.filePath)
    }
    if (Array.isArray(event.properties?.files)) {
      files.push(...event.properties.files)
    }
    if (Array.isArray(event.properties?.relatedFiles)) {
      files.push(...event.properties.relatedFiles)
    }

    return files.length > 0 ? files : undefined
  }
}
