import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { LearningStorage } from "@/learning/storage"
import { SkillGenerator } from "@/learning/generator"
import { LearningPromoter } from "@/learning/promoter"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { EOL } from "os"
import Table from "cli-table3"

export const LearningCommand = cmd({
  command: "learning",
  describe: "manage learning entries and skill candidates",
  builder: (yargs: Argv) =>
    yargs
      .command(LearningListCommand)
      .command(LearningShowCommand)
      .command(LearningResolveCommand)
      .command(LearningPromoteCommand)
      .command(SkillCandidatesCommand)
      .command(SkillApproveCommand)
      .command(SkillRejectCommand)
      .command(SkillGenerateCommand)
      .demandCommand(),
  async handler() {},
})

// ============================================================================
// Learning Commands
// ============================================================================

export const LearningListCommand = cmd({
  command: "list",
  describe: "list all learning entries",
  builder: (yargs: Argv) =>
    yargs
      .option("status", {
        describe: "filter by status",
        type: "string",
        choices: ["pending", "in_progress", "resolved", "promoted", "skill_created"],
      })
      .option("scope", {
        describe: "scope to search",
        type: "string",
        choices: ["project", "global"],
        default: "project",
      })
      .option("format", {
        describe: "output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const learnings = await LearningStorage.listLearnings(
        args.status ? { status: args.status as any } : undefined,
        args.scope as "project" | "global",
      )

      if (learnings.length === 0) {
        UI.println("No learning entries found.")
        return
      }

      if (args.format === "json") {
        console.log(JSON.stringify(learnings, null, 2))
        return
      }

      const table = new Table({
        head: ["ID", "Category", "Priority", "Status", "Summary"],
        colWidths: [18, 12, 10, 12, 50],
        wordWrap: true,
      })

      for (const learning of learnings) {
        table.push([
          learning.id,
          learning.category,
          learning.priority,
          learning.status,
          learning.summary.slice(0, 50) + (learning.summary.length > 50 ? "..." : ""),
        ])
      }

      console.log(table.toString())
      UI.println(`${EOL}Total: ${learnings.length} learning(s)`)
    })
  },
})

export const LearningShowCommand = cmd({
  command: "show <id>",
  describe: "show learning entry details",
  builder: (yargs: Argv) =>
    yargs.positional("id", {
      describe: "learning entry ID",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const learnings = await LearningStorage.listLearnings()
      const learning = learnings.find((l) => l.id === args.id)

      if (!learning) {
        UI.error(`Learning entry not found: ${args.id}`)
        process.exit(1)
      }

      console.log(JSON.stringify(learning, null, 2))
    })
  },
})

export const LearningResolveCommand = cmd({
  command: "resolve <id>",
  describe: "mark a learning as resolved",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        describe: "learning entry ID",
        type: "string",
        demandOption: true,
      })
      .option("solution", {
        describe: "solution description",
        type: "string",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      await LearningPromoter.resolveLearning(args.id, args.solution)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Learning ${args.id} resolved` + UI.Style.TEXT_NORMAL)
    })
  },
})

export const LearningPromoteCommand = cmd({
  command: "promote <id>",
  describe: "promote a learning to MEMORY.md",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        describe: "learning entry ID",
        type: "string",
        demandOption: true,
      })
      .option("scope", {
        describe: "scope for promotion",
        type: "string",
        choices: ["project", "global"],
        default: "project",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      await LearningPromoter.promoteToMemory(args.id, args.scope as "project" | "global")
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Learning ${args.id} promoted to MEMORY.md` + UI.Style.TEXT_NORMAL)
    })
  },
})

// ============================================================================
// Skill Candidate Commands
// ============================================================================

export const SkillCandidatesCommand = cmd({
  command: "candidates",
  describe: "list skill candidates",
  builder: (yargs: Argv) =>
    yargs
      .option("status", {
        describe: "filter by status",
        type: "string",
        choices: ["draft", "review", "approved", "rejected", "pushed"],
      })
      .option("scope", {
        describe: "scope to search",
        type: "string",
        choices: ["project", "global"],
        default: "project",
      })
      .option("format", {
        describe: "output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const candidates = await LearningStorage.listCandidates(
        args.status ? { status: args.status } : undefined,
        args.scope as "project" | "global",
      )

      if (candidates.length === 0) {
        UI.println("No skill candidates found.")
        return
      }

      if (args.format === "json") {
        console.log(JSON.stringify(candidates, null, 2))
        return
      }

      const table = new Table({
        head: ["ID", "Name", "Status", "Confidence", "Source", "Created"],
        colWidths: [36, 25, 10, 12, 15, 12],
      })

      for (const candidate of candidates) {
        table.push([
          candidate.id,
          candidate.name,
          candidate.status,
          `${(candidate.confidence * 100).toFixed(0)}%`,
          candidate.sourceType,
          new Date(candidate.createdAt).toLocaleDateString(),
        ])
      }

      console.log(table.toString())
      UI.println(`${EOL}Total: ${candidates.length} candidate(s)`)
    })
  },
})

export const SkillApproveCommand = cmd({
  command: "approve <id>",
  describe: "approve a skill candidate (creates formal skill)",
  builder: (yargs: Argv) =>
    yargs.positional("id", {
      describe: "candidate ID",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const skillPath = await SkillGenerator.promoteToSkill(args.id)
      if (skillPath) {
        UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Skill approved and created at: ${skillPath}` + UI.Style.TEXT_NORMAL)
      } else {
        UI.error(`Failed to approve skill candidate: ${args.id}`)
        process.exit(1)
      }
    })
  },
})

export const SkillRejectCommand = cmd({
  command: "reject <id>",
  describe: "reject a skill candidate",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        describe: "candidate ID",
        type: "string",
        demandOption: true,
      })
      .option("reason", {
        describe: "rejection reason",
        type: "string",
      }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      await SkillGenerator.rejectCandidate(args.id, args.reason)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Skill candidate ${args.id} rejected` + UI.Style.TEXT_NORMAL)
    })
  },
})

export const SkillGenerateCommand = cmd({
  command: "generate <id>",
  describe: "generate a skill from a learning entry",
  builder: (yargs: Argv) =>
    yargs.positional("id", {
      describe: "learning entry ID",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const learnings = await LearningStorage.listLearnings()
      const learning = learnings.find((l) => l.id === args.id)

      if (!learning) {
        UI.error(`Learning entry not found: ${args.id}`)
        process.exit(1)
      }

      const candidate = await SkillGenerator.generateFromLearning(learning)
      if (candidate) {
        UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Skill candidate created: ${candidate.id}` + UI.Style.TEXT_NORMAL)
        UI.println(`Name: ${candidate.name}`)
        UI.println(`Description: ${candidate.description}`)
        UI.println(`Confidence: ${(candidate.confidence * 100).toFixed(0)}%`)
        UI.println(`${EOL}Review and approve with: cs learning approve ${candidate.id}`)
      } else {
        UI.error("Failed to generate skill candidate")
        process.exit(1)
      }
    })
  },
})
