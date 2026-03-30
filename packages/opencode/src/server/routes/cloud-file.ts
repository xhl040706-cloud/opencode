import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { File } from "../../file"
import { Instance } from "../../project/instance"
import { lazy } from "../../util/lazy"
import { CloudConfigManager } from "../../config/cloud"
import { Filesystem } from "../../util/filesystem"
import path from "path"
import fs from "fs"

// Schema definitions
const FileNode = z.object({
  name: z.string(),
  path: z.string(),
  absolute: z.string(),
  type: z.enum(["file", "directory"]),
  ignored: z.boolean(),
})

const FileContent = z.object({
  type: z.enum(["text", "binary"]),
  content: z.string(),
  diff: z.string().optional(),
  patch: z.string().optional(),
  encoding: z.string().optional(),
  mimeType: z.string().optional(),
})

export const CloudFileRoutes = lazy(() =>
  new Hono()
    // List files at absolute path
    .get(
      "/cloud/file/list",
      describeRoute({
        summary: "List files at absolute path (cloud mode)",
        description: "List files and directories at an absolute path with blacklist/whitelist protection.",
        operationId: "cloud.file.list",
        responses: {
          200: {
            description: "Files and directories",
            content: {
              "application/json": {
                schema: resolver(FileNode.array()),
              },
            },
          },
          403: {
            description: "Path not allowed",
            content: {
              "application/json": {
                schema: resolver(z.object({ error: z.string() })),
              },
            },
          },
          404: {
            description: "Path not found",
            content: {
              "application/json": {
                schema: resolver(z.object({ error: z.string() })),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string().describe("Absolute path to list"),
        })
      ),
      async (c) => {
        const targetPath = path.resolve(c.req.valid("query").path)
        const worktree = Instance.worktree
        
        // Load cloud config
        const config = await CloudConfigManager.load(worktree)
        
        // Check if operation is allowed
        if (!CloudConfigManager.isOperationAllowed(config, "list")) {
          return c.json({ error: "Operation 'list' is not allowed in cloud mode" }, 403)
        }
        
        // Check if absolute paths are allowed
        if (!config.allowAbsolutePaths) {
          return c.json({ error: "Absolute path access is not enabled" }, 403)
        }
        
        // Check path against blacklist/whitelist
        if (!CloudConfigManager.isPathAllowed(config, targetPath)) {
          return c.json({ error: "Access to this path is not allowed" }, 403)
        }
        
        // Check if path exists and is directory
        try {
          const stats = fs.statSync(targetPath)
          if (!stats.isDirectory()) {
            return c.json({ error: "Path is not a directory" }, 400)
          }
        } catch (err) {
          return c.json({ error: "Path not found or inaccessible" }, 404)
        }
        
        // List directory contents
        const nodes: z.infer<typeof FileNode>[] = []
        const exclude = [".git", ".DS_Store"]
        
        try {
          const entries = fs.readdirSync(targetPath, { withFileTypes: true })
          
          for (const entry of entries) {
            if (exclude.includes(entry.name)) continue
            
            const fullPath = path.join(targetPath, entry.name)
            const type = entry.isDirectory() ? "directory" : "file"
            
            // Check if child path is allowed (for security)
            if (!CloudConfigManager.isPathAllowed(config, fullPath)) {
              continue
            }
            
            nodes.push({
              name: entry.name,
              path: fullPath,
              absolute: fullPath,
              type,
              ignored: false,
            })
          }
          
          // Sort: directories first, then alphabetically
          nodes.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === "directory" ? -1 : 1
            }
            return a.name.localeCompare(b.name)
          })
          
          return c.json(nodes)
        } catch (err) {
          return c.json({ error: "Failed to read directory" }, 500)
        }
      }
    )
    
    // Read file at absolute path
    .get(
      "/cloud/file/read",
      describeRoute({
        summary: "Read file at absolute path (cloud mode)",
        description: "Read file content at an absolute path with blacklist/whitelist protection.",
        operationId: "cloud.file.read",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/json": {
                schema: resolver(FileContent),
              },
            },
          },
          403: {
            description: "Path not allowed",
            content: {
              "application/json": {
                schema: resolver(z.object({ error: z.string() })),
              },
            },
          },
          404: {
            description: "File not found",
            content: {
              "application/json": {
                schema: resolver(z.object({ error: z.string() })),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string().describe("Absolute path to file"),
        })
      ),
      async (c) => {
        const targetPath = path.resolve(c.req.valid("query").path)
        const worktree = Instance.worktree
        
        // Load cloud config
        const config = await CloudConfigManager.load(worktree)
        
        // Check if operation is allowed
        if (!CloudConfigManager.isOperationAllowed(config, "read")) {
          return c.json({ error: "Operation 'read' is not allowed in cloud mode" }, 403)
        }
        
        // Check if absolute paths are allowed
        if (!config.allowAbsolutePaths) {
          return c.json({ error: "Absolute path access is not enabled" }, 403)
        }
        
        // Check path against blacklist/whitelist
        if (!CloudConfigManager.isPathAllowed(config, targetPath)) {
          return c.json({ error: "Access to this path is not allowed" }, 403)
        }
        
        // Check if path exists and is file
        try {
          const stats = fs.statSync(targetPath)
          if (!stats.isFile()) {
            return c.json({ error: "Path is not a file" }, 400)
          }
        } catch (err) {
          return c.json({ error: "File not found or inaccessible" }, 404)
        }
        
        // Read file content
        try {
          const content = fs.readFileSync(targetPath, "utf-8")
          return c.json({
            type: "text",
            content,
          })
        } catch (err) {
          // Try as binary
          try {
            const content = fs.readFileSync(targetPath, "base64")
            return c.json({
              type: "binary",
              content,
              encoding: "base64",
            })
          } catch (binaryErr) {
            return c.json({ error: "Failed to read file" }, 500)
          }
        }
      }
    )
    
    // Search files at absolute path
    .get(
      "/cloud/file/search",
      describeRoute({
        summary: "Search files at absolute path (cloud mode)",
        description: "Search files and directories by name pattern at an absolute path.",
        operationId: "cloud.file.search",
        responses: {
          200: {
            description: "Search results",
            content: {
              "application/json": {
                schema: resolver(z.string().array()),
              },
            },
          },
          403: {
            description: "Path not allowed",
            content: {
              "application/json": {
                schema: resolver(z.object({ error: z.string() })),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string().describe("Absolute path to search in"),
          query: z.string().describe("Search pattern"),
          type: z.enum(["file", "directory"]).optional().describe("Filter by type"),
          limit: z.coerce.number().int().min(1).max(200).optional().default(50),
        })
      ),
      async (c) => {
        const { query, type, limit } = c.req.valid("query")
        const targetPath = path.resolve(c.req.valid("query").path)
        const worktree = Instance.worktree
        
        // Load cloud config
        const config = await CloudConfigManager.load(worktree)
        
        // Check if operation is allowed
        if (!CloudConfigManager.isOperationAllowed(config, "search")) {
          return c.json({ error: "Operation 'search' is not allowed in cloud mode" }, 403)
        }
        
        // Check if absolute paths are allowed
        if (!config.allowAbsolutePaths) {
          return c.json({ error: "Absolute path access is not enabled" }, 403)
        }
        
        // Check path against blacklist/whitelist
        if (!CloudConfigManager.isPathAllowed(config, targetPath)) {
          return c.json({ error: "Access to this path is not allowed" }, 403)
        }
        
        // Check if path exists and is directory
        try {
          const stats = fs.statSync(targetPath)
          if (!stats.isDirectory()) {
            return c.json({ error: "Path is not a directory" }, 400)
          }
        } catch (err) {
          return c.json({ error: "Path not found or inaccessible" }, 404)
        }
        
        // Search files
        const results: string[] = []
        const queryLower = query.toLowerCase()
        
        function searchRecursive(dir: string, depth: number) {
          if (depth > config.maxListDepth) return
          if (results.length >= limit) return
          
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            
            for (const entry of entries) {
              if (results.length >= limit) break
              
              const fullPath = path.join(dir, entry.name)
              
              // Skip blacklisted paths
              if (!CloudConfigManager.isPathAllowed(config, fullPath)) {
                continue
              }
              
              const entryType = entry.isDirectory() ? "directory" : "file"
              
              // Check type filter
              if (type && entryType !== type) {
                if (entry.isDirectory()) {
                  searchRecursive(fullPath, depth + 1)
                }
                continue
              }
              
              // Check name match
              if (entry.name.toLowerCase().includes(queryLower)) {
                results.push(fullPath)
              }
              
              // Recurse into directories
              if (entry.isDirectory()) {
                searchRecursive(fullPath, depth + 1)
              }
            }
          } catch (err) {
            // Ignore permission errors during search
          }
        }
        
        searchRecursive(targetPath, 0)
        return c.json(results)
      }
    )
    
    // Get cloud config info (for debugging/admin)
    .get(
      "/cloud/config",
      describeRoute({
        summary: "Get cloud configuration",
        description: "Get current cloud mode configuration (sensitive paths redacted).",
        operationId: "cloud.config.get",
        responses: {
          200: {
            description: "Cloud configuration",
            content: {
              "application/json": {
                schema: resolver(z.object({
                  allowAbsolutePaths: z.boolean(),
                  maxListDepth: z.number(),
                  allowedOperations: z.array(z.string()),
                  blacklistCount: z.number(),
                  whitelistEnabled: z.boolean(),
                })),
              },
            },
          },
        },
      }),
      async (c) => {
        const worktree = Instance.worktree
        const config = await CloudConfigManager.load(worktree)
        
        return c.json({
          allowAbsolutePaths: config.allowAbsolutePaths,
          maxListDepth: config.maxListDepth,
          allowedOperations: config.allowedOperations,
          blacklistCount: config.pathBlacklist?.length ?? 0,
          whitelistEnabled: (config.pathWhitelist?.length ?? 0) > 0,
        })
      }
    )
)
