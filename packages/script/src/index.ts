import { $, semver } from "bun"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  COSTRICT_CHANNEL: process.env["COSTRICT_CHANNEL"],
  COSTRICT_BUMP: process.env["COSTRICT_BUMP"],
  COSTRICT_VERSION: process.env["COSTRICT_VERSION"],
  OPENCODE_RELEASE: process.env["OPENCODE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.COSTRICT_CHANNEL) return env.COSTRICT_CHANNEL
  if (env.COSTRICT_BUMP) return "latest"
  if (env.COSTRICT_VERSION && !env.COSTRICT_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.COSTRICT_VERSION) return env.COSTRICT_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await fetch("https://registry.npmjs.org/opencode-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.COSTRICT_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const COMMIT_HASH = await (async () => {
  try {
    return await $`git rev-parse --short HEAD`.text().then((x) => x.trim())
  } catch {
    return "unknown"
  }
})()

const BUILD_TIME = new Date().toLocaleString("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

const team = [
  "actions-user",
  "opencode",
  "rekram1-node",
  "thdxr",
  "kommander",
  "jayair",
  "fwang",
  "MrMushrooooom",
  "adamdotdevin",
  "iamdavidhill",
  "Brendonovich",
  "nexxeln",
  "Hona",
  "jlongster",
  "opencode-agent[bot]",
  "R44VC0RP",
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.OPENCODE_RELEASE
  },
  get team() {
    return team
  },
  get commitHash() {
    return COMMIT_HASH
  },
  get buildTime() {
    return BUILD_TIME
  },
}
console.log(`opencode script`, JSON.stringify(Script, null, 2))
