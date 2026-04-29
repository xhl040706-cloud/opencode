#!/usr/bin/env bun

/**
 * Downloads builtin review skills & agents from costrict-review repo and generates
 * src/costrict/review/skill/builtin.ts and src/costrict/review/agent/builtin.ts
 *
 * Uses git SSH transport (git ls-remote + git clone).
 * Compares remote commit SHA with cached version and skips download if unchanged.
 *
 * Usage: bun run script/generate-review-builtin.ts
 */

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { spawnSync } from "child_process"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const bundledReviewDir = path.resolve(__dirname, "../bundled-review")
const builtinSkillsFile = path.resolve(__dirname, "../src/costrict/review/skill/builtin.ts")
const builtinAgentsFile = path.resolve(__dirname, "../src/costrict/review/agent/builtin.ts")

type ResourceConfig = {
  subdir: string
  type: "skill" | "agent"
  outputFile?: string
  displayName?: string
}

const BUILTIN_RESOURCES: Record<string, ResourceConfig> = {
  "security-review": {
    subdir: "skills/security-review",
    type: "skill",
    displayName: "Security Review Skill",
  },
  "review": {
    subdir: "skills/review",
    type: "skill",
    displayName: "Review Skill",
  },
  "costrict-reviewer": {
    subdir: "agents/CostrictReviewer",
    type: "agent",
    outputFile: "CostrictReviewer.md",
    displayName: "Costrict Reviewer Agent",
  },
  "costrict-validator": {
    subdir: "agents/CostrictValidator",
    type: "agent",
    outputFile: "CostrictValidator.md",
    displayName: "Costrict Validator Agent",
  },
}

const REPO = "zgsm-ai/costrict-review"
const BRANCH = "main"
const CLONE_URL = `git@github.com:${REPO}.git`

function git(...args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { encoding: "utf-8" })
  return {
    ok: result.status === 0,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
  }
}

function lsRemoteSha(): string | null {
  const ref = `refs/heads/${BRANCH}`
  const result = git("ls-remote", "--heads", CLONE_URL, ref)
  if (!result.ok || !result.stdout) return null
  const sha = result.stdout.split("\t")[0] ?? ""
  return sha.length >= 40 ? sha : null
}

async function readCachedSha(name: string, targetFile: string): Promise<string | null> {
  try {
    const content = await fs.readFile(targetFile, "utf-8")
    const match = content.match(new RegExp(`^\\s*"${name}":\\s*"([a-f0-9]{40})",?`, "m"))
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function walk(dir: string, base = ""): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = base ? path.join(base, entry.name) : entry.name
      if (entry.isDirectory()) {
        files.push(...await walk(fullPath, relativePath))
      } else {
        files.push(relativePath)
      }
    }
    return files
  } catch {
    return []
  }
}

type DownloadResult = { name: string; commitSha: string | null }

async function cloneAndCopy(
  cloneDir: string,
): Promise<void> {
  console.log(`   git clone --depth 1 ${CLONE_URL}`)
  await fs.rm(cloneDir, { recursive: true, force: true })
  const cloneResult = git("clone", "--depth", "1", "--branch", BRANCH, CLONE_URL, cloneDir)
  if (!cloneResult.ok) {
    throw new Error(`git clone failed: ${cloneResult.stderr}`)
  }

  for (const [name, config] of Object.entries(BUILTIN_RESOURCES)) {
    const outputDir = path.join(bundledReviewDir, config.type === "skill" ? "skills" : "agents", name)
    const srcDir = path.join(cloneDir, config.subdir)

    await fs.rm(outputDir, { recursive: true, force: true })
    await fs.cp(srcDir, outputDir, { recursive: true })

    const requiredFile = config.outputFile
      ? path.join(outputDir, config.outputFile)
      : path.join(outputDir, "SKILL.md")
    try {
      await fs.access(requiredFile)
    } catch {
      throw new Error(`${config.type === "skill" ? "Skill" : "Agent"} "${name}" missing ${config.outputFile || "SKILL.md"}`)
    }

    const fileCount = (await walk(outputDir)).length
    console.log(`   ✓ ${config.displayName || name}: ${fileCount} files`)
  }

  await fs.rm(cloneDir, { recursive: true, force: true })
}

async function generateBuiltinSkills(
  downloadedResources: DownloadResult[],
): Promise<void> {
  const skillNames = Object.entries(BUILTIN_RESOURCES)
    .filter(([_, config]) => config.type === "skill")
    .map(([name]) => name)
  const imports: string[] = []
  const skillEntries: string[] = []
  let fileIdx = 0

  for (const skillName of skillNames) {
    const skillDir = path.join(bundledReviewDir, "skills", skillName)
    const files = await walk(skillDir)
    const fileEntries: string[] = []
    for (const file of files) {
      const varName = `SKILL_FILE_${fileIdx++}`
      const filePath = path.join(skillDir, file)
      const content = await fs.readFile(filePath, "utf-8")
      const normalizedPath = file.replaceAll("\\", "/")
      imports.push(`const ${varName} = ${JSON.stringify(content)}`)
      fileEntries.push(`  "${normalizedPath}": ${varName}`)
    }
    skillEntries.push(`  "${skillName}": {\n${fileEntries.join(",\n")}\n  }`)
  }

  const versionEntries: string[] = []
  for (const resource of downloadedResources) {
    const config = BUILTIN_RESOURCES[resource.name]
    if (config?.type === "skill" && resource.commitSha) {
      versionEntries.push(`  "${resource.name}": "${resource.commitSha}"`)
    }
  }

  const content = `// This file is auto-generated by script/generate-review-builtin.ts
// Do not edit manually

${imports.join("\n")}

const SKILL_FILES: Record<string, Record<string, string>> = {
${skillEntries.join(",\n")}
}

const SKILL_VERSIONS: Record<string, string> = {
${versionEntries.join(",\n")}
}

export function listBuiltinSkills(): string[] {
  return ${JSON.stringify(skillNames)}
}

export function getBuiltinSkillVersion(skillName: string): string | undefined {
  return SKILL_VERSIONS[skillName]
}

export function listSkillFiles(skillName: string): string[] {
  return Object.keys(SKILL_FILES[skillName] || {})
}

export async function extractBundledSkill(skillName: string, targetDir: string): Promise<void> {
  const { writeFile, mkdir } = await import("fs/promises")
  const { join, dirname } = await import("path")

  const skillFiles = SKILL_FILES[skillName]
  if (!skillFiles) {
    throw new Error(\`Skill not found: \${skillName}\`)
  }

  await mkdir(targetDir, { recursive: true })
  for (const [relativePath, content] of Object.entries(skillFiles)) {
    await mkdir(join(targetDir, dirname(relativePath)), { recursive: true })
    await writeFile(join(targetDir, relativePath), content, "utf-8")
  }
}
`

  await fs.writeFile(builtinSkillsFile, content, "utf-8")
  console.log(`\n✓ Generated ${builtinSkillsFile}`)
}

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, content }
  const frontmatter: Record<string, unknown> = {}
  const lines = match[1].split("\n")
  let currentKey: string | null = null
  let isArray = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith(":")) {
      if (currentKey) frontmatter[currentKey] = (frontmatter[currentKey] || "") + trimmed.substring(1).trim()
    } else if (trimmed.startsWith("-")) {
      isArray = true
      if (currentKey) {
        const value = trimmed.substring(1).trim().replace(/^["']|["']$/g, "")
        if (!Array.isArray(frontmatter[currentKey])) frontmatter[currentKey] = []
        ;(frontmatter[currentKey] as string[]).push(value)
      }
    } else if (trimmed.includes(":")) {
      const [key, ...valueParts] = trimmed.split(":")
      currentKey = key.trim()
      const value = valueParts.join(":").trim()
      if (value.startsWith('"') || value.startsWith("'")) {
        frontmatter[currentKey] = value.slice(1, -1)
      } else if (value === "true" || value === "false") {
        frontmatter[currentKey] = value === "true"
      } else if (!isNaN(Number(value))) {
        frontmatter[currentKey] = Number(value)
      } else if (value) {
        frontmatter[currentKey] = value
      }
      isArray = false
    } else if (currentKey && isArray) {
      const value = trimmed.replace(/^["']|["']$/g, "")
      ;(frontmatter[currentKey] as string[]).push(value)
    }
  }
  return { frontmatter, content: match[2] }
}

async function generateBuiltinAgents(
  downloadedResources: DownloadResult[],
): Promise<void> {
  const outLines: string[] = [
    "// This file is auto-generated by script/generate-review-builtin.ts",
    "// Do not edit manually",
    "// Agents are downloaded from zgsm-ai/costrict-review repository",
    "",
  ]

  const agentEntries: string[] = []
  const versionEntries: string[] = []

  for (const resource of downloadedResources) {
    const config = BUILTIN_RESOURCES[resource.name]
    if (!config || config.type !== "agent") continue

    const agentMdPath = path.join(bundledReviewDir, "agents", resource.name, config.outputFile!)
    try {
      const content = await fs.readFile(agentMdPath, "utf-8")
      const { frontmatter, content: systemPrompt } = parseFrontmatter(content)

      const agentName = (frontmatter.name as string) || resource.name
      const description = (frontmatter.description as string) || ""
      const tools = Array.isArray(frontmatter.tools) ? frontmatter.tools as string[] : []
      const color = (frontmatter.color as string) || "blue"
      const model = (frontmatter.model as string) || "inherit"
      const permissionMode = (frontmatter.permissionMode as string) || "auto"

      agentEntries.push(`  '${agentName}': {`)
      agentEntries.push(`    agentType: '${agentName}',`)
      agentEntries.push(`    whenToUse: ${JSON.stringify(description)},`)
      agentEntries.push(`    tools: ${JSON.stringify(tools)},`)
      agentEntries.push(`    color: '${color}',`)
      agentEntries.push(`    model: '${model}',`)
      agentEntries.push(`    permissionMode: '${permissionMode}',`)
      agentEntries.push(`    getSystemPrompt: () => ${JSON.stringify(systemPrompt.trim())},`)
      agentEntries.push(`    source: 'built-in' as const,`)
      agentEntries.push(`    baseDir: 'built-in' as const,`)
      agentEntries.push("  },")

      if (resource.commitSha) {
        versionEntries.push(`  '${agentName}': '${resource.commitSha}',`)
      }
    } catch (err) {
      console.error(`  ✗ Failed to parse agent ${resource.name}: ${err}`)
    }
  }

  outLines.push("export const BUILTIN_AGENTS = {")
  outLines.push(...agentEntries)
  outLines.push("}")
  outLines.push("")
  outLines.push("export const AGENT_VERSIONS: Record<string, string> = {")
  outLines.push(...versionEntries)
  outLines.push("}")
  outLines.push("")

  await fs.writeFile(builtinAgentsFile, outLines.join("\n"), "utf-8")
  console.log(`✓ Generated ${builtinAgentsFile}`)
}

async function generateBuiltinReview() {
  console.log("\n🚀 OpenCode - Downloading Builtin Review Resources\n")

  await fs.mkdir(bundledReviewDir, { recursive: true })

  const remoteSha = lsRemoteSha()
  if (!remoteSha) {
    throw new Error(`git ls-remote failed for ${CLONE_URL} (branch: ${BRANCH})`)
  }
  console.log(`Remote commit: ${remoteSha.slice(0, 7)}`)

  // Check if any resource needs updating
  let needsUpdate = false
  for (const [name, config] of Object.entries(BUILTIN_RESOURCES)) {
    const targetFile = config.type === "skill" ? builtinSkillsFile : builtinAgentsFile
    const cachedSha = await readCachedSha(name, targetFile)
    const outputDir = path.join(bundledReviewDir, config.type === "skill" ? "skills" : "agents", name)
    const hasCachedFiles = (await walk(outputDir)).length > 0

    if (cachedSha !== remoteSha || !hasCachedFiles) {
      if (cachedSha) {
        console.log(`${config.displayName || name}: cached ${cachedSha.slice(0, 7)} → remote ${remoteSha.slice(0, 7)}, updating`)
      }
      needsUpdate = true
    }
  }

  const downloadedResources: DownloadResult[] = []

  if (needsUpdate) {
    const cloneDir = path.join(bundledReviewDir, ".clone")
    try {
      await cloneAndCopy(cloneDir)
      for (const name of Object.keys(BUILTIN_RESOURCES)) {
        downloadedResources.push({ name, commitSha: remoteSha })
      }
      console.log(`\n✓ All resources updated (commit ${remoteSha.slice(0, 7)})`)
    } catch (err) {
      console.error(`  ✗ Download failed: ${err}`)
      // Check which resources have usable cache
      for (const [name, config] of Object.entries(BUILTIN_RESOURCES)) {
        const outputDir = path.join(bundledReviewDir, config.type === "skill" ? "skills" : "agents", name)
        const cached = await walk(outputDir)
        if (cached.length > 0) {
          console.warn(`  ⚠ Using cache for "${config.displayName || name}"`)
          const targetFile = config.type === "skill" ? builtinSkillsFile : builtinAgentsFile
          const cachedSha = await readCachedSha(name, targetFile)
          downloadedResources.push({ name, commitSha: cachedSha })
        } else {
          console.error(`  ✗ No cache for "${config.displayName || name}", skipping`)
        }
      }
    }
  } else {
    console.log("✓ All resources up to date, skipping download")
    for (const name of Object.keys(BUILTIN_RESOURCES)) {
      downloadedResources.push({ name, commitSha: remoteSha })
    }
  }

  console.log(`✓ Bundled review directory: ${bundledReviewDir}`)

  await generateBuiltinSkills(downloadedResources)

  const agentCount = downloadedResources.filter(r => BUILTIN_RESOURCES[r.name]?.type === "agent").length
  if (agentCount > 0) {
    await generateBuiltinAgents(downloadedResources)
  } else {
    console.warn("⚠ No agents downloaded, agent builtin.ts not updated.")
  }

  console.log("\n💡 Run 'bun run build' to compile the extension\n")
}

generateBuiltinReview().catch(console.error)
