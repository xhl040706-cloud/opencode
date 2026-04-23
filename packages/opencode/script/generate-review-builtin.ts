#!/usr/bin/env bun

/**
 * Downloads builtin review skills & agents from their source repository and generates
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
  repo: string
  branch: string
  subdir: string
  type: "skill" | "agent"
  outputFile?: string
  displayName?: string
}

const BUILTIN_RESOURCES: Record<string, ResourceConfig> = {
  "security-review": {
    repo: "zgsm-ai/costrict-review",
    branch: "main",
    subdir: "skills/security-review",
    type: "skill",
    displayName: "Security Review Skill",
  },
  "review": {
    repo: "zgsm-ai/costrict-review",
    branch: "main",
    subdir: "skills/review",
    type: "skill",
    displayName: "Review Skill",
  },
  "costrict-reviewer": {
    repo: "zgsm-ai/costrict-review",
    branch: "main",
    subdir: "agents/CostrictReviewer",
    type: "agent",
    outputFile: "CostrictReviewer.md",
    displayName: "Costrict Reviewer Agent",
  },
  "costrict-validator": {
    repo: "zgsm-ai/costrict-review",
    branch: "main",
    subdir: "agents/CostrictValidator",
    type: "agent",
    outputFile: "CostrictValidator.md",
    displayName: "Costrict Validator Agent",
  },
}

function git(...args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { encoding: "utf-8" })
  return {
    ok: result.status === 0,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
  }
}

function getCloneUrl(repo: string): string {
  return `git@github.com:${repo}.git`
}

function lsRemoteSha(repo: string, branch: string): string | null {
  const ref = `refs/heads/${branch}`
  const result = git("ls-remote", "--heads", getCloneUrl(repo), ref)
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

async function downloadResource(
  name: string,
  config: ResourceConfig,
): Promise<{ name: string; commitSha: string | null } | null> {
  const { repo, branch, subdir, outputFile } = config
  const cloneUrl = getCloneUrl(repo)
  const displayName = config.displayName || name

  console.log(`\n📦 ${config.type === "skill" ? "Skill" : "Agent"}: ${displayName}`)
  console.log(`   From: ${cloneUrl}`)
  console.log(`   Branch: ${branch}`)

  const remoteSha = lsRemoteSha(repo, branch)
  if (!remoteSha) {
    throw new Error(`git ls-remote failed for ${cloneUrl} (branch: ${branch})`)
  }
  console.log(`   Remote commit: ${remoteSha.slice(0, 7)}`)

  const targetFile = config.type === "skill" ? builtinSkillsFile : builtinAgentsFile
  const cachedSha = await readCachedSha(name, targetFile)
  const outputDir = path.join(bundledReviewDir, name)
  const hasCachedFiles = (await walk(outputDir)).length > 0
  if (cachedSha === remoteSha && hasCachedFiles) {
    console.log(`   ✓ Cached version matches remote, skipping download`)
    return { name, commitSha: remoteSha }
  }
  if (cachedSha) {
    console.log(`   Cached: ${cachedSha.slice(0, 7)} → Remote: ${remoteSha.slice(0, 7)}, updating...`)
  }

  const cloneDir = path.join(bundledReviewDir, `.clone-${name}`)
  console.log(`   git clone --depth 1 ${cloneUrl}`)

  await fs.rm(cloneDir, { recursive: true, force: true })
  const cloneResult = git("clone", "--depth", "1", "--branch", branch, cloneUrl, cloneDir)
  if (!cloneResult.ok) {
    throw new Error(`git clone failed: ${cloneResult.stderr}`)
  }

  const srcDir = subdir ? path.join(cloneDir, subdir) : cloneDir
  await fs.rm(outputDir, { recursive: true, force: true })
  await fs.cp(srcDir, outputDir, { recursive: true })

  const requiredFile = outputFile ? path.join(outputDir, outputFile) : path.join(outputDir, "SKILL.md")
  try {
    await fs.access(requiredFile)
  } catch {
    throw new Error(`${config.type === "skill" ? "Skill" : "Agent"} "${name}" missing ${outputFile || "SKILL.md"}`)
  }

  await fs.rm(cloneDir, { recursive: true, force: true })
  const fileCount = (await walk(outputDir)).length
  console.log(`   ✓ ${fileCount} files copied`)
  return { name, commitSha: remoteSha }
}

async function generateBuiltinSkills(
  downloadedResources: Array<{ name: string; commitSha: string | null }>,
): Promise<void> {
  const skillNames = Object.entries(BUILTIN_RESOURCES)
    .filter(([_, config]) => config.type === "skill")
    .map(([name]) => name)
  const imports: string[] = []
  const skillEntries: string[] = []
  let fileIdx = 0

  for (const skillName of skillNames) {
    const skillDir = path.join(bundledReviewDir, skillName)
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
  downloadedResources: Array<{ name: string; commitSha: string | null }>,
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

    const agentMdPath = path.join(bundledReviewDir, resource.name, config.outputFile!)
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

  const downloadedResources: Array<{ name: string; commitSha: string | null }> = []
  let skipped = 0

  for (const [name, config] of Object.entries(BUILTIN_RESOURCES)) {
    try {
      const result = await downloadResource(name, config)
      if (result) {
        downloadedResources.push(result)
      }
    } catch (err) {
      const outputDir = path.join(bundledReviewDir, name)
      const cached = await walk(outputDir)
      if (cached.length > 0) {
        console.warn(`  ⚠ Download failed, using cache for "${config.displayName || name}": ${err}`)
        const cachedSha = await readCachedSha(name, config.type === "skill" ? builtinSkillsFile : builtinAgentsFile)
        downloadedResources.push({ name, commitSha: cachedSha })
        skipped++
      } else {
        console.error(`  ✗ Download failed, no cache for "${config.displayName || name}": ${err}`)
      }
    }
  }

  const total = Object.keys(BUILTIN_RESOURCES).length
  console.log(`\n✓ Downloaded ${total - skipped}/${total} resources${skipped > 0 ? ` (${skipped} skipped, using cache)` : ""}`)
  console.log(`✓ Bundled review directory: ${bundledReviewDir}`)
  console.log("\n💡 Run 'bun run build' to compile the extension\n")

  await generateBuiltinSkills(downloadedResources)

  const agentCount = downloadedResources.filter(r => BUILTIN_RESOURCES[r.name]?.type === "agent").length
  if (agentCount > 0) {
    await generateBuiltinAgents(downloadedResources)
  } else {
    console.warn("⚠ No agents downloaded, agent builtin.ts not updated.")
  }
}

generateBuiltinReview().catch(console.error)
