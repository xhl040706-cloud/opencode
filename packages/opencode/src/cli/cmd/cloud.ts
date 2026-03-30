import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { register, getCloudBaseUrl } from "../../costrict/device/client"
import { connect } from "../../costrict/device/tunnel"
import { initCloudNotifier } from "../../costrict/device/notify"
import { Daemon } from "../../costrict/device/daemon"
import { Log } from "../../util/log"
import { Flag } from "../../flag/flag"
import { Instance } from "../../project/instance"

const log = Log.create({ service: "cloud-cmd" })

const READY_TIMEOUT_MS = 30_000

const DEVICE_ENV_KEY = "__CLOUD_DEVICE__"

// Patch child_process.spawn/spawnSync at the CJS module level so that
// third-party CJS libraries (e.g. cross-spawn used by MCP SDK) automatically
// get windowsHide: true on Windows.  ESM named imports are static bindings
// and won't see this patch, so our own code also sets windowsHide explicitly.
function patchSpawnForWindows() {
  if (process.platform !== "win32") return
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cp = require("child_process") as typeof import("child_process")

  function inject(args: any[]): void {
    const last = args[args.length - 1]
    if (typeof last === "object" && last !== null && !Array.isArray(last)) {
      if (last.windowsHide === undefined) last.windowsHide = true
    }
  }

  const origSpawn = cp.spawn
  ;(cp as any).spawn = function (...args: any[]) {
    inject(args)
    return origSpawn.apply(this, args as Parameters<typeof origSpawn>)
  }

  const origSpawnSync = cp.spawnSync
  ;(cp as any).spawnSync = function (...args: any[]) {
    inject(args)
    return origSpawnSync.apply(this, args as Parameters<typeof origSpawnSync>)
  }

  const origExec = cp.exec
  ;(cp as any).exec = function (...args: any[]) {
    inject(args)
    return origExec.apply(this, args as Parameters<typeof origExec>)
  }

  const origExecSync = cp.execSync
  ;(cp as any).execSync = function (...args: any[]) {
    inject(args)
    return origExecSync.apply(this, args as Parameters<typeof origExecSync>)
  }
}

async function runWorker() {
  Log.useStderr()

  // Prevent child processes from allocating visible console windows.
  // The daemon runs detached with no console; without this, every spawned
  // child (LSP, MCP via cross-spawn, shell commands, etc.) would pop up a
  // console window on Windows.
  patchSpawnForWindows()

  // Handle TLS certificate verification setting before any network requests
  if (Flag.COSTRICT_INSECURE_SKIP_TLS_VERIFY) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    log.warn("TLS certificate verification is disabled (COSTRICT_INSECURE_SKIP_TLS_VERIFY=true) - this is insecure!")
  }

  // Device registration is done in the foreground parent process (startDaemon)
  // and passed to the worker via environment variable.
  const raw = process.env[DEVICE_ENV_KEY]
  if (!raw) throw new Error("missing device info from parent process")
  const device = JSON.parse(raw) as import("../../costrict/device/client").DeviceInfo
  console.log(`device registered: ${device.device_id}`)

  initCloudNotifier(getCloudBaseUrl(), device.device_token, device.device_id)

  const server = Server.listen({ port: 0, hostname: "127.0.0.1" })
  console.log(`internal server on port ${server.port}`)

  connect(server.port!).catch((e) => log.error("tunnel fatal", { error: e?.message ?? e }))

  // Gracefully shut down all child processes (LSP, MCP, PTY, etc.) on termination.
  // Without this, child processes spawned via Instance become orphaned when the
  // daemon is killed because Daemon.stop() only signals this top-level process.
  let stopping = false
  const shutdown = async () => {
    if (stopping) return
    stopping = true
    log.info("daemon shutting down, disposing instances")
    try {
      await Instance.disposeAll()
    } catch (e: any) {
      log.error("dispose error during shutdown", { error: e?.message ?? e })
    }
    server.stop(true)
    process.exit(0)
  }
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)

  // On Windows, process.kill(pid, "SIGTERM") calls TerminateProcess() which
  // bypasses signal handlers entirely.  Poll for a stop-signal file instead
  // so we get a chance to run the graceful shutdown path above.
  if (process.platform === "win32") {
    const file = Daemon.stopFile()
    Daemon.removeStop()
    const timer = setInterval(() => {
      try {
        fs.statSync(file)
        clearInterval(timer)
        shutdown()
      } catch {}
    }, 500)
    timer.unref()
  }

  if (process.send) {
    process.send({ ready: true, pid: process.pid })
  }

  await new Promise(() => {})
}

async function startDaemon() {
  const { running, pid } = Daemon.status()
  if (running) {
    console.log(`cloud daemon already running (pid: ${pid})`)
    return
  }

  // Handle TLS certificate verification setting before any network requests
  if (Flag.COSTRICT_INSECURE_SKIP_TLS_VERIFY) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    log.warn("TLS certificate verification is disabled (COSTRICT_INSECURE_SKIP_TLS_VERIFY=true) - this is insecure!")
  }

  // Perform device registration in the foreground so auth errors are visible
  const device = await register()
  console.log(`device registered: ${device.device_id}`)

  const logFd = Daemon.openLogFd()

  // In dev mode, process.execPath is "bun" and `bun cloud` is a reserved
  // Bun subcommand, so we need to go through `bun run` with the script
  // entrypoint.  In production the compiled binary handles it directly.
  const entry = process.execPath
  const dev = path.basename(entry).toLowerCase().startsWith("bun")
  const args = dev
    ? ["run", "--conditions=browser", path.resolve(import.meta.dirname, "../../index.ts"), "cloud", "_worker"]
    : ["cloud", "_worker"]

  const child = spawn(entry, args, {
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd, "ipc"],
    env: { ...process.env, [DEVICE_ENV_KEY]: JSON.stringify(device) },
    ...(dev ? { cwd: path.resolve(import.meta.dirname, "../../..") } : {}),
  })

  child.unref()

  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), READY_TIMEOUT_MS)
    child.on("message", (msg: any) => {
      if (msg?.ready) {
        clearTimeout(timer)
        resolve(true)
      }
    })
    child.on("exit", () => {
      clearTimeout(timer)
      resolve(false)
    })
  })

  fs.closeSync(logFd)

  if (!ready || !child.pid) {
    console.error("cloud daemon failed to start, check logs: " + Daemon.logFile())
    process.exit(1)
  }

  Daemon.writePid(child.pid)
  console.log(`cloud daemon started (pid: ${child.pid})`)
  console.log(`logs: cs cloud logs`)
}

export const CloudCommand = cmd({
  command: "cloud [command]",
  describe: "manage cloud daemon (register device and connect via WebSocket tunnel)",
  builder: (yargs) =>
    yargs
      .command("start", "start cloud daemon", {}, async () => {
        await startDaemon()
      })
      .command("stop", "stop cloud daemon", {}, () => {
        const stopped = Daemon.stop()
        console.log(stopped ? "cloud daemon stopped" : "cloud daemon is not running")
      })
      .command("status", "show cloud daemon status", {}, () => {
        const { running, pid } = Daemon.status()
        if (running) {
          console.log(`running (pid: ${pid})`)
          console.log(`logs: ${Daemon.logFile()}`)
        } else {
          console.log("not running")
        }
      })
      .command(
        "logs",
        "tail cloud daemon logs",
        (y) =>
          y
            .option("lines", { alias: "n", type: "number", default: 100, describe: "number of lines to show" })
            .option("follow", { alias: "f", type: "boolean", default: false, describe: "follow log output" }),
        (args) => {
          Daemon.tailLogs(args.lines, args.follow)
        },
      )
      .command("restart", "restart cloud daemon", {}, async () => {
        const stopped = Daemon.stop()
        if (stopped) console.log("cloud daemon stopped")
        await startDaemon()
      })
      .command("_worker", false, {}, async () => {
        await runWorker()
      }),
  handler: async () => {
    console.error("specify a subcommand: start, stop, restart, status, logs")
    process.exit(1)
  },
})
