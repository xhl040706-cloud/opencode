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
import { mkdir, writeFile } from "fs/promises"
import { Log } from "../../util/log"
import { Filesystem } from "../../util/filesystem"
import * as Builtin from "./builtin"

const log = Log.create({ service: "costrict-skill" })

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
 * Skills are only extracted if they don't already exist in the cache.
 * To update to the latest builtin skills, delete the cache directory.
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
 * Get the path to the builtin skills cache directory.
 * This can be used to scan for skills.
 */
export function getBuiltinSkillsDir(): string {
  return getSkillCacheDir()
}
