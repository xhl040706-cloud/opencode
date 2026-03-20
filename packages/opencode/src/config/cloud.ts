// Cloud mode configuration - for cs cloud / cs serve in cloud mode
// Config file: cloud.json or cloud.jsonc in project root
import z from "zod"
import { Log } from "../util/log"
import { Filesystem } from "../util/filesystem"
import path from "path"
import os from "os"

const log = Log.create({ service: "cloud-config" })

/**
 * Get platform-specific default blacklist
 */
function getDefaultBlacklist(): string[] {
  const platform = os.platform()
  
  // Common blacklist for all platforms
  const commonBlacklist = [
    "**/.ssh/**",
    "**/.aws/**",
    "**/.azure/**",
    "**/.gcp/**",
    "**/.kube/**",
    "**/.docker/**",
    "**/.npmrc",
    "**/.pypirc",
    "**/.netrc",
    "**/.git-credentials",
    "**/node_modules/**",
    "**/.git/**",
    "**/.svn/**",
    "**/.hg/**",
    "**/secrets/**",
    "**/secret/**",
    "**/credentials/**",
    "**/credential/**",
    "**/*.key",
    "**/*.pem",
    "**/*.pfx",
    "**/*.p12",
    "**/*.keystore",
    "**/*.jks",
    "**/.env*",
    "**/.env.*",
    "**/config.json",
    "**/credentials.json",
    "**/service-account*.json",
  ]
  
  if (platform === "win32") {
    // Windows-specific blacklist
    return [
      ...commonBlacklist,
      // Windows system directories
      "C:/Windows/**",
      "C:/Windows/System32/**",
      "C:/Program Files/**",
      "C:/Program Files (x86)/**",
      "C:/ProgramData/**",
      "C:/$Recycle.Bin/**",
      "C:/System Volume Information/**",
      // User sensitive data
      "**/AppData/Roaming/Microsoft/**",
      "**/AppData/Local/Microsoft/**",
      "**/NTUSER.DAT*",
      // Windows credentials
      "**/Cookies/**",
      "**/History/**",
      "**/Vault/**",
      // PowerShell history
      "**/ConsoleHost_history.txt",
      // Windows registry (exported)
      "**/*.reg",
    ]
  } else if (platform === "darwin") {
    // macOS-specific blacklist
    return [
      ...commonBlacklist,
      // macOS system directories
      "/System/**",
      "/Library/**",
      "/private/**",
      "/.fseventsd/**",
      "/.Spotlight-V100/**",
      "/.Trashes/**",
      // User sensitive data
      "**/Library/Keychains/**",
      "**/Library/Logs/**",
      "**/Library/Cookies/**",
      "**/Library/Caches/**",
      "**/Library/Application Support/**",
      // macOS credentials
      "**/.AppleDB/**",
      "**/.AppleDesktop/**",
      "**/.AppleDouble/**",
      // Bash/Zsh history
      "**/.bash_history",
      "**/.zsh_history",
      // SSH on macOS
      "/etc/ssh/**",
    ]
  } else {
    // Linux and other Unix-like systems
    return [
      ...commonBlacklist,
      // Linux system directories
      "/bin/**",
      "/sbin/**",
      "/lib/**",
      "/lib64/**",
      "/usr/bin/**",
      "/usr/sbin/**",
      "/usr/lib/**",
      "/usr/lib64/**",
      "/boot/**",
      "/dev/**",
      "/proc/**",
      "/sys/**",
      "/run/**",
      "/var/**",
      "/tmp/**",
      // System configuration
      "/etc/**",
      // Root home directory
      "/root/**",
      // Snap packages (Ubuntu)
      "/snap/**",
      // Flatpak
      "/var/lib/flatpak/**",
      "**/.local/share/flatpak/**",
      // Systemd
      "/etc/systemd/**",
      "/lib/systemd/**",
      // Bash history
      "**/.bash_history",
      "**/.zsh_history",
      "**/.history",
      "**/.sh_history",
      // Vim/Neovim
      "**/.viminfo",
      "**/.nviminfo",
      // Less history
      "**/.lesshst",
      // MySQL
      "**/.mysql_history",
      // PostgreSQL
      "**/.psql_history",
      // Redis
      "**/.rediscli_history",
      // Python
      "**/.python_history",
    ]
  }
}

export const CloudConfig = z
  .object({
    // Path blacklist - paths that should not be accessible via cloud API
    pathBlacklist: z
      .array(z.string())
      .optional()
      .describe("Array of path patterns that should be blocked from cloud access"),
    
    // Path whitelist - if specified, only these paths are accessible (takes precedence over blacklist)
    pathWhitelist: z
      .array(z.string())
      .optional()
      .describe("Array of path patterns that are allowed for cloud access. If specified, only these paths are accessible."),
    
    // Allow absolute path access
    allowAbsolutePaths: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether to allow accessing files by absolute paths through cloud API"),
    
    // Maximum depth for directory listing
    maxListDepth: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(3)
      .describe("Maximum depth for recursive directory listing"),
    
    // Allowed operations
    allowedOperations: z
      .array(z.enum(["list", "read", "write", "delete", "search"]))
      .optional()
      .default(["list", "read", "search"])
      .describe("Array of allowed file operations via cloud API"),
  })
  .meta({
    ref: "CloudConfig",
  })

export type CloudConfig = z.infer<typeof CloudConfig>

// Default cloud config
export const defaultCloudConfig: CloudConfig = {
  pathBlacklist: getDefaultBlacklist(),
  allowAbsolutePaths: true,
  maxListDepth: 3,
  allowedOperations: ["list", "read", "search"],
}

// Cloud config cache
let cachedConfig: CloudConfig | null = null
let cachedConfigPath: string | null = null

export namespace CloudConfigManager {
  /**
   * Load cloud configuration from cloud.json or cloud.jsonc
   */
  export async function load(worktree: string): Promise<CloudConfig> {
    const configPath = await findConfig(worktree)
    
    if (configPath === cachedConfigPath && cachedConfig) {
      return cachedConfig
    }
    
    if (!configPath) {
      cachedConfig = defaultCloudConfig
      cachedConfigPath = null
      return defaultCloudConfig
    }
    
    try {
      const content = await Filesystem.readText(configPath)
      const parsed = JSON.parse(content)
      const config = CloudConfig.parse({ ...defaultCloudConfig, ...parsed })
      cachedConfig = config
      cachedConfigPath = configPath
      log.info("loaded cloud config", { path: configPath })
      return config
    } catch (err) {
      log.error("failed to load cloud config", { path: configPath, error: err })
      cachedConfig = defaultCloudConfig
      cachedConfigPath = null
      return defaultCloudConfig
    }
  }
  
  /**
   * Find cloud config file in worktree
   */
  export async function findConfig(worktree: string): Promise<string | null> {
    for (const file of ["cloud.jsonc", "cloud.json"]) {
      const fullPath = path.join(worktree, file)
      if (await Filesystem.exists(fullPath)) {
        return fullPath
      }
    }
    return null
  }
  
  /**
   * Check if a path is allowed based on blacklist/whitelist
   */
  export function isPathAllowed(config: CloudConfig, targetPath: string): boolean {
    // Normalize path
    const normalized = path.normalize(targetPath)
    
    // Check whitelist first (if specified, only whitelist matters)
    if (config.pathWhitelist && config.pathWhitelist.length > 0) {
      return config.pathWhitelist.some((pattern) => matchPattern(normalized, pattern))
    }
    
    // Check blacklist
    if (config.pathBlacklist) {
      const isBlacklisted = config.pathBlacklist.some((pattern) => matchPattern(normalized, pattern))
      if (isBlacklisted) {
        return false
      }
    }
    
    return true
  }
  
  /**
   * Check if operation is allowed
   */
  export function isOperationAllowed(config: CloudConfig, operation: CloudConfig["allowedOperations"][number]): boolean {
    return config.allowedOperations?.includes(operation) ?? true
  }
  
  /**
   * Clear cache (useful for testing or config reload)
   */
  export function clearCache() {
    cachedConfig = null
    cachedConfigPath = null
  }
}

/**
 * Match path against glob-like pattern
 * Supports:
 * - ** matches any number of directory levels
 * - * matches any characters except /
 * - ? matches single character
 */
function matchPattern(targetPath: string, pattern: string): boolean {
  // Normalize both paths
  const normalizedPath = targetPath.toLowerCase()
  const normalizedPattern = pattern.toLowerCase()
  
  // Direct match
  if (normalizedPath === normalizedPattern) {
    return true
  }
  
  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".")
    .replace(/<<<DOUBLESTAR>>>/g, ".*")
    .replace(/\./g, "\\.")
  
  const regex = new RegExp(`^${regexPattern}$|^${regexPattern}/|/${regexPattern}$|/${regexPattern}/`)
  return regex.test(normalizedPath)
}
