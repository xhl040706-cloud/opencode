#!/usr/bin/env bun

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Output directories
const bundledSkillsDir = path.resolve(__dirname, "../bundled-skills")
const builtinTsFile = path.resolve(__dirname, "../src/costrict/skill/builtin.ts")
const indexJsonFile = path.resolve(bundledSkillsDir, "index.json")

// Read version from package.json
async function getPackageVersion(): Promise<string> {
  const pkgPath = path.resolve(__dirname, "../package.json")
  const pkgContent = await fs.readFile(pkgPath, "utf-8")
  const pkg = JSON.parse(pkgContent)
  return pkg.version || "0.0.0"
}

// Fetch latest commit SHA for a repo branch
async function fetchCommitSha(repo: string, branch: string): Promise<string | null> {
  const apiUrl = `https://api.github.com/repos/${repo}/commits/${branch}`
  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "OpenCode-Build",
        "Accept": "application/vnd.github.v3+json",
      },
    })
    if (!response.ok) {
      console.warn(`  ⚠ Could not fetch commit SHA from GitHub API: ${response.status}`)
      return null
    }
    const data = await response.json()
    return data.sha || null
  } catch (err) {
    console.warn(`  ⚠ Failed to fetch commit SHA: ${err}`)
    return null
  }
}

// Builtin skills configuration
const BUILTIN_SKILLS = {
  "security-review": {
    repo: "zgsm-ai/security-review",
    branch: "main",
    subdir: "security-review",
  },
} as const

type Index = {
  skills: Array<{
    name: string
    description: string
    files: string[]
  }>
}

async function fetchIndex(repo: string, branch: string): Promise<Index | null> {
  const indexUrl = `https://raw.githubusercontent.com/${repo}/${branch}/index.json`
  const response = await fetch(indexUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch index: ${indexUrl} (${response.status})`)
  }
  return response.json() as Promise<Index>
}

async function fetchFile(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${url} (${response.status})`)
  }
  return response.text()
}

// Load local index.json to check for updates
async function loadLocalIndex(): Promise<{ version: string; skills: Array<{ name: string; commitSha: string }> } | null> {
  try {
    const content = await fs.readFile(indexJsonFile, "utf-8")
    return JSON.parse(content)
  } catch {
    return null
  }
}

// Check if skill needs download based on commit SHA
async function needsDownload(skillName: string, repo: string, branch: string): Promise<boolean> {
  const localIndex = await loadLocalIndex()
  if (!localIndex) {
    return true
  }

  const localSkill = localIndex.skills.find((s) => s.name === skillName)
  if (!localSkill || !localSkill.commitSha) {
    return true
  }

  const latestSha = await fetchCommitSha(repo, branch)
  if (!latestSha) {
    console.log(`  ⚠ Could not fetch latest commit, downloading anyway`)
    return true
  }

  if (latestSha === localSkill.commitSha) {
    console.log(`  ✓ Up to date (commit: ${latestSha.slice(0, 7)})`)
    return false
  }

  console.log(`  → Update available (${localSkill.commitSha.slice(0, 7)} → ${latestSha.slice(0, 7)})`)
  return true
}

async function downloadSkill(
  name: string,
  config: { repo: string; branch: string; subdir: string },
): Promise<{ name: string; commitSha: string | null } | null> {
  const { repo, branch, subdir } = config
  console.log(`\n📦 Downloading skill: ${name}`)
  console.log(`   From: https://github.com/${repo}`)
  console.log(`   Branch: ${branch}`)

  // Fetch commit SHA
  const commitSha = await fetchCommitSha(repo, branch)
  if (commitSha) {
    console.log(`   Commit: ${commitSha.slice(0, 7)}`)
  }

  // Fetch index.json
  const index = await fetchIndex(repo, branch)
  if (!index?.skills?.length) {
    console.error(`   ✗ Invalid index for skill: ${name}`)
    return null
  }

  const skill = index.skills.find((s) => s.name === name)
  if (!skill) {
    console.error(`   ✗ Skill "${name}" not found in index`)
    return null
  }

  console.log(`  Found ${skill.files.length} files to download`)

  // Create output directory
  const skillOutputDir = path.join(bundledSkillsDir, name)
  await fs.mkdir(skillOutputDir, { recursive: true })

  // Path prefix for files (with subdir)
  const pathPrefix = subdir ? `${subdir}/` : ""

  // Download all files
  for (const file of skill.files) {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${pathPrefix}${file}`
    const targetPath = path.join(skillOutputDir, file)

    // Create parent directories
    await fs.mkdir(path.dirname(targetPath), { recursive: true })

    try {
      const content = await fetchFile(url)
      await fs.writeFile(targetPath, content, "utf-8")
      console.log(`  ✓ ${file}`)
    } catch (err) {
      console.warn(`  ✗ Failed to download ${file}: ${err}`)
    }
  }

  // Verify SKILL.md exists
  const skillMdPath = path.join(skillOutputDir, "SKILL.md")
  try {
    await fs.access(skillMdPath)
  } catch {
    console.error(`   ✗ Skill "${name}" missing SKILL.md`)
    return null
  }

  console.log(`   ✓ Skill ${name} downloaded successfully`)

  return { name, commitSha }
}

async function generateBuiltinSkills() {
  console.log("\n🚀 OpenCode - Downloading Builtin Skills\n")

  const packageVersion = await getPackageVersion()

  // Ensure bundled-skills directory exists
  await fs.mkdir(bundledSkillsDir, { recursive: true })

  // Load local index to check for updates
  const localIndex = await loadLocalIndex()

  // Download all skills that need updating
  const downloadedSkills: Array<{ name: string; commitSha: string | null }> = []
  let successCount = 0
  let skippedCount = 0

  for (const [name, config] of Object.entries(BUILTIN_SKILLS)) {
    const needsUpdate = await needsDownload(name, config.repo, config.branch)

    if (!needsUpdate) {
      skippedCount++
      const localSkill = localIndex?.skills.find((s) => s.name === name)
      if (localSkill) {
        downloadedSkills.push(localSkill)
      }
      continue
    }

    const result = await downloadSkill(name, config)
    if (result) {
      successCount++
      downloadedSkills.push(result)
    }
  }

  // Always create/update index.json
  const indexContent = {
    version: packageVersion,
    skills: downloadedSkills.map((s) => {
      // If we got a new commitSha, use it; otherwise keep the existing one
      const existingSkill = localIndex?.skills.find((ls) => ls.name === s.name)
      return {
        name: s.name,
        commitSha: s.commitSha || existingSkill?.commitSha || "",
      }
    }),
  }
  await fs.writeFile(indexJsonFile, JSON.stringify(indexContent, null, 2))

  if (skippedCount > 0) {
    console.log(`\n✓ Skipped ${skippedCount} skills (already up to date)`)
  }
  console.log(`✓ Downloaded ${successCount}/${Object.keys(BUILTIN_SKILLS).length} skills`)
  console.log(`✓ Bundled skills directory: ${bundledSkillsDir}`)
  console.log(`✓ Index version: ${packageVersion}`)
  console.log("\n💡 Run 'bun run build' to compile the extension\n")

  // Generate builtin.ts (small runtime loader, no embedded content)
  await generateBuiltinTs()
}

async function generateBuiltinTs() {
  const skillNames = Object.keys(BUILTIN_SKILLS)

  const content = `// This file is auto-generated by script/generate-skills.ts
// Do not edit manually

import { readFile } from "fs/promises"
import { join } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Get the bundled skills directory (relative to this file)
 */
function getBundledSkillsDir(): string {
  // Navigate from src/costrict/skill/ to bundled-skills/
  return join(__dirname, "../../../bundled-skills")
}

/**
 * Load skill metadata from index.json
 */
async function loadIndex(): Promise<{
  version: string
  skills: Array<{ name: string; commitSha: string }>
} | null> {
  try {
    const indexPath = join(getBundledSkillsDir(), "index.json")
    const content = await readFile(indexPath, "utf-8")
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Load a single skill file content
 */
export async function loadSkillFile(skillName: string, filePath: string): Promise<string> {
  const skillDir = join(getBundledSkillsDir(), skillName)
  const fullPath = join(skillDir, filePath)
  const content = await readFile(fullPath, "utf-8")
  return content
}

/**
 * Get all files in a skill directory
 */
export async function listSkillFiles(skillName: string): Promise<string[]> {
  const { readdir } = await import("fs/promises")
  const { join } = await import("path")
  const skillDir = join(getBundledSkillsDir(), skillName)

  async function walk(dir: string, base = ""): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relativePath = base ? join(base, entry.name) : entry.name

      if (entry.isDirectory()) {
        files.push(...await walk(fullPath, relativePath))
      } else {
        files.push(relativePath)
      }
    }

    return files
  }

  return walk(skillDir)
}

/**
 * Load all files for a skill as a Record<string, string>
 */
export async function loadSkillFiles(skillName: string): Promise<Record<string, string>> {
  const files = await listSkillFiles(skillName)
  const result: Record<string, string> = {}

  for (const file of files) {
    result[file] = await loadSkillFile(skillName, file)
  }

  return result
}

/**
 * Get the version (commit SHA) for a specific builtin skill
 */
export async function getBuiltinSkillVersion(skillName: string): Promise<string | undefined> {
  const index = await loadIndex()
  return index?.skills.find(s => s.name === skillName)?.commitSha
}

/**
 * Get all builtin skill versions
 */
export async function getAllBuiltinSkillVersions(): Promise<Record<string, string>> {
  const index = await loadIndex()
  const result: Record<string, string> = {}

  if (index) {
    for (const skill of index.skills) {
      result[skill.name] = skill.commitSha
    }
  }

  return result
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
`

  await fs.writeFile(builtinTsFile, content, "utf-8")
  console.log(`✓ Generated ${builtinTsFile}`)
}

generateBuiltinSkills().catch(console.error)
