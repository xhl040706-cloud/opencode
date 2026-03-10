/**
 * CoStrict Skill Extension
 *
 * This module extends the base Skill functionality with:
 * - Builtin skill initialization from embedded content
 * - Online update capability for builtin skills
 *
 * Design: Minimal invasive - only patches/extends the original Discovery module
 * without modifying its source code.
 */

import path from "path"
import { mkdir, writeFile } from "fs/promises"
import { Log } from "../../util/log"
import { Filesystem } from "../../util/filesystem"
import * as Builtin from "./builtin"

const log = Log.create({ service: "costrict-skill" })

// Remote URLs for builtin skills (for updates)
const BUILTIN_SKILL_URLS: Record<string, string> = {
  "security-review": "https://raw.githubusercontent.com/zgsm-ai/security-review/main",
}

/**
 * Get the cache directory for skills.
 * Reuses the same path as Discovery.dir()
 */
function getSkillCacheDir(): string {
  return path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".cache", "costrict", "skills")
}

/**
 * Initialize builtin skills by extracting them to the cache directory.
 * This is called on startup to ensure skills are available.
 */
export async function initializeBuiltinSkills(): Promise<void> {
  const cacheDir = getSkillCacheDir()

  for (const [name, skill] of Object.entries(Builtin.BUILTIN_SKILLS)) {
    const skillDir = path.join(cacheDir, name)

    // Check if skill directory already exists
    if (await Filesystem.isDir(skillDir)) {
      log.debug("builtin skill already exists", { name })
      continue
    }

    log.info("initializing builtin skill", { name })
    await mkdir(skillDir, { recursive: true })

    // Write all files to the cache directory
    for (const [filePath, content] of Object.entries(skill.files)) {
      const destPath = path.join(skillDir, filePath)
      const destDir = path.dirname(destPath)

      // Ensure directory exists
      await mkdir(destDir, { recursive: true })

      // Write file content
      await writeFile(destPath, content, "utf-8")
      log.debug("wrote builtin skill file", { name, file: filePath })
    }

    log.info("initialized builtin skill", { name, fileCount: Object.keys(skill.files).length })
  }
}

/**
 * Update a single builtin skill from its remote source.
 * @param name - The skill name to update
 * @param force - If true, update even if already exists
 * @returns true if updated successfully, false otherwise
 */
export async function updateBuiltinSkill(name: string, force = false): Promise<boolean> {
  const remoteUrl = BUILTIN_SKILL_URLS[name]
  if (!remoteUrl) {
    log.warn("no remote URL configured for builtin skill", { name })
    return false
  }

  const cacheDir = getSkillCacheDir()
  const skillDir = path.join(cacheDir, name)

  // Check if skill exists and not forcing update
  if (!force && await Filesystem.isDir(skillDir)) {
    log.debug("builtin skill exists, use force=true to update", { name })
    return false
  }

  try {
    // Fetch index.json from remote
    const indexUrl = new URL("index.json", remoteUrl.endsWith("/") ? remoteUrl : `${remoteUrl}/`).href
    const indexResponse = await fetch(indexUrl)
    if (!indexResponse.ok) {
      throw new Error(`Failed to fetch index: ${indexResponse.status}`)
    }

    const index = await indexResponse.json() as {
      skills: Array<{ name: string; description: string; files: string[] }>
    }

    const skillData = index.skills.find((s) => s.name === name)
    if (!skillData) {
      throw new Error(`Skill "${name}" not found in index`)
    }

    // Create skill directory
    await mkdir(skillDir, { recursive: true })

    // Download all files
    const host = remoteUrl.endsWith("/") ? remoteUrl.slice(0, -1) : remoteUrl
    for (const file of skillData.files) {
      const fileUrl = new URL(file, `${host}/${name}/`).href
      const destPath = path.join(skillDir, file)
      const destDir = path.dirname(destPath)

      await mkdir(destDir, { recursive: true })

      const response = await fetch(fileUrl)
      if (!response.ok) {
        log.warn("failed to download file", { file, status: response.status })
        continue
      }

      const content = await response.text()
      await writeFile(destPath, content, "utf-8")
      log.debug("updated skill file", { name, file })
    }

    log.info("builtin skill updated successfully", { name })
    return true
  } catch (err) {
    log.error("failed to update builtin skill", { name, err })
    return false
  }
}

/**
 * Update all builtin skills from their remote sources.
 * @param force - If true, update even if already exists
 */
export async function updateAllBuiltinSkills(force = false): Promise<void> {
  const names = Object.keys(Builtin.BUILTIN_SKILLS)
  log.info("updating all builtin skills", { count: names.length })

  for (const name of names) {
    await updateBuiltinSkill(name, force)
  }
}

/**
 * Get the path to the builtin skills cache directory.
 * This can be used to scan for skills.
 */
export function getBuiltinSkillsDir(): string {
  return getSkillCacheDir()
}
