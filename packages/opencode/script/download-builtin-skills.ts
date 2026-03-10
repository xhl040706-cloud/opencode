#!/usr/bin/env bun

/**
 * Download builtin skills from GitHub repositories
 * This script clones skill repositories during build time
 */

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { $ } from "bun"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
const skillDir = path.join(rootDir, "src/costrict/skill")

interface SkillDownload {
  name: string
  owner: string
  repo: string
  branch?: string
}

const BUILTIN_SKILLS: SkillDownload[] = [
  {
    name: "security-review",
    owner: "zgsm-ai",
    repo: "security-review",
    branch: "main",
  },
]

/**
 * Clone a GitHub repository to local directory
 */
async function downloadSkill(skill: SkillDownload): Promise<boolean> {
  const { name, owner, repo, branch = "main" } = skill
  const targetDir = path.join(skillDir, name)
  const repoUrl = `https://github.com/${owner}/${repo}.git`

  console.log(`\nCloning skill: ${name}`)
  console.log(`  Source: ${repoUrl}`)
  console.log(`  Branch: ${branch}`)
  console.log(`  Target: ${targetDir}`)

  try {
    // Remove existing directory if it exists
    if (await fs.stat(targetDir).catch(() => null)) {
      console.log(`  Removing existing directory...`)
      await fs.rm(targetDir, { recursive: true, force: true })
    }

    // Clone the repository
    console.log(`  Cloning repository...`)
    await $`git clone --depth 1 --branch ${branch} ${repoUrl} ${targetDir}`

    // Remove .git directory to save space
    const gitDir = path.join(targetDir, ".git")
    await fs.rm(gitDir, { recursive: true, force: true }).catch(() => {})

    console.log(`  Successfully cloned ${name}`)
    return true
  } catch (error) {
    console.warn(`  Failed to clone ${name}: ${error}`)
    return false
  }
}

async function main() {
  console.log("=== Downloading Builtin Skills ===")

  // Ensure skill directory exists
  await fs.mkdir(skillDir, { recursive: true })

  for (const skill of BUILTIN_SKILLS) {
    await downloadSkill(skill)
  }

  console.log("\n=== Download Complete ===")
}

main().catch((error) => {
  console.error("Error downloading builtin skills:", error)
  process.exit(1)
})
