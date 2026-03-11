import type { Config } from "../../config/config"

export type RegistryItemType = "skill" | "subagent" | "command" | "mcp"

export type RegistryItemFile = {
  slug: string
  type: "skill" | "subagent" | "command"
  name: string
  description: string
  files: string[]
}

export type RegistryItemMcp = {
  slug: string
  type: "mcp"
  name: string
  description: string
  mcp: Config.Mcp
}

export type RegistryItem = RegistryItemFile | RegistryItemMcp

export type IndexJson = {
  version: 1
  items: RegistryItem[]
}

export type RegistryAccess = {
  public: boolean
}

export type AccessCache = {
  public: boolean
  cachedAt: number
}

export type InstalledEntry = {
  slug: string
  type: RegistryItemType
  name: string
  registry: string
  scope: "global" | "project"
  installedAt: string
}

export type InstalledRecord = {
  items: InstalledEntry[]
}

export type InstallScope = "global" | "project"

export class NotLoggedInError extends Error {
  constructor() {
    super("This registry requires authentication. Run: cs auth login")
    this.name = "NotLoggedInError"
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication failed. Run: cs auth login to re-authenticate")
    this.name = "UnauthorizedError"
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("You don't have access to this registry. Contact your organization admin")
    this.name = "ForbiddenError"
  }
}

export class AlreadyInstalledError extends Error {
  constructor(slug: string) {
    super(`${slug} is already installed. Run: cs plugin update ${slug}`)
    this.name = "AlreadyInstalledError"
  }
}
