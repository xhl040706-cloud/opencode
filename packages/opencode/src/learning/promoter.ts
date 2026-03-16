import path from "path"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { LearningStorage } from "./storage"
import { Config } from "@/config/config"
import { LearningEntry, LearningStatus, LearningPriority } from "./types"

const log = Log.create({ service: "learning.promoter" })

/**
 * Learning promotion module
 * Handles progressive promotion of learnings from temporary to permanent storage
 *
 * Promotion path:
 * 1. Temporary learning (LEARNINGS.md) → pending status
 * 2. Resolved learning → can be promoted to MEMORY.md
 * 3. Recurring patterns → candidate skill generation
 */
export namespace LearningPromoter {
  /**
   * Get promotion thresholds from config
   */
  async function getThresholds(): Promise<{
    recurrenceThreshold: number
    priorityThreshold: LearningPriority
  }> {
    try {
      const config = await Config.get()
      const learningConfig = (config as any).learning
      return {
        recurrenceThreshold: learningConfig?.autoPromote?.recurrenceThreshold ?? 3,
        priorityThreshold: learningConfig?.autoPromote?.priorityThreshold ?? "high",
      }
    } catch {
      return {
        recurrenceThreshold: 3,
        priorityThreshold: "high",
      }
    }
  }

  /**
   * Check if a learning should be auto-promoted
   */
  export async function shouldAutoPromote(learning: LearningEntry): Promise<boolean> {
    const thresholds = await getThresholds()

    // Condition 1: Recurring pattern
    if (learning.recurrenceCount >= thresholds.recurrenceThreshold) {
      return true
    }

    // Condition 2: High priority and resolved
    const priorityOrder: LearningPriority[] = ["critical", "high", "medium", "low"]
    const priorityIndex = priorityOrder.indexOf(learning.priority)
    const thresholdIndex = priorityOrder.indexOf(thresholds.priorityThreshold)

    if (priorityIndex <= thresholdIndex && learning.status === "resolved") {
      return true
    }

    return false
  }

  /**
   * Promote a learning to MEMORY.md
   */
  export async function promoteToMemory(learningId: string, scope: "project" | "global" = "project"): Promise<void> {
    try {
      const learnings = await LearningStorage.listLearnings(undefined, scope)
      const learning = learnings.find((l) => l.id === learningId)

      if (!learning) {
        throw new Error(`Learning not found: ${learningId}`)
      }

      // Get or create MEMORY.md
      const memoryDir = LearningStorage.getMemoryDir(scope)
      const memoryPath = path.join(memoryDir, "MEMORY.md")

      let existingContent = ""
      if (await Filesystem.exists(memoryPath)) {
        existingContent = await Filesystem.readText(memoryPath)
      } else {
        existingContent = `# Project Memory

Persistent learnings and best practices that have been promoted from the learnings log.

---
`
      }

      // Format the promoted learning
      const promotedContent = formatPromotedLearning(learning)

      // Append to MEMORY.md
      const newContent = existingContent.trim() + "\n\n" + promotedContent + "\n"
      await Filesystem.write(memoryPath, newContent)

      // Update learning status
      await LearningStorage.updateLearning(
        {
          ...learning,
          status: "promoted",
          promotedTo: "MEMORY.md",
        },
        scope,
      )

      log.info("promoted learning to MEMORY.md", { learningId })
    } catch (err) {
      log.error("failed to promote learning to memory", { learningId, err })
      throw err
    }
  }

  /**
   * Format a learning for MEMORY.md
   */
  function formatPromotedLearning(learning: LearningEntry): string {
    const lines: string[] = []

    lines.push(`## ${learning.summary}`)
    lines.push("")
    lines.push(`> Promoted from ${learning.id} on ${new Date().toISOString().split("T")[0]}`)
    lines.push("")
    lines.push(learning.details)
    lines.push("")

    if (learning.suggestedAction) {
      lines.push("**Action:** " + learning.suggestedAction)
      lines.push("")
    }

    if (learning.relatedFiles?.length) {
      lines.push("**Related:** " + learning.relatedFiles.join(", "))
      lines.push("")
    }

    lines.push("---")
    lines.push("")

    return lines.join("\n")
  }

  /**
   * Check all pending learnings and auto-promote if thresholds are met
   */
  export async function checkAndAutoPromote(scope: "project" | "global" = "project"): Promise<number> {
    try {
      const learnings = await LearningStorage.listLearnings({ status: "pending" }, scope)
      let promotedCount = 0

      for (const learning of learnings) {
        if (await shouldAutoPromote(learning)) {
          // First mark as resolved if not already
          if (learning.status === "pending") {
            await LearningStorage.updateLearning(
              {
                ...learning,
                status: "resolved",
              },
              scope,
            )
          }

          // Then promote to memory
          await promoteToMemory(learning.id, scope)
          promotedCount++
        }
      }

      if (promotedCount > 0) {
        log.info("auto-promoted learnings", { count: promotedCount })
      }

      return promotedCount
    } catch (err) {
      log.error("failed to auto-promote learnings", { err })
      return 0
    }
  }

  /**
   * Mark a learning as resolved
   */
  export async function resolveLearning(
    learningId: string,
    solution?: string,
    scope: "project" | "global" = "project",
  ): Promise<void> {
    try {
      const learnings = await LearningStorage.listLearnings(undefined, scope)
      const learning = learnings.find((l) => l.id === learningId)

      if (!learning) {
        throw new Error(`Learning not found: ${learningId}`)
      }

      const updates: Partial<LearningEntry> = {
        status: "resolved",
      }

      if (solution) {
        updates.suggestedAction = solution
      }

      await LearningStorage.updateLearning(
        {
          ...learning,
          ...updates,
        },
        scope,
      )

      log.info("resolved learning", { learningId })
    } catch (err) {
      log.error("failed to resolve learning", { learningId, err })
      throw err
    }
  }

  /**
   * Get pending learnings that might be ready for skill generation
   */
  export async function getSkillCandidates(
    scope: "project" | "global" = "project",
  ): Promise<LearningEntry[]> {
    const learnings = await LearningStorage.listLearnings(undefined, scope)
    const thresholds = await getThresholds()

    return learnings.filter((l) => {
      // Resolved high-priority learnings
      if (l.priority === "high" || l.priority === "critical") {
        if (l.status === "resolved") return true
      }

      // Recurring patterns
      if (l.recurrenceCount >= thresholds.recurrenceThreshold) {
        return true
      }

      return false
    })
  }

  /**
   * Run periodic promotion check
   * Should be called at session end or periodically
   */
  export async function runPeriodicCheck(scope: "project" | "global" = "project"): Promise<{
    promotedToMemory: number
    skillCandidates: number
  }> {
    const promotedToMemory = await checkAndAutoPromote(scope)
    const skillCandidates = (await getSkillCandidates(scope)).length

    return {
      promotedToMemory,
      skillCandidates,
    }
  }
}
