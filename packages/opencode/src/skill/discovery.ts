import path from "path"
import { mkdir, writeFile } from "fs/promises"
import { Log } from "../util/log"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import * as Builtin from "./builtin"

export namespace Discovery {
  const log = Log.create({ service: "skill-discovery" })
  const BUILTIN_SKILLS_VERSION_KEY = "builtin_skills_version"

  type Index = {
    skills: Array<{
      name: string
      description: string
      files: string[]
    }>
  }

  export function dir() {
    return path.join(Global.Path.cache, "skills")
  }

  /**
   * Initialize builtin skills by extracting them to the cache directory.
   * This ensures skills are available for use and can be updated.
   */
  export async function initializeBuiltinSkills(): Promise<void> {
    const cacheDir = dir()

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
   * Update builtin skills from remote URLs.
   * If force is true, skip version check and always update.
   */
  export async function updateBuiltinSkill(name: string, force = false): Promise<boolean> {
    const cacheDir = dir()
    const skillDir = path.join(cacheDir, name)

    // Get the remote URL for this skill (config-based)
    // For now, we use a fixed mapping - this could be made configurable
    const remoteUrls: Record<string, string> = {
      "security-review": "https://raw.githubusercontent.com/zgsm-ai/security-review/main",
    }

    const remoteUrl = remoteUrls[name]
    if (!remoteUrl) {
      log.warn("no remote URL configured for builtin skill", { name })
      return false
    }

    try {
      // Pull from remote
      log.info("updating builtin skill from remote", { name, url: remoteUrl })
      const updated = await pull(remoteUrl)

      // Check if the skill was successfully updated
      if (updated.length > 0) {
        log.info("builtin skill updated successfully", { name })
        return true
      }

      return false
    } catch (err) {
      log.error("failed to update builtin skill", { name, err })
      return false
    }
  }

  /**
   * Update all builtin skills from their remote sources.
   */
  export async function updateAllBuiltinSkills(force = false): Promise<void> {
    const names = Object.keys(Builtin.BUILTIN_SKILLS)
    log.info("updating all builtin skills", { count: names.length })

    for (const name of names) {
      await updateBuiltinSkill(name, force)
    }
  }

  async function get(url: string, dest: string): Promise<boolean> {
    if (await Filesystem.exists(dest)) return true
    return fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          log.error("failed to download", { url, status: response.status })
          return false
        }
        if (response.body) await Filesystem.writeStream(dest, response.body)
        return true
      })
      .catch((err) => {
        log.error("failed to download", { url, err })
        return false
      })
  }

  export async function pull(url: string): Promise<string[]> {
    const result: string[] = []
    const base = url.endsWith("/") ? url : `${url}/`
    const index = new URL("index.json", base).href
    const cache = dir()
    const host = base.slice(0, -1)

    log.info("fetching index", { url: index })
    const data = await fetch(index)
      .then(async (response) => {
        if (!response.ok) {
          log.error("failed to fetch index", { url: index, status: response.status })
          return undefined
        }
        return response
          .json()
          .then((json) => json as Index)
          .catch((err) => {
            log.error("failed to parse index", { url: index, err })
            return undefined
          })
      })
      .catch((err) => {
        log.error("failed to fetch index", { url: index, err })
        return undefined
      })

    if (!data?.skills || !Array.isArray(data.skills)) {
      log.warn("invalid index format", { url: index })
      return result
    }

    const list = data.skills.filter((skill) => {
      if (!skill?.name || !Array.isArray(skill.files)) {
        log.warn("invalid skill entry", { url: index, skill })
        return false
      }
      return true
    })

    await Promise.all(
      list.map(async (skill) => {
        const root = path.join(cache, skill.name)
        await Promise.all(
          skill.files.map(async (file) => {
            const link = new URL(file, `${host}/${skill.name}/`).href
            const dest = path.join(root, file)
            await mkdir(path.dirname(dest), { recursive: true })
            await get(link, dest)
          }),
        )

        const md = path.join(root, "SKILL.md")
        if (await Filesystem.exists(md)) result.push(root)
      }),
    )

    return result
  }
}
