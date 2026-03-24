import type { Config } from "../../config/config"

export type RegistryItemType = "skill" | "subagent" | "command" | "hook" | "mcp" | "plugin"

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

export interface CreateRegistryRequest {
  name: string
  description: string
  sourceType: "git" | "s3" | "local"
  visibility: "public" | "private"
  ownerId: string
  syncEnabled: boolean
  syncInterval?: number
}

export interface CreateRegistryResponse {
  id: string
  name: string
  description: string
  sourceType: "git" | "s3" | "local"
  visibility: "public" | "private"
  ownerId: string
  createdAt: string
}

export class PackValidationError extends Error {
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = "PackValidationError"
    this.field = field
  }
}

export class SkillNotFoundError extends Error {
  constructor(pluginPath: string) {
    super(`SKILL.md not found in ${pluginPath}`)
    this.name = "SkillNotFoundError"
  }
}

export class PackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PackError"
  }
}

export interface CreateItemRequest {
  slug: string
  itemType: RegistryItemType
  name: string
  description: string
  category: string
  version: string
  content: string
  createdBy: string
}

export interface CreateItemResponse {
  id: string
  registryId: string
  slug: string
  itemType: RegistryItemType
  name: string
  description: string
  category: string
  version: string
  content: string
  createdBy: string
  createdAt: string
}

export interface UploadArtifactResponse {
  id: string
  itemId: string
  filename: string
  fileSize: number
  checksumSha256: string
  mimeType: string
  artifactVersion: string
  isLatest: boolean
  uploadedBy: string
  createdAt: string
}
