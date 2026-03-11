/**
 * CoStrict Skill Extension
 *
 * This module extends the base Skill functionality with:
 * - Builtin skill initialization from embedded content
 *
 * Skills are embedded in the binary during build and extracted to cache
 * on first run. Users get updated skills when they upgrade CoStrict.
 *
 * Design: Minimal invasive - only patches/extends the original Discovery module
 * without modifying its source code.
 */

import path from "path"
import { mkdir, writeFile, readFile, rm } from "fs/promises"
import { Log } from "../../util/log"
import { Filesystem } from "../../util/filesystem"
import * as Builtin from "./builtin"

const log = Log.create({ service: "costrict-skill" })

/**
 * Extract version from skill.md content
 */
function extractVersionFromSkill(content: string): string | null {
  const match = content.match(/Builtin Skill Version:\s*([0-9.]+)/)
  return match ? match[1] : null
}

/**
 * Check if the skill needs to be updated due to version change
 * Returns true if:
 * - File doesn't exist
 * - File is corrupted or can't be read
 * - Version comment is missing or invalid
 * - Version doesn't match builtin version
 */
async function needsUpdate(skillDir: string, builtinVersion: string): Promise<boolean> {
  const skillMdPath = path.join(skillDir, "SKILL.md")
  try {
    const content = await readFile(skillMdPath, "utf-8")
    const cachedVersion = extractVersionFromSkill(content)
    // Update if version is missing, invalid, or doesn't match
    return cachedVersion !== builtinVersion
  } catch {
    // File doesn't exist or can't be read
    return true
  }
}

/**
 * Get the cache directory for skills.
 */
function getSkillCacheDir(): string {
  return path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".cache", "costrict", "skills")
}

/**
 * Initialize builtin skills by extracting them to the cache directory.
 * This is called on startup to ensure skills are available.
 *
 * Skills are extracted if they don't exist or if the version has changed.
 * Uses full replacement to ensure no stale files remain.
 */
export async function initializeBuiltinSkills(): Promise<void> {
  const cacheDir = getSkillCacheDir()
  const builtinVersion = Builtin.BUILTIN_SKILLS_VERSION

  for (const [name, skill] of Object.entries(Builtin.BUILTIN_SKILLS)) {
    const skillDir = path.join(cacheDir, name)

    // Check if skill needs update (doesn't exist or version mismatch)
    if (await Filesystem.isDir(skillDir)) {
      if (!await needsUpdate(skillDir, builtinVersion)) {
        log.debug("builtin skill up to date", { name, version: builtinVersion })
        continue
      }
      log.info("builtin skill version changed, replacing with new version", { name, version: builtinVersion })
      // Full replacement: delete single skill directory first
      await rm(skillDir, { recursive: true, force: true })
    } else {
      log.info("initializing builtin skill", { name })
    }

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

    log.info("initialized builtin skill", { name, fileCount: Object.keys(skill.files).length, version: builtinVersion })
  }
}

/**
 * Get the path to the builtin skills cache directory.
 * This can be used to scan for skills.
 */
export function getBuiltinSkillsDir(): string {
  return getSkillCacheDir()
}

