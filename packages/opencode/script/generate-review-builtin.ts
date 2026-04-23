#!/usr/bin/env bun

/**
 * Downloads builtin skills & agents from their source repositories and generates
 * src/costrict/skill/builtin.ts and src/costrict/agents/builtin.ts
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

// Output directories
const bundledReviewDir = path.resolve(__dirname, "../bundled-review")
const builtinSkillsFile = path.resolve(__dirname, "../src/costrict/skill/builtin.ts")
const builtinAgentsFile = path.resolve(__dirname, "../src/costrict/agents/builtin.ts")

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

/**
 * Get the latest commit SHA for a branch via `git ls-remote`.
 * No clone needed — lightweight remote query.
 */
function lsRemoteSha(repo: string, branch: string): string | null {
  const cloneUrl = getCloneUrl(repo)
  const ref = `refs/heads/${branch}`
  const result = git("ls-remote", "--heads", cloneUrl, ref)
  if (!result.ok || !result.stdout) {
    return null
  }
  // Output format: "<sha>\t<ref>"
  const sha = result.stdout.split("\t")[0] ?? ""
  return sha.length >= 40 ? sha : null
}

/**
 * Read the cached commit SHA from the generated file.
 */
async function readCachedSha(name: string, targetFile: string): Promise<string | null> {
  try {
    const content = await fs.readFile(targetFile, "utf-8")
    const regex = new RegExp(
      `^\\s*"${JSON.stringify(name)}":\\s*"([a-f0-9]{40})"`,
      "m",
    )
    const match = content.match(regex)
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

/**
 * Download a resource (skill or agent) from remote repository.
 */
async function downloadResource(
  name: string,
  config: ResourceConfig,
): Promise<{ name: string; commitSha: string | null; type: "skill" | "agent" } | null> {
  const { repo, branch, subdir, type, outputFile } = config
  const cloneUrl = getCloneUrl(repo)
  const displayName = config.displayName || name
  const targetFile = type === "skill" ? builtinSkillsFile : builtinAgentsFile

  console.log(`\n📦 ${type === "skill" ? "Skill" : "Agent"}: ${displayName}`)
  console.log(`   From: ${cloneUrl}`)
  console.log(`   Branch: ${branch}`)

  // Step 1: Get remote commit SHA via git ls-remote
  const remoteSha = lsRemoteSha(repo, branch)
  if (!remoteSha) {
    throw new Error(`git ls-remote failed for ${cloneUrl} (branch: ${branch})`)
  }
  console.log(`   Remote commit: ${remoteSha.slice(0, 7)}`)

  // Step 2: Compare with cached SHA
  const cachedSha = await readCachedSha(name, targetFile)
  const outputDir = path.join(bundledReviewDir, name)
  const hasCachedFiles = (await walk(outputDir)).length > 0
  if (cachedSha && cachedSha === remoteSha && hasCachedFiles) {
    console.log(`   ✓ Cached version matches remote, skipping download`)
    return { name, commitSha: remoteSha, type }
  }
  if (cachedSha) {
    console.log(`   Cached: ${cachedSha.slice(0, 7)} → Remote: ${remoteSha.slice(0, 7)}, updating...`)
  }

  // Step 3: Clone and extract files
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

  // Verify required file exists
  const requiredFile = outputFile ? path.join(outputDir, outputFile) : path.join(outputDir, "SKILL.md")
  try {
    await fs.access(requiredFile)
  } catch {
    throw new Error(`${type === "skill" ? "Skill" : "Agent"} "${name}" missing ${outputFile || "SKILL.md"}`)
  }

  // Cleanup clone directory
  await fs.rm(cloneDir, { recursive: true, force: true })

  const fileCount = (await walk(outputDir)).length
  console.log(`   ✓ ${fileCount} files copied`)
  return { name, commitSha: remoteSha, type }
}

/**
 * Generate builtin.ts with all skill content embedded.
 */
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
      const escapedContent = JSON.stringify(content)
      const normalizedPath = file.replaceAll("\\", "/")

      imports.push(`const ${varName} = ${escapedContent}`)
      fileEntries.push(`  "${normalizedPath}": ${varName}`)
    }

    skillEntries.push(`  "${skillName}": {\n${fileEntries.join(",\n")}\n  }`)
  }

  const indexSkillVersions: string[] = []
  for (const resource of downloadedResources) {
    const config = BUILTIN_RESOURCES[resource.name]
    if (config?.type === "skill" && resource.commitSha) {
      indexSkillVersions.push(`    "${resource.name}": "${resource.commitSha}"`)
    }
  }

  const content = `// This file is auto-generated by script/generate-review-builtin.ts
// Do not edit manually
// All skill and agent files are embedded at build time for compiled builds

${imports.join("\n")}

/**
 * Embedded skills - all skill files are embedded at build time
 */
export const BUNDLED_SKILLS: Record<string, Record<string, string>> = {
${skillEntries.join(",\n")}
}

/**
 * Get the embedded skill files for a skill
 */
export async function loadSkillFiles(skillName: string): Promise<Record<string, string>> {
  return BUNDLED_SKILLS[skillName] || {}
}

/**
 * Get all files in a skill directory (returns list of file paths)
 */
export async function listSkillFiles(skillName: string): Promise<string[]> {
  return Object.keys(BUNDLED_SKILLS[skillName] || {})
}

/**
 * Load a single skill file content
 */
export async function loadSkillFile(skillName: string, filePath: string): Promise<string> {
  const skillFiles = BUNDLED_SKILLS[skillName]
  if (!skillFiles) {
    throw new Error(\`Skill not found: \${skillName}\`)
  }
  const content = skillFiles[filePath]
  if (content === undefined) {
    throw new Error(\`File not found in skill \${skillName}: \${filePath}\`)
  }
  return content
}

/**
 * Get the version (commit SHA) for a specific builtin skill
 */
export async function getBuiltinSkillVersion(skillName: string): Promise<string | undefined> {
  const versions: Record<string, string> = {
${indexSkillVersions.join(",\n")}
  }
  return versions[skillName]
}

/**
 * Get all builtin skill versions
 */
export async function getAllBuiltinSkillVersions(): Promise<Record<string, string>> {
  return {
${indexSkillVersions.join(",\n")}
  }
}

/**
 * List all builtin skill names
 */
export function listBuiltinSkills(): string[] {
  return ${JSON.stringify(skillNames)}
}

/**
 * Check if a skill is a builtin skill
 */
export function isBuiltinSkill(name: string): boolean {
  return ${JSON.stringify(skillNames)}.includes(name)
}

/**
 * Extract bundled skill to a target directory (used for installing to user cache)
 * This function writes embedded skill content to target directory
 */
export async function extractBundledSkill(skillName: string, targetDir: string): Promise<void> {
  const { writeFile } = await import("fs/promises")
  const { join, dirname } = await import("path")
  const { mkdir } = await import("fs/promises")

  const skillFiles = BUNDLED_SKILLS[skillName]
  if (!skillFiles) {
    throw new Error(\`Skill not found: \${skillName}\`)
  }

  await mkdir(targetDir, { recursive: true })

  for (const [relativePath, content] of Object.entries(skillFiles)) {
    const filePath = join(targetDir, relativePath)
    const fileDir = join(targetDir, dirname(relativePath))
    await mkdir(fileDir, { recursive: true })
    await writeFile(filePath, content, "utf-8")
  }
}
`

  await fs.writeFile(builtinSkillsFile, content, "utf-8")
  console.log(`\n✓ Generated ${builtinSkillsFile}`)
}

/**
 * Generate builtin.ts with all agent definitions embedded.
 */
async function generateBuiltinAgents(
  downloadedResources: Array<{ name: string; commitSha: string | null }>,
): Promise<void> {
  function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; content: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)
    if (!match) {
      return { frontmatter: {}, content }
    }
    const [, yamlStr, markdownContent] = match
    const frontmatter: Record<string, unknown> = {}
    const lines = yamlStr.split('\n')
    let currentKey: string | null = null
    let isArray = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith(':')) {
        if (currentKey) {
          frontmatter[currentKey] = (frontmatter[currentKey] || '') + trimmed.substring(1).trim()
        }
      } else if (trimmed.startsWith('-')) {
        isArray = true
        if (currentKey) {
          const value = trimmed.substring(1).trim().replace(/^["']|["']$/g, '')
          if (!Array.isArray(frontmatter[currentKey])) {
            frontmatter[currentKey] = []
          }
          ;(frontmatter[currentKey] as string[]).push(value)
        }
      } else if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':')
        currentKey = key.trim()
        const value = valueParts.join(':').trim()
        if (value.startsWith('"') || value.startsWith("'")) {
          frontmatter[currentKey] = value.slice(1, -1)
        } else if (value === 'true' || value === 'false') {
          frontmatter[currentKey] = value === 'true'
        } else if (!isNaN(Number(value))) {
          frontmatter[currentKey] = Number(value)
        } else if (value) {
          frontmatter[currentKey] = value
        }
        isArray = false
      } else {
        if (currentKey && isArray) {
          const value = trimmed.replace(/^["']|["']$/g, '')
          ;(frontmatter[currentKey] as string[]).push(value)
        }
      }
    }
    return { frontmatter, content: markdownContent }
  }

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

    const agentDir = path.join(bundledReviewDir, resource.name)
    const agentMdPath = path.join(agentDir, config.outputFile!)

    try {
      const content = await fs.readFile(agentMdPath, "utf-8")
      const parseResult = parseFrontmatter(content)
      const frontmatter = parseResult.frontmatter
      const systemPrompt = parseResult.content

      const agentName = (frontmatter.name as string) || resource.name
      const description = (frontmatter.description as string) || ''
      const tools = Array.isArray(frontmatter.tools) ? frontmatter.tools as string[] : []
      const color = (frontmatter.color as string) || 'blue'
      const model = (frontmatter.model as string) || 'inherit'
      const permissionMode = (frontmatter.permissionMode as string) || 'auto'

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
      agentEntries.push(`  },`)

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

  await fs.writeFile(builtinAgentsFile, outLines.join("\n") + "\n")
  console.log(`✓ Generated ${builtinAgentsFile}`)
}

/**
 * Main function: download all resources and generate builtin files.
 */
async function generateBuiltinReview() {
  console.log("\n🚀 OpenCode - Downloading Builtin Skills & Agents\n")

  await fs.mkdir(bundledReviewDir, { recursive: true })

  const downloadedResources: Array<{ name: string; commitSha: string | null; type: "skill" | "agent" }> = []
  const stats = { skill: { success: 0, skipped: 0 }, agent: { success: 0, skipped: 0 } }

  for (const [name, config] of Object.entries(BUILTIN_RESOURCES)) {
    try {
      const result = await downloadResource(name, config)
      if (result) {
        stats[config.type].success++
        downloadedResources.push(result)
      }
    } catch (err) {
      const outputDir = path.join(bundledReviewDir, name)
      const cached = await walk(outputDir)
      if (cached.length > 0) {
        console.warn(`  ⚠ Download failed, using local cached files for "${config.displayName || name}": ${err}`)
        const targetFile = config.type === "skill" ? builtinSkillsFile : builtinAgentsFile
        const cachedSha = await readCachedSha(name, targetFile)
        downloadedResources.push({ name, commitSha: cachedSha, type: config.type })
        stats[config.type].skipped++
      } else {
        console.error(`  ✗ Download failed and no local cache found for "${config.displayName || name}": ${err}`)
      }
    }
  }

  if (stats.skill.skipped > 0) {
    console.log(`\n✓ Skipped ${stats.skill.skipped} skills (download failed, using cache)`)
  }
  console.log(`✓ Downloaded ${stats.skill.success}/${Object.entries(BUILTIN_RESOURCES).filter(([_, c]) => c.type === "skill").length} skills`)

  if (stats.agent.skipped > 0) {
    console.log(`✓ Skipped ${stats.agent.skipped} agents (download failed, using cache)`)
  }
  console.log(`✓ Downloaded ${stats.agent.success}/${Object.entries(BUILTIN_RESOURCES).filter(([_, c]) => c.type === "agent").length} agents`)
  console.log(`✓ Bundled review directory: ${bundledReviewDir}`)
  console.log("\n💡 Run 'bun run build' to compile the extension\n")

  await generateBuiltinSkills(downloadedResources)

  const agentCount = downloadedResources.filter(r => BUILTIN_RESOURCES[r.name]?.type === "agent").length
  if (agentCount > 0) {
    await generateBuiltinAgents(downloadedResources)
  } else {
    console.warn('\n⚠ No agents downloaded. builtin.ts (agents) not updated.')
  }
}

generateBuiltinReview().catch(console.error)
