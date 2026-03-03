#!/usr/bin/env bun
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { Script } from "@opencode-ai/script"
import Bun from "bun"
import { $ } from "bun"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

// Generate latest.json from dist directory artifacts
export async function generateLatestJson() {
  console.log("Generating latest.json...")
  const BASE_URL = process.env.COSTRICT_BASE_URL || "https://zgsm.sangfor.com"
  
  // Define binaries to compress
  const binaries = {
    "opencode-darwin-arm64": "darwin-arm64",
    "opencode-darwin-x64": "darwin-x64",
    "opencode-darwin-x64-baseline": "darwin-x64-baseline",
    "opencode-linux-arm64": "linux-arm64",
    "opencode-linux-arm64-musl": "linux-arm64-musl",
    "opencode-linux-x64": "linux-x64",
    "opencode-linux-x64-baseline": "linux-x64-baseline",
    "opencode-linux-x64-baseline-musl": "linux-x64-baseline-musl",
    "opencode-linux-x64-musl": "linux-x64-musl",
    "opencode-windows-x64": "windows-x64",
    "opencode-windows-x64-baseline": "windows-x64-baseline"
  }
  
  // Compress built artifacts - Windows uses .zip, Linux/macOS uses .tar.gz
  console.log("Compressing artifacts...")
  for (const name of Object.keys(binaries)) {
    const srcPath = path.join(dir, "dist", name)
    
    // Check if directory exists
    if (!fs.existsSync(srcPath)) {
      console.log(`Skipping ${name} - directory not found`)
      continue
    }
    
    const ext = name.includes("windows") ? ".zip" : ".tar.gz"
    const destPath = path.join(dir, "dist", `${name}${ext}`)
    
    if (name.includes("windows")) {
      console.log(`Compressing ${name} to ${name}${ext}`)
      await $`(cd ${srcPath} && zip -rq ${destPath} .)`
    } else {
      console.log(`Compressing ${name} to ${name}${ext}`)
      await $`tar -czf ${destPath} -C ${srcPath} .`
    }
    
    console.log(`Removing original folder ${name}`)
    await $`rm -rf ${srcPath}`
  }
  
  try {
    const distPath = path.join(dir, "dist")
    const entries = fs.readdirSync(distPath)
    
    // Filter for .zip and .tar.gz files
    const artifactNames = entries.filter((name) =>
      name.endsWith(".zip") || name.endsWith(".tar.gz")
    )
    
    if (artifactNames.length === 0) {
      console.warn("No artifacts found in dist directory")
      return
    }
    
    // Calculate sha256 for each artifact
    const assets = await Promise.all(
      artifactNames.map(async (name) => {
        const filePath = path.join(distPath, name)
        const fileBuffer = await Bun.file(filePath).arrayBuffer()
        const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
        const file = Bun.file(filePath)
        const fileSize = file.size
        
        return {
          name,
          size: fileSize,
          browser_download_url: `${BASE_URL}/costrict-cli/pkg/${Script.version}/${name}`,
          digest: `sha256:${hashHex}`
        }
      })
    )
    
    // Generate latest.json
    const latestInfo = {
      tag_name: Script.version,
      name: Script.version,
      html_url: "",
      published_at: new Date().toISOString(),
      assets
    }
    
    // Write latest.json to dist folder
    const LATEST_JSON_PATH = path.join(dir, "dist", "latest.json")
    await Bun.write(LATEST_JSON_PATH, JSON.stringify(latestInfo, null, 2))
    console.log(`Generated latest.json at ${LATEST_JSON_PATH}`)
  } catch (error) {
    console.error("Error generating latest.json:", error)
    // Don't fail build if latest.json generation fails
  }
}

// Allow running this script directly
if (import.meta.main) {
  await generateLatestJson()
}
